// Funções administrativas para o painel LC Tecnologias
// Usa createAdminClient() em todas as operações (bypassa RLS)

import { createAdminClient } from "@/lib/supabase/server";
import { createTenant, createLoja } from "@/lib/db/tenants";
import { FEATURES_CATALOG } from "@/lib/features";
import type { UserRole } from "@/lib/plans";

// ── Tipos ─────────────────────────────────────────────────────────────────

export type TenantComLojas = {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "premium";
  isActive: boolean;
  createdAt: string;
  lojas: {
    id: string;
    name: string;
    empId: number;
    isActive: boolean;
    sqlEnabled: boolean;
    cnpj?: string | null;
  }[];
  features: string[];
  totalUsuarios: number;
};

export type NovoClienteInput = {
  tenant: { name: string; slug: string; plan: "free" | "premium" };
  lojas: {
    name: string;
    empId: number;
    cnpj?: string;
    sqlEnabled?: boolean;
    sqlBridgeUrl?: string;
    sqlBridgeToken?: string;
  }[];
  features: string[];
  usuario: {
    email: string;
    senha: string;
    nomeCompleto: string;
    papel?: UserRole; // padrão: "owner"
  };
};

// ── Funções de consulta ────────────────────────────────────────────────────

/** Verifica se o usuário tem acesso ao painel administrativo */
export async function isSystemAdmin(userId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("profiles")
    .select("is_system_admin")
    .eq("id", userId)
    .maybeSingle();

  return (data as { is_system_admin?: boolean } | null)?.is_system_admin === true;
}

export type AdminUserRole = "admin" | "suporte" | null;

/** Retorna a role do usuário no painel admin (admin, suporte ou null) */
export async function getAdminRole(userId: string): Promise<AdminUserRole> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("profiles")
    .select("is_system_admin, is_suporte")
    .eq("id", userId)
    .maybeSingle();

  const p = data as { is_system_admin?: boolean; is_suporte?: boolean } | null;
  if (p?.is_system_admin) return "admin";
  if (p?.is_suporte) return "suporte";
  return null;
}

/** Retorna todos os tenants com lojas, features e contagem de usuários */
export async function getAllTenants(): Promise<TenantComLojas[]> {
  const supabase = createAdminClient();

  // Buscar tenants, lojas, features e usuários em paralelo
  const [tenantRes, lojasRes, featuresRes, usuariosRes] = await Promise.all([
    supabase.from("tenants").select("*").order("created_at", { ascending: false }),
    supabase.from("lojas").select("id, tenant_id, name, emp_id, is_active, sql_enabled, cnpj"),
    supabase.from("tenant_features").select("tenant_id, feature_key"),
    supabase.from("tenant_users").select("tenant_id"),
  ]);

  const tenants = (tenantRes.data ?? []) as Record<string, unknown>[];

  // Agrupar lojas por tenant_id
  const lojasPorTenant: Record<string, Record<string, unknown>[]> = {};
  for (const l of (lojasRes.data ?? []) as Record<string, unknown>[]) {
    const tid = l.tenant_id as string;
    if (!lojasPorTenant[tid]) lojasPorTenant[tid] = [];
    lojasPorTenant[tid].push(l);
  }

  // Agrupar feature_keys por tenant_id
  const featuresPorTenant: Record<string, string[]> = {};
  for (const f of (featuresRes.data ?? []) as Record<string, unknown>[]) {
    const tid = f.tenant_id as string;
    if (!featuresPorTenant[tid]) featuresPorTenant[tid] = [];
    featuresPorTenant[tid].push(f.feature_key as string);
  }

  // Contar usuários por tenant
  const usuariosPorTenant: Record<string, number> = {};
  for (const u of (usuariosRes.data ?? []) as Record<string, unknown>[]) {
    const tid = u.tenant_id as string;
    usuariosPorTenant[tid] = (usuariosPorTenant[tid] ?? 0) + 1;
  }

  return tenants.map((t) => ({
    id: t.id as string,
    name: t.name as string,
    slug: t.slug as string,
    plan: t.plan as "free" | "premium",
    isActive: t.is_active as boolean,
    createdAt: t.created_at as string,
    lojas: (lojasPorTenant[t.id as string] ?? []).map((l) => ({
      id: l.id as string,
      name: l.name as string,
      empId: l.emp_id as number,
      isActive: l.is_active as boolean,
      sqlEnabled: (l.sql_enabled as boolean) ?? false,
      cnpj: (l.cnpj as string) ?? null,
    })),
    features: featuresPorTenant[t.id as string] ?? [],
    totalUsuarios: usuariosPorTenant[t.id as string] ?? 0,
  }));
}

