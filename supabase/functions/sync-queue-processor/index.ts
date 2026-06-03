// Edge Function: sync-queue-processor
// Chamada pelo pg_cron a cada 1 minuto.
// Pega até 3 jobs pendentes e processa cada um conforme o tipo:
// vendas | os | produtos | itens

import { createClient } from "npm:@supabase/supabase-js";
import { decrypt } from "../sync-erp/crypto.ts";
import { getMaxDataToken } from "../sync-erp/maxdata-client.ts";

const PAGE_LIMIT = 12;        // páginas por execução de vendas/OS/produtos (~48s)
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
  metadata?: Record<string, unknown>;
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
  atendenteId?: number;
}

interface LojaRow {
  id: string;
  emp_id: number;
  erp_base_url: string;
  terminal_encrypted: string;
  sync_services_enabled: boolean;
}

// ── Helper: atualizar job como concluído ou pendente (para continuar) ─────────

async function atualizarJob(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  concluido: boolean,
  opts: {
    proximaPagina?: number;
    totalPaginas?: number;
    totalRegistros: number;
    metadata?: Record<string, unknown>;
  }
) {
  await supabase
    .from("sync_queue")
    .update({
      status: concluido ? "concluido" : "pendente",
      ...(opts.proximaPagina !== undefined ? { pagina_atual: opts.proximaPagina } : {}),
      ...(opts.totalPaginas !== undefined ? { total_paginas: opts.totalPaginas } : {}),
      registros_salvos: opts.totalRegistros,
      ...(opts.metadata ? { metadata: opts.metadata } : {}),
      atualizado_em: new Date().toISOString(),
      ...(concluido ? { concluido_em: new Date().toISOString() } : {}),
    })
    .eq("id", jobId);
}

// ── Entry point ────────────────────────────────────────────────────────────────

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Resetar jobs travados em 'processando' há mais de 10 minutos
  // Ocorre quando a Edge Function é interrompida — o pg_cron retoma de onde parou
  const dezMinAtras = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await supabase
    .from("sync_queue")
    .update({ status: "pendente", atualizado_em: new Date().toISOString() })
    .eq("status", "processando")
    .lt("atualizado_em", dezMinAtras);
  console.log("[sync-queue] Jobs travados resetados para pendente");

  // 2. Buscar próximos jobs pendentes ou em processamento
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

// ── Dispatcher ─────────────────────────────────────────────────────────────────

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
    const { data: loja } = await supabase
      .from("lojas")
      .select("id, emp_id, erp_base_url, terminal_encrypted, sync_services_enabled")
      .eq("id", job.loja_id)
      .single();

    if (!loja) throw new Error("Loja não encontrada");

    const lojaRow = loja as LojaRow;
    const terminal = await decrypt(lojaRow.terminal_encrypted);
    const token = await getMaxDataToken({
      baseUrl: lojaRow.erp_base_url,
      empId: lojaRow.emp_id,
      terminal,
    });

    switch (job.tipo) {
      case "vendas":
        await processarVendas(supabase, job, lojaRow, token, cfopMap);
        break;
      case "os":
        await processarOS(supabase, job, lojaRow, token);
        break;
      case "produtos":
        await processarProdutos(supabase, job, lojaRow, token);
        break;
      case "itens":
        await processarItens(supabase, job, lojaRow, token);
        break;
      case "atendente":
        await processarAtendente(supabase, job, lojaRow, token);
        break;
      default:
        throw new Error(`Tipo desconhecido: ${job.tipo}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sync-queue] Job ${job.id} ERRO:`, msg);
    await supabase
      .from("sync_queue")
      .update({ status: "erro", erro: msg, atualizado_em: new Date().toISOString() })
      .eq("id", job.id);
  }
}

// ── Processador: vendas ────────────────────────────────────────────────────────

