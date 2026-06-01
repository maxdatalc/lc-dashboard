// Rota de gerenciamento da fila de sync inicial
// POST — enfileira jobs por mês para uma loja
// GET  — retorna status atual dos jobs de uma loja

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";

interface SyncQueueInsert {
  loja_id: string;
  tipo: string;
  data_ini: string;
  data_fim: string;
  pagina_atual: number;
  status: string;
  metadata?: Record<string, unknown>;
}

// Divide um período em jobs mensais para granularidade de progresso
function gerarJobsPorMes(
  lojaId: string,
  dataInicial: string,
  dataFinal: string,
  tipo: string
): SyncQueueInsert[] {
  const jobs: SyncQueueInsert[] = [];
  const d = new Date(dataInicial + "T12:00:00");
  const f = new Date(dataFinal + "T12:00:00");

  while (d <= f) {
    const ano = d.getFullYear();
    const mes = d.getMonth();

    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);

    const dataIni =
      primeiroDia < new Date(dataInicial + "T12:00:00")
        ? dataInicial
        : primeiroDia.toISOString().split("T")[0];

    const dataFim =
      ultimoDia > f
        ? dataFinal
        : ultimoDia.toISOString().split("T")[0];

    jobs.push({
      loja_id: lojaId,
      tipo,
      data_ini: dataIni,
      data_fim: dataFim,
      pagina_atual: 1,
      status: "pendente",
    });

    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
  }

  return jobs;
}

// ── POST: enfileirar jobs de sync ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const admin = await isSystemAdmin(user.id);
    if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const body = await req.json() as {
      lojaId: string;
      dataInicial: string;
      dataFinal: string;
      tipo?: string;
    };
    const { lojaId, dataInicial, dataFinal, tipo = "vendas" } = body;

    if (!lojaId || !dataInicial || !dataFinal) {
      return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Caso especial: sync completo — enfileira todos os 4 tipos de uma vez
    if (tipo === "completo") {
      const { data: lojaInfo } = await adminClient
        .from("lojas")
        .select("sync_services_enabled")
        .eq("id", lojaId)
        .single();

      // Cancelar TODOS os jobs pendentes desta loja (todos os tipos)
      await adminClient
        .from("sync_queue")
        .update({ status: "cancelado", atualizado_em: new Date().toISOString() })
        .eq("loja_id", lojaId)
        .in("status", ["pendente"]);

      const jobsVendas = gerarJobsPorMes(lojaId, dataInicial, dataFinal, "vendas");
      const jobsOS = lojaInfo?.sync_services_enabled
        ? gerarJobsPorMes(lojaId, dataInicial, dataFinal, "os")
        : [];

      const jobProdutos: SyncQueueInsert[] = [{
        loja_id: lojaId,
        tipo: "produtos",
        data_ini: dataInicial,
        data_fim: dataFinal,
        pagina_atual: 1,
        status: "pendente",
      }];

      const jobItens: SyncQueueInsert[] = [{
        loja_id: lojaId,
        tipo: "itens",
        data_ini: dataInicial,
        data_fim: dataFinal,
        pagina_atual: 1,
        status: "pendente",
        metadata: { offset: 0 },
      }];

      const todosJobs = [...jobsVendas, ...jobsOS, ...jobProdutos, ...jobItens];

      const { error: insertErr } = await adminClient
        .from("sync_queue")
        .insert(todosJobs);

      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }

      return NextResponse.json({
        sucesso: true,
        jobs_criados: todosJobs.length,
        mensagem:
          `Sync completo enfileirado: ${jobsVendas.length} meses de vendas` +
          (jobsOS.length > 0 ? ` + ${jobsOS.length} meses de OS` : "") +
          " + produtos + itens",
      });
    }

    // Cancelar jobs pendentes anteriores para esta loja/tipo (evitar duplicatas)
    await adminClient
      .from("sync_queue")
      .update({ status: "cancelado", atualizado_em: new Date().toISOString() })
      .eq("loja_id", lojaId)
      .eq("tipo", tipo)
      .in("status", ["pendente"]);

    // Criar novos jobs mensais
    const jobs = gerarJobsPorMes(lojaId, dataInicial, dataFinal, tipo);

    const { error } = await adminClient
      .from("sync_queue")
      .insert(jobs);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      sucesso: true,
      jobs_criados: jobs.length,
      mensagem: `${jobs.length} ${jobs.length === 1 ? "mês enfileirado" : "meses enfileirados"}. Processamento iniciará em até 1 minuto.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── GET: status dos jobs de uma loja ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const lojaId = req.nextUrl.searchParams.get("lojaId");
    if (!lojaId) return NextResponse.json({ error: "lojaId obrigatório" }, { status: 400 });

    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from("sync_queue")
      .select("*")
      .eq("loja_id", lojaId)
      .not("status", "eq", "cancelado")
      .order("data_ini", { ascending: true });

    const jobs = data ?? [];
    const total = jobs.length;
    const concluidos = jobs.filter((j) => j.status === "concluido").length;
    const erros = jobs.filter((j) => j.status === "erro").length;
    const pendentes = jobs.filter((j) => j.status === "pendente").length;
    const processando = jobs.filter((j) => j.status === "processando").length;
    const registros = jobs.reduce(
      (s, j) => s + ((j.registros_salvos as number) ?? 0),
      0
    );

    return NextResponse.json({
      jobs,
      resumo: { total, concluidos, erros, pendentes, processando, registros },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