/** Retorna um tenant específico com lojas, features e contagem de usuários */
export async function getTenantByIdAdmin(id: string): Promise<TenantComLojas | null> {
  const supabase = createAdminClient();

  const [tenantRes, lojasRes, featuresRes, usuariosRes] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", id).maybeSingle(),
    supabase.from("lojas").select("id, name, emp_id, is_active, sql_enabled, cnpj").eq("tenant_id", id),
    supabase.from("tenant_features").select("feature_key").eq("tenant_id", id),
    supabase.from("tenant_users").select("tenant_id").eq("tenant_id", id),
  ]);

  if (!tenantRes.data) return null;

  const t = tenantRes.data as Record<string, unknown>;

  return {
    id: t.id as string,
    name: t.name as string,
    slug: t.slug as string,
    plan: t.plan as "free" | "premium",
    isActive: t.is_active as boolean,
    createdAt: t.created_at as string,
    lojas: ((lojasRes.data ?? []) as Record<string, unknown>[]).map((l) => ({
      id: l.id as string,
      name: l.name as string,
      empId: l.emp_id as number,
      isActive: l.is_active as boolean,
      sqlEnabled: (l.sql_enabled as boolean) ?? false,
      cnpj: (l.cnpj as string) ?? null,
    })),
    features: ((featuresRes.data ?? []) as Record<string, unknown>[]).map(
      (f) => f.feature_key as string
    ),
    totalUsuarios: (usuariosRes.data ?? []).length,
  };
}

// ── Funções de escrita ─────────────────────────────────────────────────────

/**
 * Cria um novo cliente completo: tenant + N lojas + features + usuário admin.
 * Usa transação lógica — tenta limpar recursos em caso de falha.
 */
export async function createNovoCliente(input: NovoClienteInput): Promise<{
  tenantId: string;
  lojaIds: string[];
  usuarioId: string;
}> {
  const supabase = createAdminClient();
  let tenantId: string | null = null;
  const lojaIds: string[] = [];
  let usuarioId: string | null = null;

  try {
    // 1. Criar tenant
    const tenant = await createTenant({
      name: input.tenant.name,
      slug: input.tenant.slug,
      plan: input.tenant.plan,
    });
    tenantId = tenant.id;

    // 2. Criar todas as lojas em sequência (token criptografado internamente)
    for (const lojaInput of input.lojas) {
      const loja = await createLoja({
        tenantId: tenant.id,
        name: lojaInput.name,
        empId: lojaInput.empId,
        cnpj: lojaInput.cnpj,
        sqlEnabled: lojaInput.sqlEnabled ?? false,
        sqlBridgeUrl: lojaInput.sqlBridgeUrl,
        sqlBridgeToken: lojaInput.sqlBridgeToken,
      });
      lojaIds.push(loja.id);
    }

    // 3. Ativar features contratadas
    if (input.features.length > 0) {
      const { error } = await supabase.from("tenant_features").insert(
        input.features.map((key) => ({ tenant_id: tenant.id, feature_key: key }))
      );
      if (error) throw new Error(`Erro ao salvar features: ${error.message}`);
    }

    // 4. Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: input.usuario.email,
      password: input.usuario.senha,
      user_metadata: { full_name: input.usuario.nomeCompleto },
      email_confirm: true,
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message ?? "Falha ao criar usuário no Auth");
    }
    usuarioId = authData.user.id;

    // 5. Vincular usuário ao tenant — primeiro usuário sempre como owner
    const { error: linkError } = await supabase.from("tenant_users").insert({
      tenant_id: tenant.id,
      user_id: usuarioId,
      role: input.usuario.papel ?? "owner",
    });
    if (linkError) throw new Error(`Erro ao vincular usuário: ${linkError.message}`);

    return { tenantId, lojaIds, usuarioId };
  } catch (err) {
    // Tentar reverter em ordem inversa para minimizar dados órfãos
    if (usuarioId) try { await supabase.auth.admin.deleteUser(usuarioId) } catch {}
    if (lojaIds.length > 0) {
      try { await supabase.from("lojas").delete().in("id", lojaIds) } catch {}
    }
    if (tenantId) {
      try { await supabase.from("tenant_features").delete().eq("tenant_id", tenantId) } catch {}
      try { await supabase.from("tenants").delete().eq("id", tenantId) } catch {}
    }
    throw err;
  }
}