async function processarVendas(
  supabase: ReturnType<typeof createClient>,
  job: SyncJob,
  loja: LojaRow,
  token: string,
  cfopMap: Map<number, { tipo: string; subtipo: string | null }>
) {
  const dataInicialISO = `${job.data_ini}T00:00:00-03:00`;
  const dataFinalISO = `${job.data_fim}T23:59:59-03:00`;
  const agora = new Date().toISOString();

  let page = job.pagina_atual;
  let totalPages = job.total_paginas ?? 999999;
  let registrosSalvos = 0;
  let paginasProcessadas = 0;

  while (page <= totalPages && paginasProcessadas < PAGE_LIMIT) {
    const url = new URL(`${loja.erp_base_url}/v2/sale`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", "50");
    url.searchParams.set("dataInicial", dataInicialISO);
    url.searchParams.set("dataFinal", dataFinalISO);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.error(`[sync-queue] Vendas job ${job.id} página ${page}: HTTP ${res.status}`);
      page++;
      paginasProcessadas++;
      continue;
    }

    const data = await res.json() as { docs: MaxDataVenda[]; pages: number };
    const docs: MaxDataVenda[] = data.docs ?? [];
    totalPages = data.pages ?? totalPages;

    if (docs.length === 0) break;

    const rows = docs.map((v) => {
      const cl = v.cfop ? cfopMap.get(v.cfop) : undefined;
      const raw = v.fechamento ?? v.abertura;
      const dataVenda = raw && raw.trim() !== "" ? raw.split("T")[0] : job.data_ini;
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
      console.error(`[sync-queue] Upsert vendas:`, upsertErr.message);
    } else {
      registrosSalvos += unicos.length;
    }

    console.log(`[sync-queue] Vendas job ${job.id}: página ${page}/${totalPages}`);

    if (page >= totalPages) break;
    page++;
    paginasProcessadas++;
    await sleep(80);
  }

  const concluido = page >= totalPages;
  const totalRegistros = job.registros_salvos + registrosSalvos;

  await atualizarJob(supabase, job.id, concluido, {
    proximaPagina: concluido ? page : page + 1,
    totalPaginas: totalPages,
    totalRegistros,
  });

  // Atualizar sync_inicial para compatibilidade
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
    `[sync-queue] Vendas job ${job.id}: ${concluido ? "CONCLUÍDO" : `pausado na pág. ${page + 1}`}` +
    ` — ${totalRegistros} registros`
  );
}

// ── Processador: OS (Ordens de Serviço) ───────────────────────────────────────

