export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getAllTenants } from "@/lib/db/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { MonitoramentoClient, type AccessRow, type AccessSummary } from "@/components/admin/MonitoramentoClient";

type AccessStats = {
  tenant_id: string;
  last_seen_at: string;
  total_accesses: number;
  last_user_name: string | null;
};

export default async function AdminAcessosPage() {
  const admin = createAdminClient();

  const [tenants, statsRes] = await Promise.all([
    getAllTenants(),
    admin
      .from("tenant_access_stats")
      .select("tenant_id, last_seen_at, total_accesses, last_user_name")
      .order("last_seen_at", { ascending: false }),
  ]);

  const statsMap = new Map<string, AccessStats>(
    ((statsRes.data ?? []) as AccessStats[]).map((s) => [s.tenant_id, s])
  );

  const comAcesso = tenants
    .filter((t) => statsMap.has(t.id))
    .sort((a, b) => {
      const ta = new Date(statsMap.get(a.id)!.last_seen_at).getTime();
      const tb = new Date(statsMap.get(b.id)!.last_seen_at).getTime();
      return tb - ta;
    });
  const semAcesso = tenants.filter((t) => !statsMap.has(t.id));

  const rows: AccessRow[] = [...comAcesso, ...semAcesso].map((t) => {
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
  const summary: AccessSummary = {
    ativos24h: comAcesso.filter(
      (t) => now - new Date(statsMap.get(t.id)!.last_seen_at).getTime() < 86_400_000
    ).length,
    ativos7d: comAcesso.filter(
      (t) => now - new Date(statsMap.get(t.id)!.last_seen_at).getTime() < 604_800_000
    ).length,
    total: tenants.length,
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Monitoramento</h1>
        <p className="text-slate-500 text-sm mt-1">
          Bridges SQL e acessos dos clientes em um só lugar
        </p>
      </div>
      <MonitoramentoClient rows={rows} summary={summary} />
    </div>
  );
}
