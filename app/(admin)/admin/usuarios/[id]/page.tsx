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

  const admin = isSystemAdmin(user.id);
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
      .select("tenant_id, role, tenants ( id, name, slug, plan, is_active, features )")
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
      features: string[] | null;
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
        tenant_features: (t.features as string[] | null) ?? [],
        role: tu.role as "owner" | "admin" | "viewer",
      };
    })
    .filter(Boolean) as {
      tenant_id: string;
      tenant_name: string;
      tenant_slug: string;
      tenant_plan: string;
      tenant_ativo: boolean;
      tenant_features: string[];
      role: "owner" | "admin" | "viewer";
    }[];

  // Lojas e configurações de acesso do usuário por empresa vinculada
  const linkedIds = empresasVinculadas.map((e) => e.tenant_id);
  type LojaRow = { id: string; name: string; tenant_id: string };
  type SettingsRow = {
    tenant_id: string;
    loja_ids: string[] | null;
    modulos: Record<string, boolean> | null;
  };
  let lojasData: LojaRow[] = [];
  let settingsData: SettingsRow[] = [];
  if (linkedIds.length > 0) {
    const [lojasAllRes, settingsAllRes] = await Promise.all([
      adminClient
        .from("lojas")
        .select("id, name, tenant_id")
        .in("tenant_id", linkedIds)
        .eq("is_active", true)
        .order("name"),
      adminClient
        .from("user_tenant_settings")
        .select("tenant_id, loja_ids, modulos")
        .eq("user_id", id)
        .in("tenant_id", linkedIds),
    ]);
    lojasData = (lojasAllRes.data ?? []) as LojaRow[];
    settingsData = (settingsAllRes.data ?? []) as SettingsRow[];
  }

  const lojasMap = new Map<string, { id: string; name: string }[]>();
  lojasData.forEach((l) => {
    if (!lojasMap.has(l.tenant_id)) lojasMap.set(l.tenant_id, []);
    lojasMap.get(l.tenant_id)!.push({ id: l.id, name: l.name });
  });
  const settingsMap = new Map<string, { lojaIds: string[]; modulos: Record<string, boolean> }>();
  settingsData.forEach((s) => {
    settingsMap.set(s.tenant_id, { lojaIds: s.loja_ids ?? [], modulos: s.modulos ?? {} });
  });
  const empresasComDetalhes = empresasVinculadas.map((e) => ({
    ...e,
    lojas: lojasMap.get(e.tenant_id) ?? [],
    settings: settingsMap.get(e.tenant_id) ?? { lojaIds: [], modulos: {} },
  }));

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
      empresasVinculadas={empresasComDetalhes}
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