/** Substitui os módulos ativos de um tenant e ajusta o plano automaticamente */
export async function updateTenantFeatures(
  tenantId: string,
  features: string[]
): Promise<void> {
  const supabase = createAdminClient();

  // Determinar plano com base nas features premium selecionadas
  const premiumKeys = new Set(
    FEATURES_CATALOG.filter((f) => f.categoria === "premium").map((f) => f.key)
  );
  const temPremium = features.some((k) => premiumKeys.has(k));
  const novoPlano = temPremium ? "premium" : "free";

  // Substituir features — delete + insert (não upsert para não deixar antigas)
  await supabase.from("tenant_features").delete().eq("tenant_id", tenantId);

  if (features.length > 0) {
    const { error } = await supabase.from("tenant_features").insert(
      features.map((key) => ({ tenant_id: tenantId, feature_key: key }))
    );
    if (error) throw new Error(`Erro ao salvar features: ${error.message}`);
  }

  // Atualizar plano do tenant
  const { error: planError } = await supabase
    .from("tenants")
    .update({ plan: novoPlano })
    .eq("id", tenantId);

  if (planError) throw new Error(`Erro ao atualizar plano: ${planError.message}`);
}

/** Adiciona uma nova loja a um tenant existente */
export async function adicionarLoja(
  tenantId: string,
  loja: { name: string; empId: number; sqlBridgeUrl?: string; sqlBridgeToken?: string; sqlEnabled?: boolean }
): Promise<string> {
  const novaLoja = await createLoja({
    tenantId,
    name: loja.name,
    empId: loja.empId,
    sqlEnabled: loja.sqlEnabled ?? false,
    sqlBridgeUrl: loja.sqlBridgeUrl,
    sqlBridgeToken: loja.sqlBridgeToken,
  });
  return novaLoja.id;
}

// ── Usuários ───────────────────────────────────────────────────────────────

export type UsuarioTenant = {
  id: string;
  userId: string;
  role: UserRole;
  fullName: string;
  email: string;
};

export type ErpMapping = {
  lojaId: string;
  lojaNome: string;
  cliId: number;
  cliNome: string;
  tiposBloqueados: number[];
};

export type UserTenantSettings = {
  lojaIds: string[];
  modulos: Record<string, boolean>;
};

export type UsuarioTenantCompleto = UsuarioTenant & {
  settings: UserTenantSettings | null;
  erpMappings: ErpMapping[];
};

/** Retorna os usuários vinculados a um tenant com nome e email */
export async function getUsuariosTenant(tenantId: string): Promise<UsuarioTenant[]> {
  const supabase = createAdminClient();

  const { data: tenantUsers } = await supabase
    .from("tenant_users")
    .select("id, user_id, role")
    .eq("tenant_id", tenantId);

  if (!tenantUsers?.length) return [];

  const rows = tenantUsers as { id: string; user_id: string; role: string }[];
  const userIds = rows.map((u) => u.user_id);

  // Buscar nomes na tabela profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const profileMap = new Map(
    ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [
      p.id,
      p.full_name ?? "",
    ])
  );

  // Buscar emails via admin API (um por usuário; volume esperado < 20)
  const resultados: UsuarioTenant[] = await Promise.all(
    rows.map(async (u) => {
      let email = "";
      try {
        const { data } = await supabase.auth.admin.getUserById(u.user_id);
        email = data?.user?.email ?? "";
      } catch {
        // se falhar, deixa email vazio
      }
      return {
        id: u.id,
        userId: u.user_id,
        role: u.role as UserRole,
        fullName: profileMap.get(u.user_id) ?? "",
        email,
      };
    })
  );

  return resultados;
}

