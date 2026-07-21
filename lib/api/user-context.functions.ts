"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";

export type LojaContext = {
  id: string;
  empresa_id: string;
  nome: string;
  emp_id_maxdata: string;
  terminal_maxdata: string;
  ativo: boolean;
};

export type EmpresaContext = {
  id: string;
  nome_fantasia: string;
  razao_social: string | null;
  cnpj: string | null;
  ativo: boolean;
  role_na_empresa: string;
  lojas: LojaContext[];
};

export type UserContext = {
  user: { id: string; email: string; nome: string; role: string };
  empresas: EmpresaContext[];
  is_global_admin: boolean;
};

export async function getCurrentUserContext(): Promise<UserContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const userId = user.id;

  const supabaseAdmin = createAdminClient();

  const { data: profile } = await supabaseAdmin
    .from("fs_profiles")
    .select("nome,email,role,ativo")
    .eq("user_id", userId)
    .maybeSingle();

  const isAdmin =
    (profile as Record<string, unknown> | null)?.role === "owner" ||
    (profile as Record<string, unknown> | null)?.role === "admin";

  const { data: vinculos } = await supabaseAdmin
    .from("tenant_users")
    .select("tenant_id,role")
    .eq("user_id", userId);

  const tenantIds = ((vinculos ?? []) as Array<{ tenant_id: string; role: string }>).map(
    (v) => v.tenant_id,
  );

  const { data: tenantsRows } = tenantIds.length
    ? await supabaseAdmin
        .from("tenants")
        .select("id,name,is_active")
        .in("id", tenantIds)
        .eq("is_active", true)
        .order("name")
    : { data: [] as Array<{ id: string; name: string; is_active: boolean }> };

  const { data: lojas } = tenantIds.length
    ? await supabaseAdmin
        .from("lojas")
        .select("id,tenant_id,name,emp_id,terminal_maxdata,is_active")
        .in("tenant_id", tenantIds)
        .eq("is_active", true)
        .order("name")
    : {
        data: [] as Array<{
          id: string;
          tenant_id: string;
          name: string;
          emp_id: number;
          terminal_maxdata: string | null;
          is_active: boolean;
        }>,
      };

  // Lojas visíveis por usuário (loja_ids vazio = todas as lojas do tenant)
  const { data: settingsRows } = tenantIds.length
    ? await supabaseAdmin
        .from("user_tenant_settings")
        .select("tenant_id,loja_ids")
        .eq("user_id", userId)
        .in("tenant_id", tenantIds)
    : { data: [] as Array<{ tenant_id: string; loja_ids: string[] }> };

  const allowedLojaIdsByTenant = new Map(
    ((settingsRows ?? []) as Array<{ tenant_id: string; loja_ids: string[] }>).map((s) => [
      s.tenant_id,
      s.loja_ids ?? [],
    ]),
  );

  const roleMap = new Map(
    ((vinculos ?? []) as Array<{ tenant_id: string; role: string }>).map((v) => [
      v.tenant_id,
      v.role,
    ]),
  );

  const rows = (tenantsRows ?? []) as Array<{ id: string; name: string; is_active: boolean }>;
  const lojaRows = (lojas ?? []) as Array<{
    id: string;
    tenant_id: string;
    name: string;
    emp_id: number;
    terminal_maxdata: string | null;
    is_active: boolean;
  }>;

  const empresas: EmpresaContext[] = rows.map((t) => ({
    id: t.id,
    nome_fantasia: t.name,
    razao_social: null,
    cnpj: null,
    ativo: t.is_active,
    role_na_empresa:
      roleMap.get(t.id) ??
      (isAdmin
        ? ((profile as Record<string, unknown> | null)?.role as string) ?? "admin"
        : "viewer"),
    lojas: lojaRows
      .filter((l) => l.tenant_id === t.id)
      .filter((l) => {
        if (isAdmin) return true;
        const allowed = allowedLojaIdsByTenant.get(t.id) ?? [];
        return allowed.length === 0 || allowed.includes(l.id);
      })
      .map((l): LojaContext => ({
        id: l.id,
        empresa_id: l.tenant_id,
        nome: l.name,
        emp_id_maxdata: String(l.emp_id),
        terminal_maxdata: l.terminal_maxdata ?? "1",
        ativo: l.is_active,
      })),
  }));

  const p = profile as Record<string, unknown> | null;

  return {
    user: {
      id: userId,
      email: (p?.email as string) ?? "",
      nome: (p?.nome as string) ?? "",
      role: (p?.role as string) ?? "viewer",
    },
    empresas,
    is_global_admin: isAdmin,
  };
}
