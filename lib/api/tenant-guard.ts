import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { UserRole } from "@/lib/plans";

// Throttle: evita gravar no banco mais de 1x por minuto por usuário+tenant
const _accessCache = new Map<string, number>();

export type TenantContext = {
  userId: string;
  tenantId: string;
  role: UserRole;
  isSystemAdmin: boolean;
};

function makeAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Garante que o usuário autenticado tem acesso ao tenant no cookie selected_tenant_id.
 * Se lojaIds for fornecido, verifica que TODAS pertencem ao tenant — impede que um usuário
 * passe lojaIds de outras empresas nos parâmetros de URL.
 *
 * Retorna TenantContext se tudo estiver OK, ou NextResponse de erro (401/403).
 */
export async function requireTenantAccess(
  lojaIds?: string[]
): Promise<TenantContext | NextResponse> {
  const [supabase, cookieStore] = await Promise.all([createClient(), cookies()]);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const tenantId = cookieStore.get("selected_tenant_id")?.value;
  if (!tenantId) {
    return NextResponse.json({ error: "Empresa não selecionada" }, { status: 403 });
  }

  const admin = makeAdminClient();

  // Busca perfil + vínculo ao tenant em paralelo
  const [profileRes, membershipRes] = await Promise.all([
    admin
      .from("profiles")
      .select("is_system_admin, full_name")
      .eq("id", user.id)
      .maybeSingle(),
    admin
      .from("tenant_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);

  const profileData = profileRes.data as { is_system_admin?: boolean; full_name?: string } | null;
  const isSystemAdmin = profileData?.is_system_admin === true;

  if (!isSystemAdmin && !membershipRes.data) {
    return NextResponse.json({ error: "Sem acesso a esta empresa" }, { status: 403 });
  }

  const role: UserRole = isSystemAdmin
    ? "owner"
    : ((membershipRes.data as { role: string }).role as UserRole);

  // Valida que todos os lojaIds pertencem ao tenant — bloqueia enumeração de dados alheios
  if (lojaIds && lojaIds.length > 0) {
    const { data: lojas } = await admin
      .from("lojas")
      .select("id")
      .in("id", lojaIds)
      .eq("tenant_id", tenantId);

    if ((lojas ?? []).length !== lojaIds.length) {
      return NextResponse.json({ error: "Acesso negado a esta loja" }, { status: 403 });
    }
  }

  // Registra acesso (throttle 60s em memória, await garante execução no serverless)
  const cacheKey = `${user.id}:${tenantId}`;
  if ((Date.now() - (_accessCache.get(cacheKey) ?? 0)) > 60_000) {
    _accessCache.set(cacheKey, Date.now());
    const userName = profileData?.full_name ?? user.email ?? "Usuário";
    try {
      await admin.rpc("track_tenant_access", {
        p_tenant_id: tenantId,
        p_user_id: user.id,
        p_user_name: userName,
      });
    } catch (e) {
      console.error("[access-tracking] falha ao registrar acesso:", e);
    }
  }

  return { userId: user.id, tenantId, role, isSystemAdmin };
}
