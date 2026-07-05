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

// Throttle: evita gravar no banco mais de 1x por minuto por tenant+módulo
const _moduleAccessCache = new Map<string, number>();

/** Registra 1 acesso ao módulo (para "módulos mais acessados"), com throttle de 60s. */
async function trackModuleAccess(tenantId: string, featureKey: string): Promise<void> {
  const cacheKey = `${tenantId}:${featureKey}`;
  if (Date.now() - (_moduleAccessCache.get(cacheKey) ?? 0) <= 60_000) return;
  _moduleAccessCache.set(cacheKey, Date.now());
  const admin = makeAdminClient();
  try {
    await admin.rpc("track_module_access", { p_tenant_id: tenantId, p_feature_key: featureKey });
  } catch (e) {
    console.error("[module-access-tracking] falha ao registrar acesso:", e);
  }
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
  if (ctx.isSystemAdmin) {
    await trackModuleAccess(ctx.tenantId, featureKey);
    return null;
  }
  const blocked = await checkPlan(ctx.tenantId, featureKey);
  if (blocked) return blocked;
  await trackModuleAccess(ctx.tenantId, featureKey);
  return null;
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
  if (ctx.isSystemAdmin) {
    await trackModuleAccess(ctx.tenantId, featureKey);
    return null;
  }
  const blocked = await checkPlan(ctx.tenantId, featureKey);
  if (blocked) return blocked;
  await trackModuleAccess(ctx.tenantId, featureKey);
  return null;
}
