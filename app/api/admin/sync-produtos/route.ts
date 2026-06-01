// Sync de produtos direto via Next.js — sem Edge Function.
// Processa uma página (100 itens) por chamada; o modal chama em loop até concluir.

export const maxDuration = 300;

import { NextResponse, NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";
import { decrypt } from "@/lib/crypto";

interface MaxDataProduto {
  id: number;
  descricao?: string;
  codigoFab?: string;
  grupo?: string;
  grupoId?: number;
  subGrupo?: string;
  fabricante?: string;
  valorVenda?: number;
  valorCusto?: number;
  estoque?: number;
  desativado?: boolean;
}

interface PaginatedResponse {
  docs: MaxDataProduto[];
  pages: number;
  total: number;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verificar autenticação e privilégio admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const admin = await isSystemAdmin(user.id);
    if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await req.json() as { lojaId: string; pagina?: number };
    const { lojaId, pagina = 1 } = body;

    if (!lojaId) {
      return NextResponse.json({ error: "lojaId obrigatório" }, { status: 400 });
    }

    // 2. Buscar dados da loja
    const adminClient = createAdminClient();
    const { data: loja, error: lojaError } = await adminClient
      .from("lojas")
      .select("id, emp_id, erp_base_url, terminal_encrypted")
      .eq("id", lojaId)
      .single();

    if (lojaError || !loja) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    const lojaRow = loja as {
      id: string;
      emp_id: number;
      erp_base_url: string;
      terminal_encrypted: string;
    };

    // 3. Autenticar na API MaxData — terminal descriptografado só em memória
    const terminal = decrypt(lojaRow.terminal_encrypted);

    const authRes = await fetch(`${lojaRow.erp_base_url}/v2/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empId: lojaRow.emp_id, terminal }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!authRes.ok) {
      return NextResponse.json(
        { error: `Falha na autenticação MaxData: HTTP ${authRes.status}` },
        { status: 502 }
      );
    }

    const { token } = await authRes.json() as { token: string };

    // 4. Buscar página de produtos
    const LIMIT = 100;
    const url = new URL(`${lojaRow.erp_base_url}/v2/product`);
    url.searchParams.set("page", String(pagina));
    url.searchParams.set("limit", String(LIMIT));

    const prodRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (!prodRes.ok) {
      return NextResponse.json(
        { error: `Erro ao buscar produtos: HTTP ${prodRes.status}` },
        { status: 502 }
      );
    }

    const json = await prodRes.json() as PaginatedResponse;
    const produtos: MaxDataProduto[] = json.docs ?? [];
    const totalPaginas: number = json.pages ?? 1;
    const totalProdutos: number = json.total ?? 0;

    console.log(
      `[sync-produtos] Loja ${lojaId}: página ${pagina}/${totalPaginas}, ${produtos.length} produtos`
    );

    // 5. Mapear e salvar produtos
    if (produtos.length > 0) {
      const agora = new Date().toISOString();
      const rows = produtos.map((p) => ({
        loja_id: lojaId,
        external_id: p.id,
        codigo: p.codigoFab ?? null,
        nome: p.descricao ?? "Produto",
        grupo_id: p.grupoId ?? null,
        grupo_nome: p.grupo ?? null,
        sub_grupo_nome: p.subGrupo ?? null,
        fabricante: p.fabricante ?? null,
        preco_venda: p.valorVenda ?? null,
        valor_custo: p.valorCusto ?? null,
        estoque_atual: p.estoque ?? 0,
        ativo: !p.desativado,
        sincronizado_em: agora,
      }));

      const { error } = await adminClient
        .from("produtos")
        .upsert(rows, { onConflict: "loja_id,external_id" });

      if (error) {
        console.error("[sync-produtos] Erro upsert:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    const concluido = pagina >= totalPaginas;

    // 6. Atualizar progresso no banco
    await adminClient
      .from("sync_inicial")
      .upsert(
        {
          loja_id: lojaId,
          produtos_status: concluido ? "concluido" : "em_andamento",
          produtos_pagina_atual: pagina,
          produtos_total: totalProdutos,
          atualizado_em: new Date().toISOString(),
          ...(concluido ? { produtos_concluido_em: new Date().toISOString() } : {}),
        },
        { onConflict: "loja_id" }
      );

    return NextResponse.json({
      pagina_processada: pagina,
      produtos_salvos: produtos.length,
      proxima_pagina: concluido ? null : pagina + 1,
      total_paginas: totalPaginas,
      total_produtos: totalProdutos,
      concluido,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[sync-produtos] Erro:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
