// Lista de todos os clientes (tenants) — painel administrativo
// force-dynamic garante que cada visita busca dados frescos do banco (sem Router Cache stale)
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { Building2, Users } from "lucide-react";
import { getAllTenants } from "@/lib/db/admin";
import { BotaoExcluirCliente } from "@/components/admin/botao-excluir-cliente";
import { FEATURES_CATALOG } from "@/lib/features";

function formatarData(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

export default async function AdminClientesPage() {
  const tenants = await getAllTenants();

  const premiumKeys = new Set(
    FEATURES_CATALOG.filter((f) => f.categoria === "premium").map((f) => f.key)
  );

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-slate-500 text-sm mt-1">{tenants.length} clientes cadastrados</p>
        </div>
        <Link
          href="/admin/clientes/novo"
          className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          + Novo Cliente
        </Link>
      </div>

      {/* Tabela de clientes */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {tenants.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="font-medium text-slate-700">Nenhum cliente cadastrado</p>
            <p className="text-sm text-slate-400 mt-1">
              Clique em &ldquo;+ Novo Cliente&rdquo; para começar.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Cliente",
                  "Lojas",
                  "Usuários",
                  "Plano",
                  "Features Premium",
                  "Criado em",
                  "Ações",
                ].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenants.map((t) => {
                const qtdPremium = t.features.filter((k) => premiumKeys.has(k)).length;

                return (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    {/* Nome + slug */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{t.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{t.slug}</div>
                    </td>

                    {/* Lojas */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        {t.lojas.length}
                      </div>
                    </td>

                    {/* Usuários */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        {t.totalUsuarios}
                      </div>
                    </td>

                    {/* Plano */}
                    <td className="px-4 py-3">
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

                    {/* Features premium ativas */}
                    <td className="px-4 py-3 text-slate-600">
                      {qtdPremium > 0 ? (
                        <span className="font-medium text-purple-700">{qtdPremium} ativo(s)</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Data */}
                    <td className="px-4 py-3 text-slate-500">{formatarData(t.createdAt)}</td>

                    {/* Ação */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/clientes/${t.id}`}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          Gerenciar →
                        </Link>
                        <BotaoExcluirCliente tenantId={t.id} tenantName={t.name} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
