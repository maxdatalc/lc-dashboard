// Visão geral do painel administrativo
// Exibe métricas consolidadas de todos os clientes cadastrados

import Link from "next/link";
import { Building2, Users, Star, Zap } from "lucide-react";
import { getAllTenants } from "@/lib/db/admin";
import { FEATURES_CATALOG } from "@/lib/features";

function formatarData(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

export default async function AdminPage() {
  const tenants = await getAllTenants();

  // Calcular métricas consolidadas
  const totalClientes = tenants.filter((t) => t.isActive).length;
  const totalLojas = tenants.reduce((acc, t) => acc + t.lojas.length, 0);
  const clientesPremium = tenants.filter((t) => t.plan === "premium").length;

  const premiumKeys = new Set(
    FEATURES_CATALOG.filter((f) => f.categoria === "premium").map((f) => f.key)
  );
  const modulosPremiumAtivos = tenants.reduce(
    (acc, t) => acc + t.features.filter((k) => premiumKeys.has(k)).length,
    0
  );

  const ultimos5 = tenants.slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Painel Administrativo</h1>
        <p className="text-slate-500 text-sm mt-1">LC Tecnologias — gestão de clientes e módulos</p>
      </div>

      {/* Grid de métricas */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-5 w-5 text-slate-500" />
            <span className="text-sm font-medium text-slate-600">Total de Clientes</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{totalClientes}</p>
          <p className="text-xs text-slate-400 mt-1">tenants ativos</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium text-slate-600">Total de Lojas</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{totalLojas}</p>
          <p className="text-xs text-slate-400 mt-1">filiais cadastradas</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-medium text-slate-600">Clientes Premium</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{clientesPremium}</p>
          <p className="text-xs text-slate-400 mt-1">com módulos pagos</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-5 w-5 text-purple-500" />
            <span className="text-sm font-medium text-slate-600">Módulos Premium</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{modulosPremiumAtivos}</p>
          <p className="text-xs text-slate-400 mt-1">ativações no total</p>
        </div>
      </div>

      {/* Últimos clientes */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Últimos Clientes Cadastrados</h2>
          <Link
            href="/admin/clientes"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Ver todos →
          </Link>
        </div>

        {ultimos5.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            Nenhum cliente cadastrado ainda.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Cliente", "Lojas", "Plano", "Criado em"].map((col) => (
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
              {ultimos5.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">{t.name}</div>
                    <div className="text-xs text-slate-400">{t.slug}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{t.lojas.length}</td>
                  <td className="px-5 py-3">
                    {t.plan === "premium" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        ★ Premium
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        Free
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{formatarData(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
