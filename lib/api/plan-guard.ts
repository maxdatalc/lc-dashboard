import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { planHasFeature } from "@/lib/plans";
import { cookies } from "next/headers";

/**
 * Verifica se o usuário autenticado tem acesso a uma feature específica.
 * Retorna um NextResponse de erro (401/403) se não tiver, ou null se tiver.
 *
 * Uso nas route handlers:
 *   const denied = await requireFeature("modulo_financeiro");
 *   if (denied) return denied;
 */
export async function requireFeature(featureKey: string): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // System admins têm acesso a tudo
  const { data: profile } = await adminClient
    .from("profiles")
    .select("is_system_admin")
    .eq("id", user.id)
    .maybeSingle();

  if ((profile as { is_system_admin?: boolean } | null)?.is_system_admin) {
    return null;
  }

  const cookieStore = await cookies();
  const tenantId = cookieStore.get("selected_tenant_id")?.value;

  if (!tenantId) {
    return NextResponse.json({ error: "Empresa não selecionada" }, { status: 403 });
  }

  const { data: tenant } = await adminClient
    .from("tenants")
    .select("plan")
    .eq("id", tenantId)
    .maybeSingle();

  const plan = (tenant as { plan?: string } | null)?.plan ?? "free";

  if (!planHasFeature(plan as "free" | "premium", featureKey)) {
    return NextResponse.json(
      { error: "Módulo não disponível no plano atual", feature: featureKey, plan },
      { status: 403 }
    );
  }

  return null;
}
