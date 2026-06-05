export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { isSystemAdmin } from "@/lib/db/admin";
import { UsuarioDetalheClient } from "./usuario-detalhe-client";

export default async function UsuarioDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = await isSystemAdmin(user.id);
  if (!admin) redirect("/dashboard");

  const adminClient = createAdminClient();

  // Buscar dados do usuário no Auth
  const { data: authData, error } = await adminClient.auth.admin.getUserById(id);
  if (error || !authData.user) notFound();

  const authUser = authData.user;

  // Buscar profile e empresas em paralelo
  const [profileRes, tenantUsersRes, todasEmpresasRes] = await Promise.all([
    adminClient
      .from("profiles")
      .select("id, full_name, is_system_admin")
      .eq("id", id)
      .maybeSingle(),
    adminClient
      .from("tenant_users")
      .select("tenant_id, role, tenants ( id, name, slug, plan, is_active )")
      .eq("user_id", id),
    adminClient
      .from("tenants")
      .select("id, name, slug, plan")
      .eq("is_active", true)
      .order("name"),
  ]);

  const profile = profileRes.data as {
    id: string;
    full_name: string | null;
    is_system_admin: boolean;
  } | null;

  const empresasVinculadas = ((tenantUsersRes.data ?? []) as unknown as Array<{
    tenant_id: string;
    role: string;
    tenants: {
      id: string;
      name: string;
      slug: string;
      plan: string;
      is_active: boolean;
    } | null;
  }>)
    .map((tu) => {
      const t = tu.tenants;
      if (!t) return null;
      return {
        tenant_id: t.id,
        tenant_name: t.name,
        tenant_slug: t.slug,
        tenant_plan: t.plan,
        tenant_ativo: t.is_active,
        role: tu.role as "admin" | "viewer",
      };
    })
    .filter(Boolean) as {
      tenant_id: string;
      tenant_name: string;
      tenant_slug: string;
      tenant_plan: string;
      tenant_ativo: boolean;
      role: "admin" | "viewer";
    }[];

  const usuario = {
    id: authUser.id,
    email: authUser.email ?? "",
    full_name: profile?.full_name ?? "",
    is_system_admin: profile?.is_system_admin ?? false,
    last_sign_in: authUser.last_sign_in_at ?? null,
    created_at: authUser.created_at,
    phone: authUser.phone ?? null,
  };

  return (
    <UsuarioDetalheClient
      usuario={usuario}
      empresasVinculadas={empresasVinculadas}
      todasEmpresas={
        ((todasEmpresasRes.data ?? []) as {
          id: string;
          name: string;
          slug: string;
          plan: string;
        }[])
      }
    />
  );
}
