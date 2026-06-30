import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getAllTenants } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

// ── Tipos de resposta ───────────────────────────────────────────────────────────

export interface BridgeClient {
  tenantName: string;
  lojaNames: string[];
}

export interface BridgeStatusEntry {
  bridgeUrl: string;
  bridgeHost: string;
  connected: boolean;
  dbName: string | null;
  latencyMs: number | null;
  clients: BridgeClient[];
  lojaCount: number;
}

export interface AccessRow {
  id: string;
  name: string;
  slug: string;
  lastSeenAt: string | null;
  totalAccesses: number | null;
  lastUserName: string | null;
}

export interface MonitoramentoResponse {
  checkedAt: string;
  bridges: BridgeStatusEntry[];
  bridgeSummary: {
    online: number;
    offline: number;
    unconfigured: number;
    avgLatencyMs: number | null;
  };
  access: AccessRow[];
  accessSummary: { ativos24h: number; ativos7d: number; total: number };
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

interface LojaDb {
  id: string;
  name: string;
  sql_bridge_url: string | null;
  tenant_id: string;
  tenants: { name: string; slug: string } | null;
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
    const res = await fetch(`${url}/health`, { signal: controller.signal, cache: "no-store" });
    clearTimeout(tid);
    const latencyMs = Date.now() - t0;
    if (!res.ok) return { connected: false, dbName: null, latencyMs: null };
    const data = (await res.json()) as { ok?: boolean; db?: string; sql?: boolean };
    return { connected: data.ok === true && data.sql !== false, dbName: data.db ?? null, latencyMs };
  } catch {
    return { connected: false, dbName: null, latencyMs: null };
  }
}

type AccessStats = {
  tenant_id: string;
  last_seen_at: string;
  total_accesses: number;
  last_user_name: string | null;
};

// ── Handler ────────────────────────────────────────────────────────────────────

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

  // ── Bridges + Acessos em paralelo ──────────────────────────────────────────
  const [lojasRes, tenants, statsRes] = await Promise.all([
    adminClient
      .from("lojas")
      .select("id, name, sql_bridge_url, tenant_id, tenants(name, slug)")
      .eq("is_active", true),
    getAllTenants(),
    adminClient
      .from("tenant_access_stats")
      .select("tenant_id, last_seen_at, total_accesses, last_user_name"),
  ]);

  // ── Agrupa lojas por URL de bridge única ───────────────────────────────────
  const rows = (lojasRes.data ?? []) as unknown as LojaDb[];
  const bridgeMap = new Map<string, LojaDb[]>();
  let unconfigured = 0;
  for (const loja of rows) {
    if (loja.sql_bridge_url) {
      if (!bridgeMap.has(loja.sql_bridge_url)) bridgeMap.set(loja.sql_bridge_url, []);
      bridgeMap.get(loja.sql_bridge_url)!.push(loja);
    } else {
      unconfigured++;
    }
  }

  const bridgeUrls = Array.from(bridgeMap.keys());
  const healths = await Promise.all(bridgeUrls.map(pingBridge));

  const bridges: BridgeStatusEntry[] = bridgeUrls.map((url, i) => {
    const lojas = bridgeMap.get(url)!;
    const h = healths[i];
    let bridgeHost = url;
    try {
      bridgeHost = new URL(url).hostname;
    } catch {}

    // Agrupa lojas por tenant para evitar dezenas de pills repetidas
    const byTenant = new Map<string, BridgeClient>();
    for (const l of lojas) {
      const tName = l.tenants?.name ?? "—";
      if (!byTenant.has(tName)) byTenant.set(tName, { tenantName: tName, lojaNames: [] });
      byTenant.get(tName)!.lojaNames.push(l.name);
    }

    return {
      bridgeUrl: url,
      bridgeHost,
      connected: h.connected,
      dbName: h.dbName,
      latencyMs: h.latencyMs,
      clients: Array.from(byTenant.values()),
      lojaCount: lojas.length,
    };
  });

  bridges.sort((a, b) => {
    if (a.connected !== b.connected) return a.connected ? -1 : 1;
    return a.bridgeHost.localeCompare(b.bridgeHost);
  });

  const online = bridges.filter((b) => b.connected).length;
  const offline = bridges.length - online;
  const lats = bridges.filter((b) => b.latencyMs != null).map((b) => b.latencyMs!);
  const avgLatencyMs = lats.length ? Math.round(lats.reduce((s, n) => s + n, 0) / lats.length) : null;

  // ── Acessos dos clientes ───────────────────────────────────────────────────
  const statsMap = new Map<string, AccessStats>(
    ((statsRes.data ?? []) as AccessStats[]).map((s) => [s.tenant_id, s])
  );

  const comAcesso = tenants
    .filter((t) => statsMap.has(t.id))
    .sort(
      (a, b) =>
        new Date(statsMap.get(b.id)!.last_seen_at).getTime() -
        new Date(statsMap.get(a.id)!.last_seen_at).getTime()
    );
  const semAcesso = tenants.filter((t) => !statsMap.has(t.id));

  const access: AccessRow[] = [...comAcesso, ...semAcesso].map((t) => {
    const s = statsMap.get(t.id) ?? null;
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      lastSeenAt: s?.last_seen_at ?? null,
      totalAccesses: s?.total_accesses ?? null,
      lastUserName: s?.last_user_name ?? null,
    };
  });

  const now = Date.now();
  const accessSummary = {
    ativos24h: comAcesso.filter(
      (t) => now - new Date(statsMap.get(t.id)!.last_seen_at).getTime() < 86_400_000
    ).length,
    ativos7d: comAcesso.filter(
      (t) => now - new Date(statsMap.get(t.id)!.last_seen_at).getTime() < 604_800_000
    ).length,
    total: tenants.length,
  };

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    bridges,
    bridgeSummary: { online, offline, unconfigured, avgLatencyMs },
    access,
    accessSummary,
  } satisfies MonitoramentoResponse);
}