/** Retorna usuários com configurações completas (settings + ERP mappings) */
export async function getUsuariosTenantDetalhado(
  tenantId: string
): Promise<UsuarioTenantCompleto[]> {
  const supabase = createAdminClient();

  const [tenantUsersRes, settingsRes, lojasRes] = await Promise.all([
    supabase.from("tenant_users").select("id, user_id, role").eq("tenant_id", tenantId),
    supabase.from("user_tenant_settings").select("user_id, loja_ids, modulos").eq("tenant_id", tenantId),
    supabase.from("lojas").select("id, name").eq("tenant_id", tenantId).eq("is_active", true),
  ]);

  const rows = (tenantUsersRes.data ?? []) as { id: string; user_id: string; role: string }[];
  if (!rows.length) return [];

  const userIds = rows.map((u) => u.user_id);

  const { data: erpData } = await supabase
    .from("loja_usuarios_erp")
    .select("loja_id, cli_id, cli_nome, supabase_user_id, tipos_bloqueados")
    .in("supabase_user_id", userIds);

  const lojas = ((lojasRes.data ?? []) as { id: string; name: string }[]);
  const lojaMap = new Map(lojas.map((l) => [l.id, l.name]));

  const settingsMap = new Map(
    ((settingsRes.data ?? []) as { user_id: string; loja_ids: unknown; modulos: unknown }[]).map(
      (s) => [s.user_id, {
        lojaIds: Array.isArray(s.loja_ids) ? (s.loja_ids as string[]) : [],
        modulos: (s.modulos ?? {}) as Record<string, boolean>,
      }]
    )
  );

  const erpByUser = new Map<string, ErpMapping[]>();
  for (const e of (erpData ?? []) as {
    loja_id: string; cli_id: number; cli_nome: string;
    supabase_user_id: string; tipos_bloqueados: unknown;
  }[]) {
    if (!e.supabase_user_id) continue;
    const list = erpByUser.get(e.supabase_user_id) ?? [];
    list.push({
      lojaId: e.loja_id,
      lojaNome: lojaMap.get(e.loja_id) ?? e.loja_id,
      cliId: Number(e.cli_id),
      cliNome: e.cli_nome ?? "",
      tiposBloqueados: Array.isArray(e.tipos_bloqueados)
        ? (e.tipos_bloqueados as unknown[]).map(Number).filter((n) => n > 0)
        : [],
    });
    erpByUser.set(e.supabase_user_id, list);
  }

  // Nomes via profiles
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
  const profileMap = new Map(
    ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? ""])
  );

  // Emails via admin API
  const resultados: UsuarioTenantCompleto[] = await Promise.all(
    rows.map(async (u) => {
      let email = "";
      try {
        const { data } = await supabase.auth.admin.getUserById(u.user_id);
        email = data?.user?.email ?? "";
      } catch { /* ignore */ }
      return {
        id: u.id,
        userId: u.user_id,
        role: u.role as UserRole,
        fullName: profileMap.get(u.user_id) ?? "",
        email,
        settings: settingsMap.get(u.user_id) ?? null,
        erpMappings: erpByUser.get(u.user_id) ?? [],
      };
    })
  );

  return resultados;
}

/** Salva (upsert) configurações de acesso de um usuário no tenant */
export async function salvarConfigUsuario(
  tenantId: string,
  userId: string,
  config: { lojaIds: string[]; modulos: Record<string, boolean> }
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("user_tenant_settings").upsert(
    { tenant_id: tenantId, user_id: userId, loja_ids: config.lojaIds, modulos: config.modulos },
    { onConflict: "tenant_id,user_id" }
  );
  if (error) throw new Error(`Erro ao salvar configurações: ${error.message}`);
}
