"use server";

import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { resolveTerminal, getTerminaisByLojaIds } from "@/lib/maxapi/terminal";

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  return { userId: user.id, supabase };
}

// ────────────────────────────────────────────────────────────────────────────
// Empresas (tenants)
// ────────────────────────────────────────────────────────────────────────────

export async function listEmpresasAdmin() {
  const { userId, supabase } = await getAuthContext();

  const { data: isAdmin } = await supabase.rpc("fs_is_admin", { _user_id: userId });
  if (!isAdmin) throw new Error("Apenas administradores globais podem listar todos os tenants.");

  const { data, error } = await supabase
    .from("tenants")
    .select("id,name,slug,plan,is_active,created_at")
    .order("name");
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((t) => ({
    id: t.id,
    nome_fantasia: t.name,
    slug: t.slug,
    plan: t.plan,
    ativo: t.is_active,
    created_at: t.created_at,
  }));
}

const EmpresaInput = z.object({
  nome_fantasia: z.string().min(2),
  cnpj: z.string().optional().nullable(),
});

export async function createEmpresa(input: unknown) {
  const data = EmpresaInput.parse(input);
  const { userId, supabase } = await getAuthContext();

  const { data: isAdmin } = await supabase.rpc("fs_is_admin", { _user_id: userId });
  if (!isAdmin) throw new Error("Apenas administradores globais podem criar empresas.");

  const supabaseAdmin = createAdminClient();
  const { data: row, error } = await supabaseAdmin
    .from("tenants")
    .insert({ name: data.nome_fantasia })
    .select()
    .single();
  if (error) throw error;

  const r = row as Record<string, unknown>;
  return { ...r, nome_fantasia: r.name, ativo: r.is_active };
}

// ────────────────────────────────────────────────────────────────────────────
// Lojas
// ────────────────────────────────────────────────────────────────────────────

export async function listLojasAdmin(input: unknown) {
  const data = z.object({ tenant_id: z.string().uuid().optional() }).parse(input);
  await getAuthContext();

  const supabaseAdmin = createAdminClient();
  let q = supabaseAdmin
    .from("lojas")
    .select("id,tenant_id,name,emp_id,terminal_maxdata,is_active,created_at")
    .order("name");
  if (data.tenant_id) q = q.eq("tenant_id", data.tenant_id);

  const { data: rows, error } = await q;
  if (error) throw error;

  const lojaRows = (rows ?? []) as Array<Record<string, unknown>>;
  // Terminal canônico vem de integration_configs; lojas.terminal_maxdata é só fallback
  const terminaisPorLoja = await getTerminaisByLojaIds(lojaRows.map((l) => l.id as string));

  return lojaRows.map((l) => ({
    id: l.id,
    empresa_id: l.tenant_id,
    tenant_id: l.tenant_id,
    nome: l.name,
    emp_id_maxdata: String(l.emp_id),
    terminal_maxdata: terminaisPorLoja.get(l.id as string) ?? resolveTerminal(null, l) ?? "",
    ativo: l.is_active,
    created_at: l.created_at,
  }));
}

const LojaInput = z.object({
  empresa_id: z.string().uuid(),
  nome: z.string().min(2),
  emp_id_maxdata: z.string().min(1),
  terminal_maxdata: z.string().min(1),
});

