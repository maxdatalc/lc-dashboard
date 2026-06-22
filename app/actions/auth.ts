"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export interface TenantOption {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

// ── Helpers de cookie ──────────────────────────────────────────────────────────

function tenantCookieOpts() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    ...(process.env.NODE_ENV === "production" ? { domain: ".lcgestor.com.br" } : {}),
  };
}

function tenantCookieDelete() {
  return {
    maxAge: 0,
    path: "/",
    ...(process.env.NODE_ENV === "production" ? { domain: ".lcgestor.com.br" } : {}),
  };
}

async function fetchUserTenants(userId: string): Promise<TenantOption[]> {
  const adminClient = createAdminClient();
  const { data: tenantUsers } = await adminClient
    .from("tenant_users")
    .select("tenant_id, tenants ( id, name, slug, plan )")
    .eq("user_id", userId);

  return (
    (tenantUsers ?? []) as unknown as Array<{
      tenant_id: string;
      tenants: { id: string; name: string; slug: string; plan: string } | null;
    }>
  )
    .map((tu) => tu.tenants)
    .filter((t): t is TenantOption => t !== null);
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login(formData: FormData): Promise<{ error?: string }> {
  const email    = formData.get("email")    as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "E-mail ou senha inválidos" };
  }

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("is_system_admin, is_suporte")
    .eq("id", data.user.id)
    .maybeSingle();

  const p = profile as { is_system_admin?: boolean; is_suporte?: boolean } | null;
  if (p?.is_system_admin || p?.is_suporte) {
    redirect("/admin");
  }

  const tenants = await fetchUserTenants(data.user.id);

  if (tenants.length === 0) {
    await supabase.auth.signOut();
    return { error: "Sua conta não está vinculada a nenhuma empresa. Contate o suporte." };
  }

  // Multi-tenant: vai para tela de seleção (sessão já está ativa)
  if (tenants.length > 1) {
    redirect("/selecionar-empresa");
  }

  // Single tenant: entra direto
  await setTenantCookies(tenants[0].id);
  redirect("/dashboard");
}

// ── Selecionar empresa (na tela de seleção — usuários regulares) ─────────────

export async function selecionarEmpresa(formData: FormData): Promise<void> {
  const tenantId = formData.get("tenantId") as string;
  if (!tenantId) redirect("/selecionar-empresa");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminClient = createAdminClient();
  const { data: acesso } = await adminClient
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!acesso) redirect("/selecionar-empresa");

  await setTenantCookies(tenantId);
  redirect("/dashboard");
}

// ── Selecionar empresa como admin (sem verificar tenant_users) ────────────────

export async function selecionarEmpresaAdmin(formData: FormData): Promise<void> {
  const tenantId = formData.get("tenantId") as string;
  if (!tenantId) redirect("/selecionar-empresa");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("is_system_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!(profile as { is_system_admin?: boolean } | null)?.is_system_admin) {
    redirect("/selecionar-empresa");
  }

  await setTenantCookies(tenantId);
  redirect("/dashboard");
}

async function setTenantCookies(tenantId: string): Promise<void> {
  const adminClient = createAdminClient();
  const { data: loja } = await adminClient
    .from("lojas")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const opts = tenantCookieOpts();
  const cookieStore = await cookies();
  cookieStore.set("selected_tenant_id", tenantId, opts);
  if (loja?.id) cookieStore.set("selected_loja_id", loja.id, opts);
}

// ── Trocar empresa (sidebar → volta para seleção sem deslogar) ────────────────

export async function trocarEmpresa(): Promise<void> {
  const cookieStore = await cookies();
  const del = tenantCookieDelete();
  cookieStore.set("selected_tenant_id", "", del);
  cookieStore.set("selected_loja_id",   "", del);
  redirect("/selecionar-empresa");
}

// ── Logout completo ───────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  const del = tenantCookieDelete();
  cookieStore.set("selected_tenant_id", "", del);
  cookieStore.set("selected_loja_id",   "", del);

  redirect("/login");
}

// ── Primeiro acesso — definir senha permanente ────────────────────────────────

export async function definirSenhaPermanente(novaSenha: string): Promise<{ error?: string }> {
  if (novaSenha.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const { error } = await supabase.auth.updateUser({
    password: novaSenha,
    data: { must_change_password: false },
  });

  if (error) return { error: error.message };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("is_system_admin")
    .eq("id", user.id)
    .maybeSingle();

  const isSysAdmin = (profile as { is_system_admin?: boolean } | null)?.is_system_admin === true;
  if (isSysAdmin) redirect("/admin");

  const tenants = await fetchUserTenants(user.id);
  if (tenants.length === 0) redirect("/login");
  if (tenants.length > 1) redirect("/selecionar-empresa");

  // Single tenant: entra direto
  await setTenantCookies(tenants[0].id);
  redirect("/dashboard");
}