async function processarOS(
  supabase: ReturnType<typeof createClient>,
  job: SyncJob,
  loja: LojaRow,
  token: string
) {
  if (!loja.sync_services_enabled) {
    await atualizarJob(supabase, job.id, true, { totalRegistros: 0 });
    console.log(`[sync-queue] OS job ${job.id}: OS desabilitada — concluído sem processar`);
    return;
  }

  const dataInicialISO = `${job.data_ini}T00:00:00-03:00`;
  const dataFinalISO = `${job.data_fim}T23:59:59-03:00`;
  const agora = new Date().toISOString();

  let page = job.pagina_atual;
  let totalPages = job.total_paginas ?? 999999;
  let registrosSalvos = 0;
  let paginasProcessadas = 0;

  while (page <= totalPages && paginasProcessadas < PAGE_LIMIT) {
    const url = new URL(`${loja.erp_base_url}/v2/serviceorder`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", "50");
    url.searchParams.set("dataInicial", dataInicialISO);
    url.searchParams.set("dataFinal", dataFinalISO);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) { page++; paginasProcessadas++; continue; }

    // deno-lint-ignore no-explicit-any
    const data = await res.json() as { docs: any[]; pages: number };
    const docs = data.docs ?? [];
    totalPages = data.pages ?? totalPages;

    if (docs.length === 0) break;

    // deno-lint-ignore no-explicit-any
    const rows = docs.map((os: any) => ({
      loja_id: job.loja_id,
      external_id: os.id as number,
      source: "os",
      numero_venda: `OS-${os.id as number}`,
      data_venda: ((os.dataFechamento ?? os.dataAbertura ?? job.data_ini) as string).split("T")[0],
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
      os_equipamento: (os.equipamento as string) ?? null,
      os_placa: (os.placa as string) ?? null,
      sincronizado_em: agora,
    }));

    const seen = new Set<number>();
    // deno-lint-ignore no-explicit-any
    const unicos = rows.filter((r: any) => {
      if (seen.has(r.external_id)) return false;
      seen.add(r.external_id);
      return true;
    });

    const { error } = await supabase
      .from("vendas")
      .upsert(unicos, { onConflict: "loja_id,external_id,source" });

    if (!error) registrosSalvos += unicos.length;

    // Processar itens embutidos nas OS
    for (const os of docs) {
      // deno-lint-ignore no-explicit-any
      const itens = os.itens as any[] | undefined;
      if (!itens?.length) continue;

      // deno-lint-ignore no-explicit-any
      const itensMapped = itens.map((item: any) => ({
        loja_id: job.loja_id,
        venda_external_id: os.id as number,
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
      await sleep(50);
    }

    if (page >= totalPages) break;
    page++;
    paginasProcessadas++;
    await sleep(80);
  }

  const concluido = page >= totalPages;
  const totalRegistros = job.registros_salvos + registrosSalvos;

  await atualizarJob(supabase, job.id, concluido, {
    proximaPagina: concluido ? page : page + 1,
    totalPaginas: totalPages,
    totalRegistros,
  });

  console.log(
    `[sync-queue] OS job ${job.id}: ${concluido ? "CONCLUÍDO" : `pausado na pág. ${page + 1}`}` +
    ` — ${totalRegistros} OS`
  );
}

// ── Processador: produtos ──────────────────────────────────────────────────────

async function processarProdutos(
  supabase: ReturnType<typeof createClient>,
  job: SyncJob,
  loja: LojaRow,
  token: string
) {
  const LIMIT = 100;
  let page = job.pagina_atual;
  let totalPages = job.total_paginas ?? 999999;
  let registrosSalvos = 0;
  let paginasProcessadas = 0;
  const agora = new Date().toISOString();

  while (page <= totalPages && paginasProcessadas < PAGE_LIMIT) {
    const url = new URL(`${loja.erp_base_url}/v2/product`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(LIMIT));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) { page++; paginasProcessadas++; continue; }

    // deno-lint-ignore no-explicit-any
    const data = await res.json() as { docs: any[]; pages: number };
    const docs = data.docs ?? [];
    totalPages = data.pages ?? totalPages;

    if (docs.length === 0) break;

    // deno-lint-ignore no-explicit-any
    const rows = docs.map((p: any) => ({
      loja_id: job.loja_id,
      external_id: p.id as number,
      codigo: (p.codigoFab as string) ?? null,
      nome: (p.descricao as string) ?? "Produto",
      grupo_id: (p.grupoId as number) ?? null,
      grupo_nome: (p.grupo as string) ?? null,
      sub_grupo_nome: (p.subGrupo as string) ?? null,
      fabricante: (p.fabricante as string) ?? null,
      preco_venda: (p.valorVenda as number) ?? null,
      valor_custo: (p.valorCusto as number) ?? null,
      estoque_atual: (p.estoque as number) ?? 0,
      ativo: !(p.desativado as boolean),
      sincronizado_em: agora,
    }));

    const { error } = await supabase
      .from("produtos")
      .upsert(rows, { onConflict: "loja_id,external_id" });

    if (!error) registrosSalvos += rows.length;

    console.log(`[sync-queue] Produtos job ${job.id}: página ${page}/${totalPages}`);

    if (page >= totalPages) break;
    page++;
    paginasProcessadas++;
    await sleep(80);
  }

  const concluido = page >= totalPages;
  const totalRegistros = job.registros_salvos + registrosSalvos;

  await atualizarJob(supabase, job.id, concluido, {
    proximaPagina: concluido ? page : page + 1,
    totalPaginas: totalPages,
    totalRegistros,
  });

  console.log(
    `[sync-queue] Produtos job ${job.id}: ${concluido ? "CONCLUÍDO" : `pausado na pág. ${page + 1}`}` +
    ` — ${totalRegistros} produtos`
  );
}

// ── Processador: itens e pagamentos ───────────────────────────────────────────

async function processarItens(
  supabase: ReturnType<typeof createClient>,
  job: SyncJob,
  loja: LojaRow,
  token: string
) {
  const BATCH_SIZE = 100;
  const DELAY_ENTRE_VENDAS = 100;

  // Retomar do offset salvo no metadata
  const offset = (job.metadata?.offset as number) ?? ((job.pagina_atual - 1) * BATCH_SIZE);

  // Buscar lote de vendas para processar
  const { data: vendas } = await supabase
    .from("vendas")
    .select("external_id, source")
    .eq("loja_id", job.loja_id)
    .eq("source", "sale")
    .order("external_id", { ascending: true })
    .range(offset, offset + BATCH_SIZE - 1);

  if (!vendas?.length) {
    await atualizarJob(supabase, job.id, true, { totalRegistros: job.registros_salvos });
    console.log(`[sync-queue] Itens job ${job.id}: sem mais vendas — CONCLUÍDO`);
    return;
  }

  let itensSalvos = 0;
  let pagamentosSalvos = 0;

  for (const venda of vendas) {
    const externalId = venda.external_id as number;

    try {
      // Buscar itens
      const itensRes = await fetch(
        `${loja.erp_base_url}/v2/sale/${externalId}/items`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) }
      );

      if (itensRes.ok) {
        // deno-lint-ignore no-explicit-any
        const raw = await itensRes.json() as any;
        const docs = raw.docs ?? raw.data ?? [];

        if (docs.length > 0) {
          // deno-lint-ignore no-explicit-any
          const itens = docs.map((item: any) => {
            const qtde = (item.qtde ?? item.vdiQtde ?? 0) as number;
            const valor = (item.valor ?? item.vdiValor ?? 0) as number;
            const desconto = (item.valorDesconto ?? item.vdiValorDesconto ?? 0) as number;
            return {
              loja_id: job.loja_id,
              venda_external_id: externalId,
              produto_external_id: (item.produtoId as number) ?? null,
              produto_nome: (item.descricaoProduto ?? item.vdiProNome ?? null) as string | null,
              quantidade: qtde,
              valor_unitario: valor,
              valor_desconto: desconto,
              valor_total: qtde * valor - desconto,
            };
          // deno-lint-ignore no-explicit-any
          }).filter((i: any) => i.produto_nome !== null && i.produto_nome !== "");

          if (itens.length > 0) {
            await supabase.from("venda_itens").delete()
              .eq("loja_id", job.loja_id).eq("venda_external_id", externalId);
            const { error } = await supabase.from("venda_itens").insert(itens);
            if (!error) itensSalvos += itens.length;
          }
        }
      }

      // Buscar pagamentos
      const pgtoRes = await fetch(
        `${loja.erp_base_url}/v2/sale/${externalId}/payment`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) }
      );

      if (pgtoRes.ok) {
        // deno-lint-ignore no-explicit-any
        const raw = await pgtoRes.json() as any;
        const docs = raw.docs ?? raw.data ?? [];

        if (docs.length > 0) {
          // deno-lint-ignore no-explicit-any
          const pgtos = docs
            .filter((p: any) => ((p.valor ?? 0) as number) > 0)
            // deno-lint-ignore no-explicit-any
            .map((p: any) => ({
              loja_id: job.loja_id,
              venda_external_id: externalId,
              forma_pagamento: (p.formaPgto ?? p.forma_pagamento ?? "Outra") as string,
              valor: (p.valor ?? 0) as number,
              parcelas: (p.qtdParcela ?? p.parcelas ?? 1) as number,
            }));

          if (pgtos.length > 0) {
            await supabase.from("venda_pagamentos").delete()
              .eq("loja_id", job.loja_id).eq("venda_external_id", externalId);
            const { error } = await supabase.from("venda_pagamentos").insert(pgtos);
            if (!error) pagamentosSalvos += pgtos.length;
          }
        }
      }
    } catch (err) {
      console.error(`[sync-queue] Erro itens venda ${externalId}:`, err);
    }

    await sleep(DELAY_ENTRE_VENDAS);
  }

  const proximoOffset = offset + vendas.length;
  const totalRegistros = job.registros_salvos + itensSalvos + pagamentosSalvos;

  // Se o lote veio cheio, há mais registros — senão chegou ao fim
  const temMais = vendas.length >= BATCH_SIZE;

  await atualizarJob(supabase, job.id, !temMais, {
    proximaPagina: temMais ? Math.floor(proximoOffset / BATCH_SIZE) + 1 : job.pagina_atual,
    totalRegistros,
    metadata: { offset: proximoOffset },
  });

  console.log(
    `[sync-queue] Itens job ${job.id}: offset ${offset}→${proximoOffset}` +
    ` | itens: ${itensSalvos} | pgtos: ${pagamentosSalvos}` +
    ` | ${temMais ? "continua" : "CONCLUÍDO"}`
  );
}

