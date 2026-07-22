"use server";

import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/crypto";
import { pingBridge, queryBridge, type BridgeConfig } from "@/lib/bridge/bridge-client";
import { resolveNamedQuery } from "@/lib/bridge/named-queries";
import { getOrRefreshToken, buildMaxApiConfig } from "@/lib/maxapi/maxapi-client";
import { resolveTerminal } from "@/lib/maxapi/terminal";
import { assertLojaAccess, assertManageLoja } from "@/lib/api/access";

const LojaInput = z.object({ loja_id: z.string().uuid() });

export type IntegrationStatusInfo = {
  loja_id: string;
  status_bridge: string;
  status_maxapi: string;
  ultimo_teste_bridge: string | null;
  ultimo_teste_maxapi: string | null;
  bridge_configurada: boolean;
  maxapi_configurada: boolean;
};

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("NÃ£o autenticado");
  return { userId: user.id, supabase };
}

async function logAuditoria(opts: {
  userId: string;
  tenant_id?: string | null;
  loja_id?: string | null;
  acao: string;
  entidade?: string;
  entidade_id?: string;
  detalhes?: unknown;
}) {
  const supabaseAdmin = createAdminClient();
  await supabaseAdmin.from("fs_audit_logs").insert({
    user_id: opts.userId,
    tenant_id: opts.tenant_id ?? null,
    loja_id: opts.loja_id ?? null,
    acao: opts.acao,
    entidade: opts.entidade ?? null,
    entidade_id: opts.entidade_id ?? null,
    detalhes_json: (opts.detalhes ?? null) as never,
  });
}

export async function getIntegrationStatus(
  input: unknown,
): Promise<IntegrationStatusInfo | null> {
  const data = LojaInput.parse(input);
  const { userId } = await getAuthContext();

  await assertLojaAccess(userId, data.loja_id);

  const supabaseAdmin = createAdminClient();
  const [{ data: loja }, { data: cfg }] = await Promise.all([
    supabaseAdmin
      .from("lojas")
      .select("emp_id, terminal_maxdata, sql_bridge_url, sql_bridge_token")
      .eq("id", data.loja_id)
      .maybeSingle(),
    supabaseAdmin
      .from("integration_configs")
      .select(
        "loja_id, status_bridge, status_maxapi, ultimo_teste_bridge, ultimo_teste_maxapi, maxapi_url, terminal_maxdata",
      )
      .eq("loja_id", data.loja_id)
      .limit(1),
  ]);

  if (!loja) return null;

  const lojaRow = loja as Record<string, unknown>;
  const cfgRow = ((cfg as Record<string, unknown>[] | null)?.[0]) ?? null;
  const maxapiConfigurada = !!(
    cfgRow?.maxapi_url &&
    lojaRow.emp_id &&
    resolveTerminal(cfgRow, lojaRow)
  );

  return {
    loja_id: data.loja_id,
    status_bridge: (cfgRow?.status_bridge as string) ?? "nao_configurado",
    status_maxapi: (cfgRow?.status_maxapi as string) ?? "nao_configurado",
    ultimo_teste_bridge: (cfgRow?.ultimo_teste_bridge as string) ?? null,
    ultimo_teste_maxapi: (cfgRow?.ultimo_teste_maxapi as string) ?? null,
    bridge_configurada: !!(lojaRow.sql_bridge_url && lojaRow.sql_bridge_token),
    maxapi_configurada: maxapiConfigurada,
  };
}

export async function testBridgeConnection(input: unknown) {
  const data = LojaInput.parse(input);
  const { userId } = await getAuthContext();

  await assertManageLoja(userId, data.loja_id);

  const supabaseAdmin = createAdminClient();
  const { data: loja } = await supabaseAdmin
    .from("lojas")
    .select("tenant_id, sql_bridge_url, sql_bridge_token")
    .eq("id", data.loja_id)
    .maybeSingle();

  const lojaRow = loja as Record<string, unknown> | null;
  let status: "online" | "offline" | "erro" | "nao_configurado" = "nao_configurado";
  let mensagem = "Bridge SQL ainda nÃ£o configurada para esta loja.";
  let latencia_ms: number | null = null;

  if (lojaRow?.sql_bridge_url && lojaRow?.sql_bridge_token) {
    const result = await pingBridge({
      url: lojaRow.sql_bridge_url as string,
      token: decrypt(lojaRow.sql_bridge_token as string),
    });
    if (result.ok) {
      status = "online";
      mensagem = `Bridge respondeu em ${result.ms}ms â€” banco: ${result.db || "BATAUTO"}`;
      latencia_ms = result.ms;
    } else {
      status = "erro";
      mensagem = `Bridge SQL erro: ${result.error ?? "sem resposta"}`;
    }
  } else if (lojaRow?.sql_bridge_url && !lojaRow?.sql_bridge_token) {
    status = "nao_configurado";
    mensagem = "Bridge URL configurada mas token ausente.";
  }

  await supabaseAdmin.from("integration_configs").upsert(
    {
      loja_id: data.loja_id,
      status_bridge: status,
      ultimo_teste_bridge: new Date().toISOString(),
    },
    { onConflict: "loja_id" },
  );

  await logAuditoria({
    userId,
    tenant_id: lojaRow?.tenant_id as string | null,
    loja_id: data.loja_id,
    acao: "TESTOU_INTEGRACAO_BRIDGE",
    entidade: "integration_configs",
    entidade_id: data.loja_id,
    detalhes: { status, mensagem, latencia_ms },
  });

  return { status, mensagem, latencia_ms };
}

