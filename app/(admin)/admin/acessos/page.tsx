export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Activity } from "lucide-react";
import { getAllTenants } from "@/lib/db/admin";
import { createAdminClient } from "@/lib/supabase/server";

type AccessStats = {
  tenant_id: string;
  last_seen_at: string;
  total_accesses: number;
  last_user_name: string | null;
};

function tempoRelativo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "Agora mesmo";
  if (m < 60) return `Há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Ontem";
  if (d < 7) return `Há ${d} dias`;
  if (d < 30) return `Há ${Math.floor(d / 7)} sem.`;
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function statusAcesso(dateStr: string | null): { label: string; dot: string; text: string } {
  if (!dateStr) return { label: "Nunca", dot: "bg-slate-300", text: "text-slate-400" };
  const h = (Date.now() - new Date(dateStr).getTime()) / 3_600_000;
  if (h < 24) return { label: "Hoje", dot: "bg-emerald-500", text: "text-emerald-700" };
  if (h < 168) return { label: "Esta semana", dot: "bg-amber-400", text: "text-amber-700" };
  return { label: "Inativo", dot: "bg-slate-300", text: "text-slate-500" };
}

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

  // Mescla: tenants com stats primeiro (sorted by last_seen_at), depois os sem acesso
  const comAcesso = tenants
    .filter((t) => statsMap.has(t.id))
    .sort((a, b) => {
      const ta = new Date(statsMap.get(a.id)!.last_seen_at).getTime();
      const tb = new Date(statsMap.get(b.id)!.last_seen_at).getTime();
      return tb - ta;
    });
  const semAcesso = tenants.filter((t) => !statsMap.has(t.id));
  const rows = [...comAcesso, ...semAcesso];

  // Métricas rápidas
  const ativos24h = comAcesso.filter(
    (t) => (Date.now() - new Date(statsMap.get(t.id)!.last_seen_at).getTime()) < 86_400_000
  ).length;
  const ativos7d = comAcesso.filter(
    (t) => (Date.now() - new Date(statsMap.get(t.id)!.last_seen_at).getTime()) < 604_800_000
  ).length;

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Acessos dos Clientes</h1>
          <p className="text-slate-500 text-sm mt-1">
            Monitoramento em tempo real — atualiza a cada visita ao dashboard
          </p>
        </div>
        <div className="flex gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-center min-w-[100px]">
            <p className="text-2xl font-bold text-emerald-700">{ativos24h}</p>
            <p className="text-xs text-emerald-600 font-medium">Ativos hoje</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-center min-w-[100px]">
            <p className="text-2xl font-bold text-amber-700">{ativos7d}</p>
            <p className="text-xs text-amber-600 font-medium">Esta semana</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-center min-w-[100px]">
            <p className="text-2xl font-bold text-slate-700">{tenants.length}</p>
            <p className="text-xs text-slate-500 font-medium">Total clientes</p>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Status", "Empresa", "Último Acesso", "Requisições (total)", "Último Usuário"].map((col) => (
                <th
                  key={col}
                  className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Nenhum acesso registrado ainda.
                </td>
              </tr>
            ) : (
              rows.map((t) => {
                const stats = statsMap.get(t.id) ?? null;
                const status = statusAcesso(stats?.last_seen_at ?? null);
                return (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${status.text}`}>
                        <span className={`inline-block h-2 w-2 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </td>

                    {/* Empresa */}
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-900">{t.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{t.slug}</div>
                    </td>

                    {/* Último acesso */}
                    <td className="px-5 py-3.5">
                      {stats ? (
                        <div>
                          <div className="font-medium text-slate-800">
                            {tempoRelativo(stats.last_seen_at)}
                          </div>
                          <div className="text-xs text-slate-400">
                            {new Date(stats.last_seen_at).toLocaleString("pt-BR", {
                              day: "2-digit", month: "2-digit", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                              timeZone: "America/Sao_Paulo",
                            })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Total */}
                    <td className="px-5 py-3.5">
                      {stats ? (
                        <span className="font-semibold text-slate-700">
                          {stats.total_accesses.toLocaleString("pt-BR")}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Último usuário */}
                    <td className="px-5 py-3.5 text-slate-600">
                      {stats?.last_user_name ?? <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 text-right">
        Atualiza a cada requisição ao dashboard · 1 linha por cliente no banco
      </p>
    </div>
  );
}
