// Rota de sync inicial direta — sem passar pela Edge Function Supabase.
// Resolve o problema de timeout (150s) e limite de RAM (128MB) das Edge Functions.
// Processa vendas página por página sem acumular em memória.

// Timeout máximo da rota (Vercel Pro/Enterprise: até 300s; Hobby: 60s)
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";
import { decrypt } from "@/lib/crypto";

interface MaxDataVenda {
  id: number;
  cfop?: number;
  abertura?: string;
  fechamento?: string;
  clienteId?: number;
  clienteNome?: string;
  cpfCnpj?: string;
  valorTotalLiquidoProduto?: number;
  valorTotal?: number;
  totalNf?: number;
  vlrPago?: number;
  valorTotalDesconto?: number;
  status?: string;
}

interface CfopRow {
  cfop: number;
  tipo: string;
  subtipo: string | null;
}

interface PaginatedResponse {
  docs: MaxDataVenda[];
  pages: number;
  total: number;
}

interface LojaRow {
  id: string;
  emp_id: number;
  erp_base_url: string;
  terminal_encrypted: string;
  sync_services_enabled: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  try {
    // 1. Verificar autenticação e privilégio admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const admin = await isSystemAdmin(user.id);
    if (!admin) return NextResponse.json({ error: "Permissão negada" }, { status: 403 });

    // 2. Parsear corpo
    const body = await req.json() as {
      lojaId: string;
      dataInicial: string;  // "YYYY-MM-DD"
      dataFinal: string;    // "YYYY-MM-DD"
      pageLimit?: number;   // máx páginas por request (padrão 150)
      startPage?: number;   // página inicial para retomar (padrão 1)
    };
    const {
      lojaId,
      dataInicial,
      dataFinal,
      pageLimit = 50,
      startPage = 1,
    } = body;

    if (!lojaId || !dataInicial || !dataFinal) {
      return NextResponse.json(
        { error: "Campos obrigatórios: lojaId, dataInicial, dataFinal" },
        { status: 400 }
      );
    }

    // 3. Cliente admin para leitura da loja e escritas sem RLS
    const adminClient = createAdminClient();

    // 4. Buscar dados da loja
    const { data: loja, error: lojaError } = await adminClient
      .from("lojas")
      .select("id, emp_id, erp_base_url, terminal_encrypted, sync_services_enabled")
      .eq("id", lojaId)
      .single();

    if (lojaError || !loja) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    const lojaRow = loja as LojaRow;

    // 5. Autenticar na API MaxData — terminal descriptografado só em memória
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

    // 6. Buscar mapa de CFOPs (pequeno — cabe em memória)
    const { data: cfopRows } = await adminClient
      .from("cfop_classificacoes")
      .select("cfop, tipo, subtipo");

    const cfopMap = new Map<number, { tipo: string; subtipo: string | null }>(
      ((cfopRows ?? []) as CfopRow[]).map((r) => [
        r.cfop,
        { tipo: r.tipo, subtipo: r.subtipo },
      ])
    );

    const dataInicialISO = `${dataInicial}T00:00:00-03:00`;
    const dataFinalISO = `${dataFinal}T23:59:59-03:00`;
    const agora = new Date().toISOString();
    let vendasSalvas = 0;
    let page = startPage;  // retomar da página indicada pelo frontend
    let totalPages = 1;
    let paginasProcessadas = 0;

    // 7. Processar vendas página por página — sem acumular em memória
    while (page <= totalPages) {
      // Limite de páginas por request para evitar timeout
      if (paginasProcessadas >= pageLimit) {
        console.log(
          `[sync-direto] Limite de ${pageLimit} páginas atingido — retornando para continuar`
        );
        await adminClient
          .from("sync_inicial")
          .upsert(
            {
              loja_id: lojaId,
              status: "em_andamento",
              mes_atual: dataInicial,
              vendas_salvas: vendasSalvas,
              atualizado_em: new Date().toISOString(),
            },
            { onConflict: "loja_id" }
          );
        return NextResponse.json({
          periodo_processado: `${dataInicial} → ${dataFinal}`,
          vendas_salvas: vendasSalvas,
          concluido: false,
          proxima_pagina: page,
          total_pages: totalPages,
        });
      }

      const url = new URL(`${lojaRow.erp_base_url}/v2/sale`);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", "50");
      url.searchParams.set("dataInicial", dataInicialISO);
      url.searchParams.set("dataFinal", dataFinalISO);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        console.error(`[sync-direto] Erro página ${page}: HTTP ${res.status}`);
        break;
      }

      const data = await res.json() as PaginatedResponse;
      const docs: MaxDataVenda[] = data.docs ?? [];
      totalPages = data.pages ?? 1;

      if (docs.length === 0) break;

      // Mapear e salvar esta página — docs descartados após o bloco
      const rows = docs.map((v) => {
        const cl = v.cfop ? cfopMap.get(v.cfop) : undefined;
        return {
          loja_id: lojaId,
          external_id: v.id,
          source: "sale",
          numero_venda: String(v.id),
          data_venda: (() => {
            const raw = v.fechamento ?? v.abertura;
            if (raw && raw.trim() !== "") return raw.split("T")[0];
            return dataInicial; // fallback para a data inicial do período
          })(),
          cliente_external_id: v.clienteId ?? null,
          cliente_nome: v.clienteNome ?? null,
          cpf_cnpj: v.cpfCnpj ?? null,
          valor_bruto: v.valorTotalLiquidoProduto ?? v.valorTotal ?? 0,
          valor_desconto: v.valorTotalDesconto ?? 0,
          valor_total: v.totalNf ?? v.vlrPago ?? 0,
          status: (v.status ?? "finalizada").toLowerCase(),
          cfop: v.cfop ?? null,
          tipo: cl?.tipo ?? "outro",
          subtipo: cl?.subtipo ?? null,
          sincronizado_em: agora,
        };
      });

      // Deduplicar dentro da página
      const seen = new Set<number>();
      const unicos = rows.filter((r) => {
        if (seen.has(r.external_id)) return false;
        seen.add(r.external_id);
        return true;
      });

      if (unicos.length > 0) {
        const { error } = await adminClient
          .from("vendas")
          .upsert(unicos, { onConflict: "loja_id,external_id,source" });

        if (error) {
          console.error(`[sync-direto] Upsert erro página ${page}:`, error.message);
        } else {
          vendasSalvas += unicos.length;
        }
      }

      console.log(
        `[sync-direto] ${dataInicial}: página ${page}/${totalPages} — ${docs.length} vendas`
      );

      paginasProcessadas++;
      if (page >= totalPages) break;
      page++;
      await sleep(50);
    }

    // 8. Atualizar progresso no banco
    await adminClient
      .from("sync_inicial")
      .upsert(
        {
          loja_id: lojaId,
          status: "em_andamento",
          mes_atual: dataInicial,
          vendas_salvas: vendasSalvas,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "loja_id" }
      );

    return NextResponse.json({
      periodo_processado: `${dataInicial} → ${dataFinal}`,
      vendas_salvas: vendasSalvas,
      concluido: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[sync-direto] Erro:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
