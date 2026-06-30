import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface LojaDb {
  id: string;
  name: string;
  sql_bridge_url: string | null;
  tenant_id: string;
  tenants: { name: string; slug: string } | null;
}

export interface BridgeLojaEntry {
  lojaId: string;
  lojaName: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
}

export interface BridgeStatusEntry {
  bridgeUrl: string;
  bridgeHost: string;
  connected: boolean;
  dbName: string | null;
  latencyMs: number | null;
  lojas: BridgeLojaEntry[];
}

export interface BridgeStatusResponse {
  bridges: BridgeStatusEntry[];
  totalUnconfigured: number;
  checkedAt: string;
}

async function pingBridge(url: string): Promise<{
  connected: boolean;
  dbName: string | null;
  latencyMs: number | null;
}> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 4000);
    const t0 = Date.now();

    const res = await fetch(`${url}/health`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(tid);

    const latencyMs = Date.now() - t0;
    if (!res.ok) return { connected: false, dbName: null, latencyMs: null };

    const data = (await res.json()) as { ok?: boolean; db?: string; sql?: boolean };
    return {
      connected: data.ok === true && data.sql !== false,
      dbName: data.db ?? null,
      latencyMs,
    };
  } catch {
    return { connected: false, dbName: null, latencyMs: null };
  }
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("is_system_admin, is_suporte")
    .eq("id", user.id)
    .maybeSingle();

  const p = profile as { is_system_admin?: boolean; is_suporte?: boolean } | null;
  if (!p?.is_system_admin && !p?.is_suporte) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { data: allLojas } = await adminClient
    .from("lojas")
    .select("id, name, sql_bridge_url, tenant_id, tenants(name, slug)")
    .eq("is_active", true);

  const rows = (allLojas ?? []) as unknown as LojaDb[];

  // Agrupa por URL de bridge única
  const bridgeMap = new Map<string, LojaDb[]>();
  let totalUnconfigured = 0;

  for (const loja of rows) {
    if (loja.sql_bridge_url) {
      const key = loja.sql_bridge_url;
      if (!bridgeMap.has(key)) bridgeMap.set(key, []);
      bridgeMap.get(key)!.push(loja);
    } else {
      totalUnconfigured++;
    }
  }

  // Pinga todas as bridges em paralelo
  const bridgeUrls = Array.from(bridgeMap.keys());
  const healths = await Promise.all(bridgeUrls.map(pingBridge));

  const bridges: BridgeStatusEntry[] = bridgeUrls.map((url, i) => {
    const lojas = bridgeMap.get(url)!;
    const h = healths[i];
    let bridgeHost = url;
    try {
      bridgeHost = new URL(url).hostname;
    } catch {}

    return {
      bridgeUrl: url,
      bridgeHost,
      connected: h.connected,
      dbName: h.dbName,
      latencyMs: h.latencyMs,
      lojas: lojas.map((l) => ({
        lojaId: l.id,
        lojaName: l.name,
        tenantId: l.tenant_id,
        tenantName: l.tenants?.name ?? "—",
        tenantSlug: l.tenants?.slug ?? "",
      })),
    };
  });

  // Online primeiro, depois offline; dentro de cada grupo ordena por host
  bridges.sort((a, b) => {
    if (a.connected !== b.connected) return a.connected ? -1 : 1;
    return a.bridgeHost.localeCompare(b.bridgeHost);
  });

  return NextResponse.json({
    bridges,
    totalUnconfigured,
    checkedAt: new Date().toISOString(),
  } satisfies BridgeStatusResponse);
}
