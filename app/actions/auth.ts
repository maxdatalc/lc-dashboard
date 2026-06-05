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

export interface LoginStep1Result {
  error?: string;
  tenants?: TenantOption[];
  userId?: string;
}

// Etapa 1: valida credenciais e retorna lista de empresas do usuário
export async function loginStep1(
  formData: FormData
): Promise<LoginStep1Result> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: "E-mail ou senha inválidos" };
  }

  const adminClient = createAdminClient();

  // Verificar se é system admin — pula seleção de empresa
  const { data: profile } = await adminClient
    .from("profiles")
    .select("is_system_admin")
    .eq("id", data.user.id)
    .maybeSingle();

  const isAdmin = (profile as { is_system_admin?: boolean } | null)
    ?.is_system_admin;

  if (isAdmin) {
    redirect("/admin");
  }

  // Buscar tenants vinculados ao usuário
  const { data: tenantUsers } = await adminClient
    .from("tenant_users")
    .select("tenant_id, tenants ( id, name, slug, plan )")
    .eq("user_id", data.user.id);

  const tenants: TenantOption[] = ((tenantUsers ?? []) as unknown as Array<{
    tenant_id: string;
    tenants: { id: string; name: string; slug: string; plan: string } | null;
  }>)
    .map((tu) => {
      const t = tu.tenants;
      if (!t) return null;
      return { id: t.id, name: t.name, slug: t.slug, plan: t.plan };
    })
    .filter((x): x is TenantOption => x !== null);

  if (tenants.length === 0) {
    // Usuário sem empresas vinculadas
    await supabase.auth.signOut();
    return {
      error:
        "Sua conta não está vinculada a nenhuma empresa. Contate o suporte.",
    };
  }

  // Se só tem uma empresa, selecionar automaticamente
  if (tenants.length === 1) {
    const tenantId = tenants[0].id;

    const { data: loja } = await adminClient
      .from("lojas")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const cookieStore = await cookies();
    cookieStore.set("selected_tenant_id", tenantId, {
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

  return {
    tenants,
    userId: data.user.id,
  };
}

// Etapa 2: usuário selecionou a empresa — gravar cookie e redirecionar
export async function loginStep2(tenantId: string): Promise<void> {
  const adminClient = createAdminClient();
  const supabase = await createClient();

  // Verificar que o usuário autenticado realmente tem acesso a esse tenant
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: access } = await adminClient
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!access) {
    redirect("/login");
  }

  // Buscar primeira loja do tenant selecionado para auto-selecionar
  const { data: loja } = await adminClient
    .from("lojas")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const cookieStore = await cookies();
  cookieStore.set("selected_tenant_id", tenantId, {
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
