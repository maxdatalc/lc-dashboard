// Funções de acesso ao banco de dados para as tabelas tenants e lojas
// Escritas administrativas usam createAdminClient (bypassa RLS)
// Leituras do usuário usam createClient (RLS ativo)
// sql_bridge_token é armazenado criptografado (AES-256-GCM)

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/crypto";
import type { Tenant, Loja } from "@/types";

export type CreateTenantInput = {
  name: string;
  slug: string;
  plan?: "free" | "premium";
};

export type CreateLojaInput = {
  tenantId: string;
  name: string;
  empId: number;
  sqlBridgeUrl?: string;
  sqlBridgeToken?: string; // plain text — will be encrypted
  sqlEnabled?: boolean;
};

function rowToTenant(row: Record<string, unknown>): Tenant {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    plan: row.plan as "free" | "premium",
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
  };
}

function rowToLoja(row: Record<string, unknown>): Loja {
  return {
    id:            row.id as string,
    tenantId:      row.tenant_id as string,
    name:          row.name as string,
    empId:         row.emp_id as number,
    isActive:      row.is_active as boolean,
    createdAt:     row.created_at as string,
    sqlEnabled:    (row.sql_enabled as boolean) ?? false,
    sqlBridgeUrl:  (row.sql_bridge_url as string) ?? null,
    sqlBridgeToken:(row.sql_bridge_token as string) ?? null,
  };
}

export async function createTenant(input: CreateTenantInput): Promise<Tenant> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("tenants")
    .insert({
      name: input.name,
      slug: input.slug,
      plan: input.plan ?? "free",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return rowToTenant(data as Record<string, unknown>);
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tenants")
    .select()
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return rowToTenant(data as Record<string, unknown>);
}

export async function createLoja(input: CreateLojaInput): Promise<Loja> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("lojas")
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      emp_id: input.empId,
      sql_bridge_url: input.sqlBridgeUrl ?? null,
      sql_bridge_token: input.sqlBridgeToken ? encrypt(input.sqlBridgeToken) : null,
      sql_enabled: input.sqlEnabled ?? false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return rowToLoja(data as Record<string, unknown>);
}

export async function getLojasByTenantId(tenantId: string): Promise<Loja[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lojas")
    .select()
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data as Record<string, unknown>[]).map(rowToLoja);
}

// Retorna URL + token da bridge SQL prontos para uso — token descriptografado em memória
export async function getLojaDbConfig(
  lojaId: string
): Promise<{ bridgeUrl: string; token: string; empId: number } | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("lojas")
    .select("sql_enabled, sql_bridge_url, sql_bridge_token, emp_id")
    .eq("id", lojaId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as Record<string, unknown>;

  if (!row.sql_enabled || !row.sql_bridge_url || !row.sql_bridge_token) {
    return null;
  }

  return {
    bridgeUrl: row.sql_bridge_url as string,
    token: decrypt(row.sql_bridge_token as string),
    empId: Number(row.emp_id),
  };
}

// Retorna dados de uma loja com token descriptografado — uso exclusivo do painel admin
export async function getLojaAdmin(lojaId: string): Promise<{
  id: string;
  tenantId: string;
  name: string;
  empId: number;
  isActive: boolean;
  sqlEnabled: boolean;
  bridgeUrl: string | null;
  bridgeToken: string | null; // descriptografado
} | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("lojas")
    .select("id, tenant_id, name, emp_id, is_active, sql_enabled, sql_bridge_url, sql_bridge_token")
    .eq("id", lojaId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as Record<string, unknown>;

  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    empId: row.emp_id as number,
    isActive: row.is_active as boolean,
    sqlEnabled: (row.sql_enabled as boolean) ?? false,
    bridgeUrl: (row.sql_bridge_url as string) ?? null,
    bridgeToken: row.sql_bridge_token ? decrypt(row.sql_bridge_token as string) : null,
  };
}

// Salva ou atualiza as credenciais da bridge SQL de uma loja (criptografa o token)
export async function updateLojaSqlConfig(
  lojaId: string,
  config: { bridgeUrl: string; token: string; enabled: boolean }
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("lojas")
    .update({
      sql_bridge_url:   config.bridgeUrl,
      sql_bridge_token: encrypt(config.token),
      sql_enabled:      config.enabled,
    })
    .eq("id", lojaId);

  if (error) throw new Error(error.message);
}

// Retorna dados completos de uma loja incluindo MaxAPI config — uso exclusivo do painel admin
export async function getLojaAdminWithMaxApi(lojaId: string): Promise<{
  id: string;
  tenantId: string;
  name: string;
  empId: number;
  isActive: boolean;
  sqlEnabled: boolean;
  bridgeUrl: string | null;
  bridgeToken: string | null;
  terminalMaxdata: string | null;
  maxApiUrl: string | null;
} | null> {
  const supabase = createAdminClient();

  const [lojaRes, cfgRes] = await Promise.all([
    supabase
      .from("lojas")
      .select("id, tenant_id, name, emp_id, is_active, sql_enabled, sql_bridge_url, sql_bridge_token")
      .eq("id", lojaId)
      .maybeSingle(),
    supabase
      .from("integration_configs")
      .select("maxapi_url, terminal_maxdata")
      .eq("loja_id", lojaId)
      .limit(1),
  ]);

  if (lojaRes.error) throw new Error(lojaRes.error.message);
  if (!lojaRes.data) return null;

  const row = lojaRes.data as Record<string, unknown>;
  const cfgRow = ((cfgRes.data as Record<string, unknown>[] | null)?.[0]) ?? null;

  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    empId: row.emp_id as number,
    isActive: row.is_active as boolean,
    sqlEnabled: (row.sql_enabled as boolean) ?? false,
    bridgeUrl: (row.sql_bridge_url as string) ?? null,
    bridgeToken: row.sql_bridge_token ? decrypt(row.sql_bridge_token as string) : null,
    terminalMaxdata: (cfgRow?.terminal_maxdata as string) ?? null,
    maxApiUrl: (cfgRow?.maxapi_url as string) ?? null,
  };
}

// Salva URL e terminal da MaxAPI em integration_configs (não toca na tabela lojas)
export async function updateLojaMaxApiConfig(
  lojaId: string,
  config: { maxApiUrl: string; terminalMaxdata: string }
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("integration_configs")
    .upsert(
      { loja_id: lojaId, maxapi_url: config.maxApiUrl, terminal_maxdata: config.terminalMaxdata },
      { onConflict: "loja_id" },
    );

  if (error) throw new Error(`Falha ao salvar config MaxAPI: ${error.message}`);
}

