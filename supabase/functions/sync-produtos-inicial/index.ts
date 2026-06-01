// Edge Function: sync-produtos-inicial
// Processa uma página de produtos por invocação (100 itens/página).
// Chamada sequencialmente pelo frontend até concluir todo o catálogo.

import { createClient } from "npm:@supabase/supabase-js";
import { decrypt } from "../sync-erp/crypto.ts";
import { getMaxDataToken, maxdataGet } from "../sync-erp/maxdata-client.ts";

interface LojaRow {
  id: string;
  emp_id: number;
  erp_base_url: string;
  terminal_encrypted: string;
}

interface MaxDataProduto {
  id: number;
  codigo?: string;
  codigoFab?: string;
  descricao?: string;
  nome?: string;
  grupoId?: number;
  grupo?: string;
  grupoNome?: string;
  subGrupo?: string;
  fabricante?: string;
  valorVenda?: number;
  precoVenda?: number;
  valor?: number;
  valorCusto?: number;
  custoFinal?: number;
  estoque?: number;
  ativo?: boolean;
  desativado?: boolean;
}

interface PaginaResponse {
  docs: MaxDataProduto[];
  pages: number;
  total: number;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json() as { lojaId: string; pagina?: number };
    const { lojaId, pagina = 1 } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Buscar dados da loja
    const { data: loja, error: lojaError } = await supabase
      .from("lojas")
      .select("id, emp_id, erp_base_url, terminal_encrypted")
      .eq("id", lojaId)
      .single();

    if (lojaError || !loja) {
      return new Response(
        JSON.stringify({ error: "Loja não encontrada" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const lojaRow = loja as LojaRow;

    // 2. Autenticar na API MaxData
    const terminal = await decrypt(lojaRow.terminal_encrypted);
    const token = await getMaxDataToken({
      baseUrl: lojaRow.erp_base_url,
      empId: lojaRow.emp_id,
      terminal,
    });

    // 3. Buscar página de produtos — apenas campos necessários para o dashboard
    const LIMIT = 100;
    const data = await maxdataGet<PaginaResponse>(
      token,
      lojaRow.erp_base_url,
      "/product",
      {
        page: String(pagina),
        limit: String(LIMIT),
        sincronizacao: "true",
      }
    );

    const produtos: MaxDataProduto[] = data.docs ?? [];
    const totalPaginas: number = data.pages ?? 1;
    const totalProdutos: number = data.total ?? 0;

    console.log(
      `[sync-produtos] Loja ${lojaId}: página ${pagina}/${totalPaginas}, ` +
      `${produtos.length} produtos`
    );

    // 4. Mapear e salvar — somente campos necessários (economizar espaço no banco)
    if (produtos.length > 0) {
      const agora = new Date().toISOString();
      const rows = produtos.map((p) => ({
        loja_id: lojaId,
        external_id: p.id,
        codigo: p.codigoFab ?? null,
        nome: p.descricao ?? p.nome ?? "Produto",
        grupo_id: p.grupoId ?? null,
        grupo_nome: p.grupo ?? null,
        sub_grupo_nome: p.subGrupo ?? null,
        fabricante: p.fabricante ?? null,
        preco_venda: p.valorVenda ?? p.precoVenda ?? null,
        valor_custo: p.valorCusto ?? p.custoFinal ?? null,
        estoque_atual: p.estoque ?? 0,
        ativo: !p.desativado ?? true,
        sincronizado_em: agora,
      }));

      const { error } = await supabase
        .from("produtos")
        .upsert(rows, { onConflict: "loja_id,external_id" });

      if (error) throw new Error(error.message);
    }

    const concluido = pagina >= totalPaginas;

    // 5. Atualizar progresso na tabela sync_inicial
    await supabase
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

    return new Response(
      JSON.stringify({
        pagina_processada: pagina,
        produtos_salvos: produtos.length,
        proxima_pagina: concluido ? null : pagina + 1,
        total_paginas: totalPaginas,
        total_produtos: totalProdutos,
        concluido,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[sync-produtos] Erro:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