export async function testMaxApiConnection(input: unknown) {
  const data = LojaInput.parse(input);
  const { userId } = await getAuthContext();

  await assertManageLoja(userId, data.loja_id);

  const supabaseAdmin = createAdminClient();
  const [{ data: loja }, { data: cfg }] = await Promise.all([
    supabaseAdmin
      .from("lojas")
      .select("id, tenant_id, emp_id, terminal_maxdata")
      .eq("id", data.loja_id)
      .maybeSingle(),
    supabaseAdmin
      .from("integration_configs")
      .select("maxapi_url, terminal_maxdata, maxapi_token_cache, maxapi_token_expires_at")
      .eq("loja_id", data.loja_id)
      .limit(1),
  ]);

  const lojaRow = loja as Record<string, unknown> | null;
  const cfgRow = ((cfg as Record<string, unknown>[] | null)?.[0]) ?? null;
  const terminal = resolveTerminal(cfgRow, lojaRow);
  let status: "online" | "offline" | "erro" | "nao_configurado" = "nao_configurado";
  let mensagem = "MaxAPI ainda nÃ£o configurada para esta loja.";
  let token_cached_until: string | null = null;

  const isConfigured = !!(cfgRow?.maxapi_url && lojaRow?.emp_id && terminal);

  if (isConfigured) {
    try {
      const maxApiConfig = buildMaxApiConfig(
        {
          emp_id_maxdata: String(lojaRow!.emp_id),
          terminal_maxdata: terminal!,
        },
        { maxapi_url: cfgRow!.maxapi_url as string },
      );
      const token = await getOrRefreshToken(maxApiConfig, supabaseAdmin, data.loja_id);
      const { data: refreshedRows } = await supabaseAdmin
        .from("integration_configs")
        .select("maxapi_token_expires_at")
        .eq("loja_id", data.loja_id)
        .limit(1);

      const refreshed = ((refreshedRows as Record<string, unknown>[] | null)?.[0]) ?? null;
      token_cached_until =
        (refreshed?.maxapi_token_expires_at as string) ?? null;
      status = token ? "online" : "erro";
      mensagem = token
        ? `AutenticaÃ§Ã£o MaxAPI realizada com sucesso. Cache vÃ¡lido atÃ© ${token_cached_until ?? "desconhecido"}.`
        : "Token retornado vazio â€” verifique configuraÃ§Ã£o.";
    } catch (err) {
      status = "erro";
      mensagem = `Falha na autenticaÃ§Ã£o MaxAPI: ${(err as Error).message}`;
    }
  } else if (cfgRow?.maxapi_url) {
    status = "nao_configurado";
    mensagem = !terminal
      ? "MaxAPI URL configurada mas o terminal nÃ£o foi informado."
      : "MaxAPI URL configurada mas emp_id ausente na loja.";
  }

  await supabaseAdmin.from("integration_configs").upsert(
    {
      loja_id: data.loja_id,
      status_maxapi: status,
      ultimo_teste_maxapi: new Date().toISOString(),
    },
    { onConflict: "loja_id" },
  );

  await logAuditoria({
    userId,
    tenant_id: lojaRow?.tenant_id as string | null,
    loja_id: data.loja_id,
    acao: "TESTOU_INTEGRACAO_MAXAPI",
    entidade: "integration_configs",
    entidade_id: data.loja_id,
    detalhes: { status, mensagem },
  });

  return { status, mensagem, token_cached_until };
}

export type InventarioInfo = {
  invId: number;
  data: string;
  obs: string;
};

export async function listInventories(input: unknown): Promise<InventarioInfo[]> {
  const data = LojaInput.parse(input);
  const { userId } = await getAuthContext();

  await assertManageLoja(userId, data.loja_id);

  const supabaseAdmin = createAdminClient();
  const { data: loja } = await supabaseAdmin
    .from("lojas")
    .select("emp_id, sql_bridge_url, sql_bridge_token")
    .eq("id", data.loja_id)
    .maybeSingle();

  const lojaRow = loja as Record<string, unknown> | null;
  if (!lojaRow?.sql_bridge_url || !lojaRow?.sql_bridge_token) {
    throw new Error("Bridge SQL nÃ£o configurada para esta loja.");
  }

  const bridge: BridgeConfig = {
    url: lojaRow.sql_bridge_url as string,
    token: decrypt(lojaRow.sql_bridge_token as string),
  };
  const empId = lojaRow.emp_id as number;

  const { sql, params } = resolveNamedQuery("LIST_INVENTORIES", { empId });
  const rows = await queryBridge<{ invId: number; data: string; obs: string }>(
    bridge,
    sql,
    params,
  );

  return rows.map((r) => ({
    invId: Number(r.invId),
    data: r.data ?? "",
    obs: r.obs ?? "",
  }));
}