// ── Processador: atendente_id histórico ───────────────────────────────────────

// Busca GET /v2/sale/{id} para vendas sem atendente_id e atualiza o campo.
// Processa em lotes de 50 — retoma pelo offset salvo no metadata.
async function processarAtendente(
  supabase: ReturnType<typeof createClient>,
  job: SyncJob,
  loja: LojaRow,
  token: string
) {
  const BATCH_SIZE = 50;
  const DELAY_ENTRE_VENDAS = 150;

  const offset = (job.metadata?.offset as number) ?? 0;

  // Buscar lote de vendas SEM atendente_id
  const { data: vendas } = await supabase
    .from("vendas")
    .select("external_id")
    .eq("loja_id", job.loja_id)
    .eq("source", "sale")
    .is("atendente_id", null)
    .order("external_id", { ascending: true })
    .range(offset, offset + BATCH_SIZE - 1);

  if (!vendas?.length) {
    await atualizarJob(supabase, job.id, true, {
      totalRegistros: job.registros_salvos,
    });
    console.log(`[sync-queue] Atendente job ${job.id}: CONCLUÍDO`);
    return;
  }

  let atualizados = 0;

  for (const venda of vendas) {
    const externalId = venda.external_id as number;

    try {
      const res = await fetch(
        `${loja.erp_base_url}/v2/sale/${externalId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10_000),
        }
      );

      if (!res.ok) continue;

      // deno-lint-ignore no-explicit-any
      const data = await res.json() as any;
      const atendenteId = data.atendenteId as number | undefined;

      if (atendenteId && atendenteId > 0) {
        const { error } = await supabase
          .from("vendas")
          .update({ atendente_id: atendenteId })
          .eq("loja_id", job.loja_id)
          .eq("external_id", externalId)
          .eq("source", "sale");

        if (!error) atualizados++;
      }
    } catch (err) {
      console.error(`[sync-queue] Erro atendente venda ${externalId}:`, err);
    }

    await sleep(DELAY_ENTRE_VENDAS);
  }

  const proximoOffset = offset + vendas.length;
  const totalRegistros = job.registros_salvos + atualizados;
  const temMais = vendas.length >= BATCH_SIZE;

  await atualizarJob(supabase, job.id, !temMais, {
    proximaPagina: temMais
      ? Math.floor(proximoOffset / BATCH_SIZE) + 1
      : job.pagina_atual,
    totalRegistros,
    metadata: { offset: proximoOffset },
  });

  console.log(
    `[sync-queue] Atendente job ${job.id}: offset ${offset}→${proximoOffset}` +
    ` | atualizados: ${atualizados}` +
    ` | ${temMais ? "continua" : "CONCLUÍDO"}`
  );
}