export async function createLoja(input: unknown) {
  const data = LojaInput.parse(input);
  const { userId, supabase } = await getAuthContext();

  const { data: canManage } = await supabase.rpc("fs_is_admin", { _user_id: userId });
  if (!canManage) throw new Error("Apenas administradores globais podem criar lojas.");

  const supabaseAdmin = createAdminClient();
  const { data: row, error } = await supabaseAdmin
    .from("lojas")
    .insert({
      tenant_id: data.empresa_id,
      name: data.nome,
      emp_id: parseInt(data.emp_id_maxdata, 10),
      terminal_maxdata: data.terminal_maxdata,
    })
    .select()
    .single();
  if (error) throw error;

  const r = row as Record<string, unknown>;

  // Grava o terminal também na tabela canônica (integration_configs)
  await supabaseAdmin.from("integration_configs").upsert(
    { loja_id: r.id as string, terminal_maxdata: data.terminal_maxdata },
    { onConflict: "loja_id" },
  );

  return {
    ...r,
    empresa_id: r.tenant_id,
    nome: r.name,
    emp_id_maxdata: String(r.emp_id),
    ativo: r.is_active,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Vínculos de usuários (tenant_users)
// ────────────────────────────────────────────────────────────────────────────

export async function listUserEmpresas(input: unknown) {
  const data = z.object({ tenant_id: z.string().uuid() }).parse(input);
  const { userId, supabase } = await getAuthContext();

  const supabaseAdmin = createAdminClient();
  const { data: tuRow } = await supabaseAdmin
    .from("tenant_users")
    .select("role")
    .eq("tenant_id", data.tenant_id)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: isAdmin } = await supabase.rpc("fs_is_admin", { _user_id: userId });
  const tu = tuRow as Record<string, unknown> | null;
  const isManagerOrAdmin =
    isAdmin || (tu && ["owner", "admin"].includes(tu.role as string));
  if (!isManagerOrAdmin) throw new Error("Sem permissão para listar usuários deste tenant.");

  const { data: vinculos } = await supabaseAdmin
    .from("tenant_users")
    .select("id,user_id,role,created_at")
    .eq("tenant_id", data.tenant_id);

  const vinculoRows = (vinculos ?? []) as Array<Record<string, unknown>>;
  if (!vinculoRows.length) return [];

  const userIds = vinculoRows.map((v) => v.user_id as string);
  const { data: profs } = await supabaseAdmin
    .from("fs_profiles")
    .select("user_id,nome,email")
    .in("user_id", userIds);

  const profRows = (profs ?? []) as Array<Record<string, unknown>>;
  const map = new Map(profRows.map((p) => [p.user_id as string, p]));

  return vinculoRows.map((v) => ({
    ...v,
    role_na_empresa: v.role,
    nome: map.get(v.user_id as string)?.nome ?? "—",
    email: map.get(v.user_id as string)?.email ?? "—",
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// Integration configs (write)
// Bridge URL/token → lojas (token encrypted); MaxAPI → integration_configs
// ────────────────────────────────────────────────────────────────────────────

const IntegrationUpsertInput = z.object({
  loja_id: z.string().uuid(),
  bridge_url: z.string().url().optional().nullable(),
  bridge_token: z.string().optional().nullable(),
  maxapi_url: z.string().url().optional().nullable(),
  maxapi_client_id: z.string().optional().nullable(),
  maxapi_secret_key: z.string().optional().nullable(),
  terminal_maxdata: z.string().optional().nullable(),
});

export async function upsertIntegrationConfig(input: unknown) {
  const data = IntegrationUpsertInput.parse(input);
  const { userId, supabase } = await getAuthContext();

  const { data: canManage } = await supabase.rpc("fs_user_can_manage_loja", {
    _user_id: userId,
    _loja_id: data.loja_id,
  });
  if (!canManage) throw new Error("Apenas owner/admin pode editar a integração.");

  const supabaseAdmin = createAdminClient();

  const lojaUpdate: Record<string, string | null> = {};
  if (data.bridge_url !== undefined) lojaUpdate.sql_bridge_url = data.bridge_url ?? null;
  if (data.bridge_token && data.bridge_token.trim().length > 0)
    lojaUpdate.sql_bridge_token = encrypt(data.bridge_token);
  // shadow-write em lojas.terminal_maxdata (deprecated) — canônico é integration_configs
  if (data.terminal_maxdata !== undefined)
    lojaUpdate.terminal_maxdata = data.terminal_maxdata ?? null;

  if (Object.keys(lojaUpdate).length > 0) {
    const { error } = await supabaseAdmin
      .from("lojas")
      .update(lojaUpdate)
      .eq("id", data.loja_id);
    if (error) throw error;
  }

  const cfgPayload: Record<string, unknown> = { loja_id: data.loja_id };
  if (data.maxapi_url !== undefined) cfgPayload.maxapi_url = data.maxapi_url ?? null;
  if (data.maxapi_client_id !== undefined)
    cfgPayload.maxapi_client_id = data.maxapi_client_id ?? null;
  if (data.maxapi_secret_key?.trim()) cfgPayload.maxapi_secret_key = data.maxapi_secret_key;
  if (data.terminal_maxdata !== undefined)
    cfgPayload.terminal_maxdata = data.terminal_maxdata ?? null;
  if (data.maxapi_url !== undefined || data.terminal_maxdata !== undefined) {
    cfgPayload.maxapi_token_cache = null;
    cfgPayload.maxapi_token_expires_at = null;
  }

  const { error: cfgErr } = await supabaseAdmin
    .from("integration_configs")
    .upsert(cfgPayload, { onConflict: "loja_id" });
  if (cfgErr) throw cfgErr;

  return { ok: true };
}

// ────────────────────────────────────────────────────────────────────────────
// Audit logs (leitura)
// ────────────────────────────────────────────────────────────────────────────

export async function listAuditLogs(input: unknown) {
  const data = z
    .object({
      tenant_id: z.string().uuid().optional(),
      loja_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    })
    .parse(input);

  await getAuthContext();
  const supabaseAdmin = createAdminClient();

  let q = supabaseAdmin
    .from("fs_audit_logs")
    .select(
      "id,created_at,user_id,tenant_id,loja_id,acao,entidade,entidade_id,detalhes_json",
    )
    .order("created_at", { ascending: false })
    .limit(data.limit ?? 100);

  if (data.tenant_id) q = q.eq("tenant_id", data.tenant_id);
  if (data.loja_id) q = q.eq("loja_id", data.loja_id);

  const { data: rows, error } = await q;
  if (error) throw error;
  return rows ?? [];
}