export type IntegrationConfig = {
  bridge_url: string | null;
  bridge_token_configurado: boolean;
  maxapi_url: string | null;
  emp_id_maxdata: string | null;
  terminal_maxdata: string | null;
  inventario_id_base: number | null;
};

export async function getIntegrationConfig(input: unknown): Promise<IntegrationConfig | null> {
  const data = LojaInput.parse(input);
  const { userId } = await getAuthContext();

  await assertManageLoja(userId, data.loja_id);

  const supabaseAdmin = createAdminClient();
  const [{ data: loja }, { data: cfg }] = await Promise.all([
    supabaseAdmin
      .from("lojas")
      .select("emp_id, terminal_maxdata, sql_bridge_url, sql_bridge_token")
      .eq("id", data.loja_id)
      .maybeSingle(),
    supabaseAdmin
      .from("integration_configs")
      .select("maxapi_url, terminal_maxdata, inventario_id_base")
      .eq("loja_id", data.loja_id)
      .limit(1),
  ]);

  if (!loja) return null;

  const lojaRow = loja as Record<string, unknown>;
  const cfgRow = ((cfg as Record<string, unknown>[] | null)?.[0]) ?? null;

  return {
    bridge_url: (lojaRow.sql_bridge_url as string) ?? null,
    bridge_token_configurado: !!lojaRow.sql_bridge_token,
    maxapi_url: (cfgRow?.maxapi_url as string) ?? null,
    emp_id_maxdata: lojaRow.emp_id ? String(lojaRow.emp_id) : null,
    terminal_maxdata: resolveTerminal(cfgRow, lojaRow),
    inventario_id_base: cfgRow?.inventario_id_base ? Number(cfgRow.inventario_id_base) : null,
  };
}

const SaveConfigInput = z.object({
  loja_id: z.string().uuid(),
  bridge_url: z.string().url("URL da Bridge invÃ¡lida").optional().or(z.literal("")),
  bridge_token: z.string().optional(),
  maxapi_url: z.string().url("URL da MaxAPI invÃ¡lida").optional().or(z.literal("")),
  terminal_maxdata: z.string().optional(),
  inventario_id_base: z.number().int().positive().nullable().optional(),
});

export async function saveIntegrationConfig(input: unknown) {
  const data = SaveConfigInput.parse(input);
  const { userId } = await getAuthContext();

  await assertManageLoja(userId, data.loja_id);

  const supabaseAdmin = createAdminClient();
  const { data: loja } = await supabaseAdmin
    .from("lojas")
    .select("tenant_id")
    .eq("id", data.loja_id)
    .maybeSingle();

  const invalidaTokenMaxApi =
    data.maxapi_url !== undefined || data.terminal_maxdata !== undefined;

  const lojaUpdate: Record<string, string | null> = {};
  if (data.bridge_url !== undefined) lojaUpdate.sql_bridge_url = data.bridge_url || null;
  if (data.bridge_token !== undefined && data.bridge_token !== "")
    lojaUpdate.sql_bridge_token = encrypt(data.bridge_token);
  // shadow-write em lojas.terminal_maxdata (deprecated) — canônico é integration_configs
  if (data.terminal_maxdata !== undefined)
    lojaUpdate.terminal_maxdata = data.terminal_maxdata || null;

  if (Object.keys(lojaUpdate).length > 0) {
    await supabaseAdmin.from("lojas").update(lojaUpdate).eq("id", data.loja_id);
  }

  const cfgUpsert: Record<string, unknown> = { loja_id: data.loja_id };
  if (data.maxapi_url !== undefined) cfgUpsert.maxapi_url = data.maxapi_url || null;
  if (data.terminal_maxdata !== undefined)
    cfgUpsert.terminal_maxdata = data.terminal_maxdata || null;
  if (data.inventario_id_base !== undefined) cfgUpsert.inventario_id_base = data.inventario_id_base;
  if (invalidaTokenMaxApi) {
    cfgUpsert.maxapi_token_cache = null;
    cfgUpsert.maxapi_token_expires_at = null;
  }
  await supabaseAdmin
    .from("integration_configs")
    .upsert(cfgUpsert, { onConflict: "loja_id" });

  const camposAlterados = [
    data.bridge_url !== undefined && "bridge_url",
    data.bridge_token !== undefined && data.bridge_token !== "" && "bridge_token",
    data.maxapi_url !== undefined && "maxapi_url",
    data.terminal_maxdata !== undefined && "terminal_maxdata",
  ].filter(Boolean);

  const lojaRow = loja as Record<string, unknown> | null;
  await logAuditoria({
    userId,
    tenant_id: lojaRow?.tenant_id as string | null,
    loja_id: data.loja_id,
    acao: "SALVOU_CONFIG_INTEGRACAO",
    entidade: "integration_configs",
    entidade_id: data.loja_id,
    detalhes: { campos_alterados: camposAlterados },
  });

  return { ok: true };
}

