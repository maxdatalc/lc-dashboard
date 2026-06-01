// Edge Function: sync-erp-inicial
// Processa UM intervalo de datas (tipicamente uma semana) por invocação.
// Chamada sequencialmente pelo frontend (SyncPeriodoModal) semana por semana.
// Usa filtro de data da API MaxData — sem buscar tudo e filtrar no JS.

import { createClient } from "npm:@supabase/supabase-js";
import { decrypt } from "../sync-erp/crypto.ts";
import { getMaxDataToken, fetchAllPages, fetchPageByPage } from "../sync-erp/maxdata-client.ts";

interface LojaRow {
  id: string;
  emp_id: number;
  erp_base_url: string;
  terminal_encrypted: string;
  sync_services_enabled: boolean;
}

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    // Body: { lojaId, dataInicial: "YYYY-MM-DD", dataFinal: "YYYY-MM-DD" }
    const body = await req.json() as {
      lojaId: string;
      dataInicial: string;
      dataFinal: string;
    };
    const { lojaId, dataInicial, dataFinal } = body;

    if (!lojaId || !dataInicial || !dataFinal) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: lojaId, dataInicial, dataFinal" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Buscar dados da loja
    const { data: loja, error: lojaError } = await supabase
      .from("lojas")
      .select("id, emp_id, erp_base_url, terminal_encrypted, sync_services_enabled")
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

    // 3. Construir filtros ISO com timezone Brasil
    const dataInicialISO = `${dataInicial}T00:00:00-03:00`;
    const dataFinalISO = `${dataFinal}T23:59:59-03:00`;

    console.log(`[sync-inicial] ${dataInicial} → ${dataFinal}`);

    // 4. Buscar mapa de CFOPs antecipadamente (pequeno, cabe em memória)
    const { data: cfopRows } = await supabase
      .from("cfop_classificacoes")
      .select("cfop, tipo, subtipo");

    const cfopMap = new Map<number, { tipo: string; subtipo: string | null }>(
      ((cfopRows ?? []) as CfopRow[]).map((r) => [
        r.cfop,
        { tipo: r.tipo, subtipo: r.subtipo },
      ])
    );

    // 5. Processar vendas página por página — sem acumular em memória
    let vendasSalvasNestePeriodo = 0;
    const agora = new Date().toISOString();

    // Callback: recebe 50 vendas, salva no banco, descarta da memória
    const processarPagina = async (
      docs: MaxDataVenda[],
      pageNum: number,
      totalPages: number
    ) => {
      console.log(`[sync-inicial] Página ${pageNum}/${totalPages}: ${docs.length} vendas`);

      const rows = docs.map((v) => {
        const cl = v.cfop ? cfopMap.get(v.cfop) : undefined;
        return {
          loja_id: lojaId,
          external_id: v.id,
          source: "sale",
          numero_venda: String(v.id),
          data_venda: (v.fechamento ?? v.abertura ?? dataInicialISO).split("T")[0],
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

      // Salvar em lotes de 100 para economizar memória
      for (let i = 0; i < unicos.length; i += 100) {
        const lote = unicos.slice(i, i + 100);
        const { error } = await supabase
          .from("vendas")
          .upsert(lote, { onConflict: "loja_id,external_id,source" });
        if (error) throw new Error(`Upsert erro página ${pageNum}: ${error.message}`);
        await sleep(30);
      }

      vendasSalvasNestePeriodo += unicos.length;
    };

    // Buscar com filtro de data da API — processa página por página
    const { totalProcessado } = await fetchPageByPage<MaxDataVenda>(
      token,
      lojaRow.erp_base_url,
      "/sale",
      { dataInicial: dataInicialISO, dataFinal: dataFinalISO },
      processarPagina,
      500
    );

    // Fallback: se API ignorou o filtro e retornou 0, busca tudo e filtra no JS
    // Limita a 200 páginas para não ultrapassar o timeout
    if (totalProcessado === 0) {
      console.log(`[sync-inicial] Filtro retornou 0 — ativando fallback sem filtro`);
      const todas = await fetchAllPages<MaxDataVenda>(
        token,
        lojaRow.erp_base_url,
        "/sale",
        {},
        200
      );
      const vendasFiltradas = todas.filter((v) => {
        const raw = v.fechamento ?? v.abertura;
        if (!raw) return false;
        const dataVenda = new Date(raw).toISOString().split("T")[0];
        return dataVenda >= dataInicial && dataVenda <= dataFinal;
      });
      if (vendasFiltradas.length > 0) {
        await processarPagina(vendasFiltradas, 1, 1);
      }
    }

    console.log(`[sync-inicial] ${dataInicial}→${dataFinal}: ${vendasSalvasNestePeriodo} vendas salvas`);

    // 7. Sincronizar Ordens de Serviço do período (se habilitado para esta loja)
    if (lojaRow.sync_services_enabled) {
      console.log(`[sync-inicial] Loja ${lojaId}: buscando OS para ${dataInicial}→${dataFinal}`);

      let todasOs = await fetchAllPages<Record<string, unknown>>(
        token,
        lojaRow.erp_base_url,
        "/serviceorder",
        { dataInicial: dataInicialISO, dataFinal: dataFinalISO },
        300
      );

      // Fallback sem filtro de data
      if (todasOs.length === 0) {
        const todas = await fetchAllPages<Record<string, unknown>>(
          token,
          lojaRow.erp_base_url,
          "/serviceorder",
          {},
          300
        );
        todasOs = todas.filter((os) => {
          const raw = (os.dataFechamento ?? os.dataAbertura) as string | undefined;
          if (!raw) return false;
          const dataOs = new Date(raw).toISOString().split("T")[0];
          return dataOs >= dataInicial && dataOs <= dataFinal;
        });
      }

      console.log(`[sync-inicial] ${dataInicial}→${dataFinal}: ${todasOs.length} OS encontradas`);

      if (todasOs.length > 0) {
        const agora = new Date().toISOString();

        interface OsRow {
          loja_id: string;
          external_id: number;
          numero_venda: string;
          data_venda: string;
          cliente_external_id: number | null;
          cliente_nome: string | null;
          cpf_cnpj: string | null;
          valor_bruto: number;
          valor_desconto: number;
          valor_total: number;
          status: string;
          cfop: number;
          tipo: string;
          subtipo: string;
          source: string;
          os_equipamento: string | null;
          os_placa: string | null;
          sincronizado_em: string;
        }

        const osRows: OsRow[] = todasOs.map((os) => ({
          loja_id: lojaId,
          external_id: os.id as number,
          numero_venda: `OS-${os.id as number}`,
          data_venda: ((os.dataFechamento ?? os.dataAbertura ?? dataInicialISO) as string).split("T")[0],
          cliente_external_id: (os.clienteId as number) ?? null,
          cliente_nome: (os.clienteNome as string) ?? null,
          cpf_cnpj: (os.cpf as string) ?? null,
          valor_bruto: (os.totalNf ?? os.valorTotalServico ?? 0) as number,
          valor_desconto: (os.valorTotalDesconto ?? 0) as number,
          valor_total: (os.totalNf ?? os.valorTotalServico ?? 0) as number,
          status: ((os.status ?? os.statusOs ?? "pendente") as string).toLowerCase(),
          cfop: 5933,
          tipo: "venda",
          subtipo: "servico",
          source: "os",
          os_equipamento: (os.equipamento as string) ?? null,
          os_placa: (os.placa as string) ?? null,
          sincronizado_em: agora,
        }));

        const seenOs = new Set<number>();
        const osUnicos = osRows.filter((r) => {
          if (seenOs.has(r.external_id)) return false;
          seenOs.add(r.external_id);
          return true;
        });

        for (let i = 0; i < osUnicos.length; i += 200) {
          const lote = osUnicos.slice(i, i + 200);
          const { error: osErr } = await supabase
            .from("vendas")
            .upsert(lote, { onConflict: "loja_id,external_id,source" });
          if (osErr) console.error(`[sync-inicial] Erro OS lote ${i}:`, osErr.message);
          await sleep(50);
        }

        // Itens embutidos nas OS
        for (const os of todasOs) {
          const osExternalId = os.id as number;
          const itens = os.itens as Array<Record<string, unknown>> | undefined;
          if (!itens || itens.length === 0) continue;

          const itensMapped = itens.map((item) => ({
            loja_id: lojaId,
            venda_external_id: osExternalId,
            produto_external_id: (item.produtoId as number) ?? null,
            produto_nome: (item.produtoDescricao as string) ?? "Serviço",
            quantidade: (item.qtde as number) ?? 0,
            valor_unitario: (item.valor as number) ?? 0,
            valor_desconto: (item.desconto ?? item.valorDesconto ?? 0) as number,
            valor_total: ((item.qtde as number) ?? 0) * ((item.valor as number) ?? 0),
          }));

          await supabase
            .from("venda_itens")
            .upsert(itensMapped, { onConflict: "loja_id,venda_external_id,produto_external_id" });
          await sleep(100);
        }

        vendasSalvasNestePeriodo += osUnicos.length;
      }
    }

    // 8. Contar total de vendas salvas para esta loja e atualizar progresso
    const { count: totalVendasSalvas } = await supabase
      .from("vendas")
      .select("id", { count: "exact", head: true })
      .eq("loja_id", lojaId);

    await supabase
      .from("sync_inicial")
      .upsert(
        {
          loja_id: lojaId,
          status: "em_andamento",
          mes_atual: dataInicial,
          vendas_salvas: totalVendasSalvas ?? 0,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "loja_id" }
      );

    return new Response(
      JSON.stringify({
        periodo_processado: `${dataInicial} → ${dataFinal}`,
        vendas_salvas: vendasSalvasNestePeriodo,
        concluido: true,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[sync-inicial] Erro:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
