// Funções administrativas para o painel LC Tecnologias
// Usa createAdminClient() em todas as operações (bypassa RLS)

import { createAdminClient } from "@/lib/supabase/server";
import { createTenant, createLoja } from "@/lib/db/tenants";
import { FEATURES_CATALOG } from "@/lib/features";

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
    erpBaseUrl: string;
    isActive: boolean;
  }[];
  features: string[];
  totalUsuarios: number;
};

export type NovoClienteInput = {
  tenant: { name: string; slug: string; plan: "free" | "premium" };
  lojas: { name: string; empId: number; erpBaseUrl: string; terminal: string }[];
  features: string[];
  usuario: {
    email: string;
    senha: string;
    nomeCompleto: string;
    papel: "admin" | "viewer";
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

/** Retorna todos os tenants com lojas, features e contagem de usuários */
export async function getAllTenants(): Promise<TenantComLojas[]> {
  const supabase = createAdminClient();

  // Buscar tenants, lojas, features e usuários em paralelo
  const [tenantRes, lojasRes, featuresRes, usuariosRes] = await Promise.all([
    supabase.from("tenants").select("*").order("created_at", { ascending: false }),
    supabase.from("lojas").select("id, tenant_id, name, emp_id, erp_base_url, is_active"),
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
      erpBaseUrl: l.erp_base_url as string,
      isActive: l.is_active as boolean,
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
    supabase.from("lojas").select("id, name, emp_id, erp_base_url, is_active").eq("tenant_id", id),
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
      erpBaseUrl: l.erp_base_url as string,
      isActive: l.is_active as boolean,
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

    // 2. Criar todas as lojas em sequência (terminal criptografado internamente)
    for (const lojaInput of input.lojas) {
      const loja = await createLoja({
        tenantId: tenant.id,
        name: lojaInput.name,
        empId: lojaInput.empId,
        erpBaseUrl: lojaInput.erpBaseUrl,
        terminal: lojaInput.terminal,
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

    // 5. Vincular usuário ao tenant
    const { error: linkError } = await supabase.from("tenant_users").insert({
      tenant_id: tenant.id,
      user_id: usuarioId,
      role: input.usuario.papel,
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
  loja: { name: string; empId: number; erpBaseUrl: string; terminal: string }
): Promise<string> {
  const novaLoja = await createLoja({
    tenantId,
    name: loja.name,
    empId: loja.empId,
    erpBaseUrl: loja.erpBaseUrl,
    terminal: loja.terminal,
  });
  return novaLoja.id;
}
