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

export interface GetTenantsResult {
  error?: string;
  tenants?: TenantOption[];
}

// Busca tenants do usuário pelo email — chamada após digitar email
// Não valida senha ainda — apenas retorna opções de empresa para popular o select
export async function getTenantsByEmail(
  email: string
): Promise<GetTenantsResult> {
  if (!email || !email.includes("@")) return { tenants: [] };

  const adminClient = createAdminClient();

  const { data: authUsers } = await adminClient.auth.admin.listUsers();
  const authUser = authUsers?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!authUser) return { tenants: [] };

  const { data: tenantUsers } = await adminClient
    .from("tenant_users")
    .select("tenant_id, tenants ( id, name, slug, plan )")
    .eq("user_id", authUser.id);

  const tenants: TenantOption[] = (
    (tenantUsers ?? []) as unknown as Array<{
      tenant_id: string;
      tenants: { id: string; name: string; slug: string; plan: string } | null;
    }>
  )
    .map((tu) => {
      const t = tu.tenants;
      if (!t) return null;
      return { id: t.id, name: t.name, slug: t.slug, plan: t.plan };
    })
    .filter((x): x is TenantOption => x !== null);

  return { tenants };
}

// Login completo: valida credenciais + tenant selecionado + grava cookies
export async function login(formData: FormData): Promise<{ error?: string }> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const tenantId = formData.get("tenantId") as string | null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: "E-mail ou senha inválidos" };
  }

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from("profiles")
    .select("is_system_admin")
    .eq("id", data.user.id)
    .maybeSingle();

  const isAdmin =
    (profile as { is_system_admin?: boolean } | null)?.is_system_admin;

  if (isAdmin) {
    redirect("/admin");
  }

  const { data: tenantUsers } = await adminClient
    .from("tenant_users")
    .select("tenant_id, tenants ( id, name, slug, plan )")
    .eq("user_id", data.user.id);

  const tenants: TenantOption[] = (
    (tenantUsers ?? []) as unknown as Array<{
      tenant_id: string;
      tenants: { id: string; name: string; slug: string; plan: string } | null;
    }>
  )
    .map((tu) => {
      const t = tu.tenants;
      if (!t) return null;
      return { id: t.id, name: t.name, slug: t.slug, plan: t.plan };
    })
    .filter((x): x is TenantOption => x !== null);

  if (tenants.length === 0) {
    await supabase.auth.signOut();
    return {
      error:
        "Sua conta não está vinculada a nenhuma empresa. Contate o suporte.",
    };
  }

  let tenantFinal: TenantOption | null = null;

  if (tenantId) {
    tenantFinal = tenants.find((t) => t.id === tenantId) ?? null;
  }

  if (!tenantFinal) {
    if (tenants.length === 1) {
      tenantFinal = tenants[0];
    } else {
      await supabase.auth.signOut();
      return { error: "Selecione uma empresa para continuar" };
    }
  }

  const { data: loja } = await adminClient
    .from("lojas")
    .select("id")
    .eq("tenant_id", tenantFinal.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const cookieStore = await cookies();
  cookieStore.set("selected_tenant_id", tenantFinal.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  if (loja?.id) {
    cookieStore.set("selected_loja_id", loja.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete("selected_tenant_id");
  cookieStore.delete("selected_loja_id");

  redirect("/login");
}
