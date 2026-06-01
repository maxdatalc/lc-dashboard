// Edge Function: sync-queue-processor
// Chamada pelo pg_cron a cada 1 minuto.
// Pega até 3 jobs pendentes e processa 12 páginas cada (~48s por job).

import { createClient } from "npm:@supabase/supabase-js";
import { decrypt } from "../sync-erp/crypto.ts";
import { getMaxDataToken } from "../sync-erp/maxdata-client.ts";

const PAGE_LIMIT = 12;        // páginas por execução (~48s)
const MAX_JOBS_PARALELOS = 3; // máx clientes simultâneos
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SyncJob {
  id: string;
  loja_id: string;
  tipo: string;
  data_ini: string;
  data_fim: string;
  pagina_atual: number;
  total_paginas: number | null;
  registros_salvos: number;
  status: string;
}

interface CfopRow {
  cfop: number;
  tipo: string;
  subtipo: string | null;
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

interface LojaRow {
  id: string;
  emp_id: number;
  erp_base_url: string;
  terminal_encrypted: string;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Buscar próximos jobs pendentes ou em processamento
  const { data: jobs, error } = await supabase
    .from("sync_queue")
    .select("*")
    .in("status", ["pendente", "processando"])
    .order("criado_em", { ascending: true })
    .limit(MAX_JOBS_PARALELOS);

  if (error || !jobs?.length) {
    console.log("[sync-queue] Nenhum job pendente");
    return new Response(JSON.stringify({ processados: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`[sync-queue] Processando ${jobs.length} job(s)`);

  // 2. Buscar mapa de CFOPs uma vez (pequeno, cabe em memória)
  const { data: cfopRows } = await supabase
    .from("cfop_classificacoes")
    .select("cfop, tipo, subtipo");

  const cfopMap = new Map<number, { tipo: string; subtipo: string | null }>(
    ((cfopRows ?? []) as CfopRow[]).map((r) => [
      r.cfop,
      { tipo: r.tipo, subtipo: r.subtipo },
    ])
  );

  // 3. Processar cada job em paralelo
  await Promise.all(
    (jobs as SyncJob[]).map((job) => processarJob(supabase, job, cfopMap))
  );

  return new Response(
    JSON.stringify({ processados: jobs.length }),
    { headers: { "Content-Type": "application/json" } }
  );
});

async function processarJob(
  supabase: ReturnType<typeof createClient>,
  job: SyncJob,
  cfopMap: Map<number, { tipo: string; subtipo: string | null }>
) {
  console.log(
    `[sync-queue] Job ${job.id}: loja ${job.loja_id}, tipo ${job.tipo}, ` +
    `período ${job.data_ini}→${job.data_fim}, página ${job.pagina_atual}`
  );

  // Marcar como processando para evitar dupla execução
  await supabase
    .from("sync_queue")
    .update({ status: "processando", atualizado_em: new Date().toISOString() })
    .eq("id", job.id);

  try {
    // Buscar dados da loja
    const { data: loja } = await supabase
      .from("lojas")
      .select("id, emp_id, erp_base_url, terminal_encrypted")
      .eq("id", job.loja_id)
      .single();

    if (!loja) throw new Error("Loja não encontrada");

    const lojaRow = loja as LojaRow;

    // Autenticar na API MaxData
    const terminal = await decrypt(lojaRow.terminal_encrypted);
    const token = await getMaxDataToken({
      baseUrl: lojaRow.erp_base_url,
      empId: lojaRow.emp_id,
      terminal,
    });

    const dataInicialISO = `${job.data_ini}T00:00:00-03:00`;
    const dataFinalISO = `${job.data_fim}T23:59:59-03:00`;
    const agora = new Date().toISOString();

    let page = job.pagina_atual;
    let totalPages = job.total_paginas ?? 999999;
    let registrosSalvosNestChunk = 0;
    let paginasProcessadas = 0;

    // Processar PAGE_LIMIT páginas nesta execução
    while (page <= totalPages && paginasProcessadas < PAGE_LIMIT) {
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
        console.error(`[sync-queue] Job ${job.id} página ${page}: HTTP ${res.status}`);
        page++;
        paginasProcessadas++;
        continue;
      }

      const data = await res.json() as { docs: MaxDataVenda[]; pages: number };
      const docs: MaxDataVenda[] = data.docs ?? [];
      totalPages = data.pages ?? totalPages;

      if (docs.length === 0) break;

      // Mapear registros desta página
      const rows = docs.map((v) => {
        const cl = v.cfop ? cfopMap.get(v.cfop) : undefined;
        const raw = v.fechamento ?? v.abertura;
        const dataVenda =
          raw && raw.trim() !== "" ? raw.split("T")[0] : job.data_ini;

        return {
          loja_id: job.loja_id,
          external_id: v.id,
          source: "sale",
          numero_venda: String(v.id),
          data_venda: dataVenda,
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

      const { error: upsertErr } = await supabase
        .from("vendas")
        .upsert(unicos, { onConflict: "loja_id,external_id,source" });

      if (upsertErr) {
        console.error(`[sync-queue] Upsert erro:`, upsertErr.message);
      } else {
        registrosSalvosNestChunk += unicos.length;
      }

      console.log(`[sync-queue] Job ${job.id}: página ${page}/${totalPages}`);

      if (page >= totalPages) break;
      page++;
      paginasProcessadas++;
      await sleep(80);
    }

    // Verificar se o job foi concluído
    const concluido = page >= totalPages;
    const totalRegistros = job.registros_salvos + registrosSalvosNestChunk;

    // Avançar para a próxima página a ser processada no próximo ciclo
    const proximaPagina = concluido ? page : page + 1;

    await supabase
      .from("sync_queue")
      .update({
        status: concluido ? "concluido" : "pendente",
        pagina_atual: proximaPagina,
        total_paginas: totalPages,
        registros_salvos: totalRegistros,
        atualizado_em: new Date().toISOString(),
        ...(concluido ? { concluido_em: new Date().toISOString() } : {}),
      })
      .eq("id", job.id);

    // Atualizar progresso em sync_inicial
    await supabase
      .from("sync_inicial")
      .upsert(
        {
          loja_id: job.loja_id,
          status: concluido ? "concluido" : "em_andamento",
          mes_atual: job.data_ini,
          vendas_salvas: totalRegistros,
          atualizado_em: new Date().toISOString(),
          ...(concluido ? { concluido_em: new Date().toISOString() } : {}),
        },
        { onConflict: "loja_id" }
      );

    console.log(
      `[sync-queue] Job ${job.id}: ${concluido ? "CONCLUÍDO" : `pausado na página ${proximaPagina}`}` +
      ` — ${totalRegistros} registros`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sync-queue] Job ${job.id} ERRO:`, msg);

    await supabase
      .from("sync_queue")
      .update({
        status: "erro",
        erro: msg,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", job.id);
  }
}
