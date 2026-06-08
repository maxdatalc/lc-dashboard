"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";

async function verificarAdmin(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const admin = await isSystemAdmin(user.id);
  if (!admin) throw new Error("Acesso negado");
}

// ── Tipos seguros — sem credenciais ──────────────────────────────────────────

export interface SyncStatusLoja {
  loja_id: string;
  loja_name: string;
  tenant_name: string;
  sync_paused: boolean;
  sync_paused_at: string | null;
  sync_pause_reason: string | null;
  is_active: boolean;
  jobs_pendentes: number;
  jobs_processando: number;
  jobs_erro: number;
  job_atual: { tipo: string; offset: number | null; registros_salvos: number } | null;
  ultimo_erro: string | null;
  ultimo_tipo: string | null;
  ultimo_sync_sucesso: string | null;
  ultima_tentativa: string | null;
  ultimo_log: string | null;
}

export interface LogRecente {
  id: string;
  loja_id: string;
  status: string;
  tabela: string | null;
  inicio: string;
  fim: string | null;
  erro: string | null;
  total_registros: number | null;
}

// ── Listar status de sincronização de todas as lojas ─────────────────────────

export async function listarStatusSync(): Promise<SyncStatusLoja[]> {
  await verificarAdmin();
  const adminClient = createAdminClient();

  const { data: lojasRaw } = await adminClient
    .from("lojas")
    .select(
      "id, name, is_active, sync_paused, sync_paused_at, sync_pause_reason, tenants ( name )"
    )
    .order("name");

  if (!lojasRaw?.length) return [];

  const lojas = (lojasRaw ?? []) as unknown as Array<{
    id: string;
    name: string;
    is_active: boolean;
    sync_paused: boolean;
    sync_paused_at: string | null;
    sync_pause_reason: string | null;
    tenants: { name: string } | null;
  }>;

  const lojaIds = lojas.map((l) => l.id);

  const { data: jobsRaw } = await adminClient
    .from("sync_queue")
    .select("loja_id, tipo, status, registros_salvos, metadata, erro, atualizado_em")
    .in("loja_id", lojaIds)
    .neq("status", "concluido")
    .order("atualizado_em", { ascending: false });

  const jobs = (jobsRaw ?? []) as Array<{
    loja_id: string;
    tipo: string;
    status: string;
    registros_salvos: number;
    metadata: Record<string, unknown> | null;
    erro: string | null;
    atualizado_em: string;
  }>;

  const { data: logsSuccessRaw } = await adminClient
    .from("sync_log")
    .select("loja_id, fim")
    .in("loja_id", lojaIds)
    .in("status", ["concluido", "concluído"])
    .not("fim", "is", null)
    .order("fim", { ascending: false });

  const logsSuccess = (logsSuccessRaw ?? []) as Array<{
    loja_id: string;
    fim: string;
  }>;

  const { data: logsAllRaw } = await adminClient
    .from("sync_log")
    .select("loja_id, inicio, status")
    .in("loja_id", lojaIds)
    .order("inicio", { ascending: false });

  const logsAll = (logsAllRaw ?? []) as Array<{
    loja_id: string;
    inicio: string;
    status: string;
  }>;

  return lojas.map((loja) => {
    const lojaJobs = jobs.filter((j) => j.loja_id === loja.id);

    const jobAtual = lojaJobs.find((j) => j.status === "processando") ?? null;
    const jobsErro = lojaJobs.filter((j) => j.status === "erro");
    const jobsPendentes = lojaJobs.filter((j) => j.status === "pendente");
    const jobsProcessando = lojaJobs.filter((j) => j.status === "processando");

    const ultimoErro = jobsErro[0]?.erro ?? null;
    const ultimoTipo = lojaJobs[0]?.tipo ?? null;

    const ultimoSyncSucesso =
      logsSuccess.find((l) => l.loja_id === loja.id)?.fim ?? null;

    const ultimaTentativa =
      logsAll.find((l) => l.loja_id === loja.id)?.inicio ?? null;

    return {
      loja_id: loja.id,
      loja_name: loja.name,
      tenant_name: loja.tenants?.name ?? "—",
      sync_paused: loja.sync_paused ?? false,
      sync_paused_at: loja.sync_paused_at ?? null,
      sync_pause_reason: loja.sync_pause_reason ?? null,
      is_active: loja.is_active,
      jobs_pendentes: jobsPendentes.length,
      jobs_processando: jobsProcessando.length,
      jobs_erro: jobsErro.length,
      job_atual: jobAtual
        ? {
            tipo: jobAtual.tipo,
            offset: (jobAtual.metadata?.offset as number | null) ?? null,
            registros_salvos: jobAtual.registros_salvos,
          }
        : null,
      ultimo_erro: ultimoErro,
      ultimo_tipo: ultimoTipo,
      ultimo_sync_sucesso: ultimoSyncSucesso,
      ultima_tentativa: ultimaTentativa,
      ultimo_log: ultimaTentativa,
    };
  });
}

// ── Pausar sincronização de uma loja ─────────────────────────────────────────

export async function pausarSync(
  lojaId: string,
  motivo?: string
): Promise<{ error?: string }> {
  try {
    await verificarAdmin();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const adminClient = createAdminClient();

    await adminClient
      .from("lojas")
      .update({
        sync_paused: true,
        sync_paused_at: new Date().toISOString(),
        sync_paused_by: user!.id,
        sync_pause_reason: motivo ?? null,
      })
      .eq("id", lojaId);

    await adminClient.from("sync_log").insert({
      loja_id: lojaId,
      tabela: "admin_pause",
      status: "concluido",
      inicio: new Date().toISOString(),
      fim: new Date().toISOString(),
      erro: motivo ? `Pausado pelo admin: ${motivo}` : "Pausado pelo admin",
    });

    revalidatePath("/admin/sincronizacao");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao pausar" };
  }
}

// ── Retomar sincronização de uma loja ────────────────────────────────────────

export async function retomarSync(
  lojaId: string
): Promise<{ error?: string }> {
  try {
    await verificarAdmin();
    const adminClient = createAdminClient();

    await adminClient
      .from("lojas")
      .update({
        sync_paused: false,
        sync_paused_at: null,
        sync_paused_by: null,
        sync_pause_reason: null,
      })
      .eq("id", lojaId);

    await adminClient.from("sync_log").insert({
      loja_id: lojaId,
      tabela: "admin_resume",
      status: "concluido",
      inicio: new Date().toISOString(),
      fim: new Date().toISOString(),
    });

    revalidatePath("/admin/sincronizacao");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao retomar" };
  }
}

// ── Buscar logs recentes de uma loja ─────────────────────────────────────────

export async function buscarLogsRecentes(
  lojaId: string,
  limite = 20
): Promise<LogRecente[]> {
  await verificarAdmin();
  const adminClient = createAdminClient();

  const { data } = await adminClient
    .from("sync_log")
    .select("id, loja_id, status, tabela, inicio, fim, erro, total_registros")
    .eq("loja_id", lojaId)
    .order("inicio", { ascending: false })
    .limit(limite);

  return (data ?? []) as LogRecente[];
}
