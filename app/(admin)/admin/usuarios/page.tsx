export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isSystemAdmin } from "@/lib/db/admin";
import { UsuariosClient } from "./usuarios-client";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = await isSystemAdmin(user.id);
  if (!admin) redirect("/dashboard");

  const adminClient = createAdminClient();

  // Buscar todos os vínculos de usuário com tenants
  const { data: tenantUsers } = await adminClient
    .from("tenant_users")
    .select("user_id, role, tenant_id, tenants ( id, name, slug, plan )")
    .order("user_id");

  // Buscar profiles
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("id, full_name, is_system_admin");

  // Buscar usuários do Auth (email, último login)
  const { data: authData } = await adminClient.auth.admin.listUsers();

  type UsuarioEntry = {
    id: string;
    email: string;
    full_name: string;
    is_system_admin: boolean;
    last_sign_in: string | null;
    created_at: string;
    empresas: Array<{
      tenant_id: string;
      tenant_name: string;
      tenant_slug: string;
      role: string;
    }>;
  };

  // Montar mapa consolidado por usuário
  const usuariosMap = new Map<string, UsuarioEntry>();

  for (const authUser of authData?.users ?? []) {
    // Clientes do e-commerce (cadastro pelo storefront) trazem loja_id no
    // metadata — não são usuários do painel administrativo. Defesa extra além
    // do fix em handle_new_user(): mesmo que algum fluxo futuro crie um
    // profile sem passar por lá, esta tela não deve listar cliente de loja.
    if (authUser.user_metadata?.loja_id) continue;

    const profile = profiles?.find((p) => p.id === authUser.id);
    usuariosMap.set(authUser.id, {
      id: authUser.id,
      email: authUser.email ?? "",
      full_name: (profile as { full_name?: string } | undefined)?.full_name ?? "",
      is_system_admin:
        (profile as { is_system_admin?: boolean } | undefined)?.is_system_admin ?? false,
      last_sign_in: authUser.last_sign_in_at ?? null,
      created_at: authUser.created_at,
      empresas: [],
    });
  }

  for (const tu of (tenantUsers ?? []) as unknown as Array<{
    user_id: string;
    role: string;
    tenant_id: string;
    tenants: { id: string; name: string; slug: string } | null;
  }>) {
    const u = usuariosMap.get(tu.user_id);
    if (!u) continue;
    const t = tu.tenants;
    if (!t) continue;
    u.empresas.push({
      tenant_id: t.id,
      tenant_name: t.name,
      tenant_slug: t.slug,
      role: tu.role,
    });
  }

  // Buscar todas as empresas ativas para o modal de vinculação
  const { data: todasEmpresas } = await adminClient
    .from("tenants")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("name");

  return (
    <UsuariosClient
      usuarios={Array.from(usuariosMap.values())}
      todasEmpresas={(todasEmpresas ?? []) as { id: string; name: string; slug: string }[]}
    />
  );
}
