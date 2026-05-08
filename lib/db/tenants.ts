// Funções de acesso ao banco de dados para a tabela tenants
// Usa o service role key para bypassar RLS — executado apenas no servidor
// O terminal MaxData é sempre armazenado criptografado (AES-256-GCM)

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { encrypt, decrypt } from "@/lib/crypto";
import type { Tenant } from "@/types";

export type CreateTenantInput = {
  name: string;
  slug: string;
  erpBaseUrl: string;
  empId: number;
  terminal: string; // texto puro — será criptografado antes de salvar
  plan?: "free" | "premium";
};

// Cliente com privilégio total — nunca expor para o browser
function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Mapeia uma linha do banco para o tipo Tenant da aplicação
function rowToTenant(row: Record<string, unknown>): Tenant {
  return {
    id: row.id as string,
    name: row.name as string,
    erpBaseUrl: row.erp_base_url as string,
    empId: row.emp_id as number,
    createdAt: new Date(row.created_at as string),
  };
}

export async function createTenant(input: CreateTenantInput): Promise<Tenant> {
  const supabase = createServiceClient();

  // Criptografar o terminal antes de persistir — nunca salvar em texto puro
  const terminalEncrypted = encrypt(input.terminal);

  const { data, error } = await supabase
    .from("tenants")
    .insert({
      name: input.name,
      slug: input.slug,
      erp_base_url: input.erpBaseUrl,
      emp_id: input.empId,
      terminal_encrypted: terminalEncrypted,
      plan: input.plan ?? "free",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return rowToTenant(data as Record<string, unknown>);
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("tenants")
    .select()
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return rowToTenant(data as Record<string, unknown>);
}

// Retorna as credenciais de acesso ao ERP prontas para uso no MaxData client
// O terminal é descriptografado apenas em memória — nunca exposto em logs
export async function getTenantConfig(
  tenantId: string
): Promise<{ baseUrl: string; empId: number; terminal: string }> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("tenants")
    .select("erp_base_url, emp_id, terminal_encrypted")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Tenant não encontrado");

  const row = data as Record<string, unknown>;

  return {
    baseUrl: row.erp_base_url as string,
    empId: row.emp_id as number,
    terminal: decrypt(row.terminal_encrypted as string),
  };
}
