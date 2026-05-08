// Funções de acesso ao banco de dados para as tabelas tenants e lojas
// Escritas administrativas usam createAdminClient (bypassa RLS)
// Leituras do usuário usam createClient (RLS ativo)
// O terminal MaxData é sempre armazenado criptografado (AES-256-GCM)

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
  erpBaseUrl: string;
  terminal: string; // texto puro — será criptografado antes de salvar
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
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    empId: row.emp_id as number,
    erpBaseUrl: row.erp_base_url as string,
    terminalEncrypted: row.terminal_encrypted as string,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
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

  // Criptografar o terminal antes de persistir — nunca salvar em texto puro
  const terminalEncrypted = encrypt(input.terminal);

  const { data, error } = await supabase
    .from("lojas")
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      emp_id: input.empId,
      erp_base_url: input.erpBaseUrl,
      terminal_encrypted: terminalEncrypted,
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

// Retorna as credenciais de acesso ao ERP prontas para uso no MaxData client
// O terminal é descriptografado apenas em memória — nunca exposto em logs
export async function getLojaConfig(
  lojaId: string
): Promise<{ baseUrl: string; empId: number; terminal: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lojas")
    .select("erp_base_url, emp_id, terminal_encrypted")
    .eq("id", lojaId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Loja não encontrada");

  const row = data as Record<string, unknown>;

  return {
    baseUrl: row.erp_base_url as string,
    empId: row.emp_id as number,
    terminal: decrypt(row.terminal_encrypted as string),
  };
}
