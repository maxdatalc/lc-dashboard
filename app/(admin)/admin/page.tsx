export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { Building2, Store, Star, Zap } from "lucide-react";
import { getAllTenants } from "@/lib/db/admin";
import { FEATURES_CATALOG } from "@/lib/features";

function formatarData(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

export default async function AdminPage() {
  const tenants = await getAllTenants();

  const totalClientes = tenants.filter((t) => t.isActive).length;
  const totalLojas = tenants.reduce((acc, t) => acc + t.lojas.length, 0);
  const lojasComBridge = tenants.reduce(
    (acc, t) => acc + t.lojas.filter((l) => l.sqlEnabled).length,
    0
  );
  const clientesPremium = tenants.filter((t) => t.plan === "premium").length;
  const percPremium =
    totalClientes > 0 ? Math.round((clientesPremium / totalClientes) * 100) : 0;

  const premiumKeys = new Set(
    FEATURES_CATALOG.filter((f) => f.categoria === "premium").map((f) => f.key)
  );
  const modulosPremiumAtivos = tenants.reduce(
    (acc, t) => acc + t.features.filter((k) => premiumKeys.has(k)).length,
    0
  );
  const mediaPorPremium =
    clientesPremium > 0
      ? (modulosPremiumAtivos / clientesPremium).toFixed(1)
      : "0";

  // Últimos cadastrados (ordenados por data desc)
  const ultimos5 = [...tenants]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5);

  const metrics = [
    {
      label: "Total de Clientes",
      value: totalClientes,
      sub: tenants.length - totalClientes > 0
        ? `${tenants.length - totalClientes} inativo(s)`
        : "todos ativos",
      icon: Building2,
      accent: "#6366f1",
    },
    {
      label: "Total de Lojas",
      value: totalLojas,
      sub: `${lojasComBridge} com Bridge SQL`,
      icon: Store,
      accent: "#3b82f6",
    },
    {
      label: "Clientes Premium",
      value: clientesPremium,
      sub: `${percPremium}% do total`,
      icon: Star,
      accent: "#f59e0b",
    },
    {
      label: "Módulos Premium",
      value: modulosPremiumAtivos,
      sub: `média de ${mediaPorPremium} por cliente`,
      icon: Zap,
      accent: "#8b5cf6",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div style={{ animation: "fadeInUp 0.3s ease-out both" }}>
        <h1 className="text-2xl font-bold text-slate-900">Painel Administrativo</h1>
        <p className="text-slate-500 text-sm mt-1">
          LC Tecnologias — gestão de clientes e módulos
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            style={{
              animation: "fadeInUp 0.35s ease-out both",
              animationDelay: `${i * 50}ms`,
            }}
          >
            <div className="h-[3px]" style={{ background: m.accent }} />
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {m.label}
                </span>
                <m.icon
                  className="h-4 w-4 transition-transform duration-200 group-hover:scale-110"
                  style={{ color: m.accent }}
                />
              </div>
              <p className="text-3xl font-bold text-slate-900 tabular-nums">{m.value}</p>
              <p className="text-xs text-slate-400 mt-1">{m.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Últimos clientes */}
      <div
        className="bg-white rounded-xl border border-slate-200 overflow-hidden"
        style={{ animation: "fadeInUp 0.4s ease-out both", animationDelay: "200ms" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 text-sm">
            Últimos Clientes Cadastrados
          </h2>
          <Link
            href="/admin/empresas"
            className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            Ver todos →
          </Link>
        </div>

        {ultimos5.length === 0 ? (
          <div className="py-12 text-center">
            <Building2 className="h-8 w-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Nenhum cliente cadastrado ainda.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50">
                {["Cliente", "Lojas", "Plano", "Cadastrado em", ""].map((col) => (
                  <th
                    key={col}
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ultimos5.map((t, i) => (
                <tr
                  key={t.id}
                  className="group hover:bg-slate-50/80 transition-colors"
                  style={{
                    animation: "fadeInUp 0.3s ease-out both",
                    animationDelay: `${250 + i * 30}ms`,
                  }}
                >
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-900 leading-tight">{t.name}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{t.slug}</div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 text-sm">{t.lojas.length}</td>
                  <td className="px-5 py-3.5">
                    {t.plan === "premium" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                        ★ Premium
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                        Free
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-400">
                    {formatarData(t.createdAt)}
                  </td>
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/admin/empresas/${t.id}`}
                      className="text-xs font-medium text-slate-400 hover:text-slate-900 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      Gerenciar →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
