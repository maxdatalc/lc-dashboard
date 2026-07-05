import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { planHasFeature } from "@/lib/plans";
import { requireTenantAccess } from "./tenant-guard";

function makeAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function checkPlan(tenantId: string, featureKey: string): Promise<NextResponse | null> {
  const admin = makeAdminClient();

  const [{ data: tenant }, { data: moduleSetting }] = await Promise.all([
    admin.from("tenants").select("plan").eq("id", tenantId).maybeSingle(),
    admin
      .from("module_settings")
      .select("kill_switch_enabled")
      .eq("feature_key", featureKey)
      .maybeSingle(),
  ]);

  if ((moduleSetting as { kill_switch_enabled?: boolean } | null)?.kill_switch_enabled === true) {
    return NextResponse.json(
      { error: "Módulo temporariamente indisponível", feature: featureKey },
      { status: 403 }
    );
  }

  const plan = (tenant as { plan?: string } | null)?.plan ?? "free";

  if (!planHasFeature(plan as "free" | "premium", featureKey)) {
    return NextResponse.json(
      { error: "Módulo não disponível no plano atual", feature: featureKey, plan },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Verifica autenticação + vínculo ao tenant + plano.
 * Não valida lojaIds — use requireFeatureWithLojas para isso.
 */
export async function requireFeature(featureKey: string): Promise<NextResponse | null> {
  const ctx = await requireTenantAccess();
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.isSystemAdmin) return null;
  return checkPlan(ctx.tenantId, featureKey);
}

/**
 * Verifica autenticação + vínculo ao tenant + ownership das lojas + plano.
 * Use em rotas que recebem lojaIds como parâmetro.
 */
export async function requireFeatureWithLojas(
  featureKey: string,
  lojaIds: string[]
): Promise<NextResponse | null> {
  const ctx = await requireTenantAccess(lojaIds);
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.isSystemAdmin) return null;
  return checkPlan(ctx.tenantId, featureKey);
}
