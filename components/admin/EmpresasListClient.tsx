"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Users, LayoutDashboard, Search } from "lucide-react";
import { BotaoExcluirCliente } from "@/components/admin/botao-excluir-cliente";

type Loja = { id: string; sqlEnabled: boolean; isActive: boolean; empId: number; name: string };

type Tenant = {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "premium";
  lojas: Loja[];
  totalUsuarios: number;
  isActive: boolean;
  createdAt: string;
  features: string[];
  codigoExterno: string | null;
};

function formatarData(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

export function EmpresasListClient({
  tenants,
  acessarDashboard,
  isAdmin,
}: {
  tenants: Tenant[];
  acessarDashboard?: (formData: FormData) => Promise<void>;
  isAdmin: boolean;
}) {
  const [busca, setBusca] = useState("");

  const filtered = busca.trim()
    ? tenants.filter(
        (t) =>
          t.name.toLowerCase().includes(busca.toLowerCase()) ||
          t.slug.toLowerCase().includes(busca.toLowerCase())
      )
    : tenants;

  return (
    <div className="space-y-4">
      {/* Busca */}
      <div
        className="relative"
        style={{ animation: "fadeInUp 0.3s ease-out both", animationDelay: "50ms" }}
      >
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por nome ou slug…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/8 focus:border-slate-400 transition-all"
        />
      </div>

      {/* Tabela */}
      <div
        className="overflow-x-auto rounded-xl border border-slate-200 bg-white"
        style={{ animation: "fadeInUp 0.35s ease-out both", animationDelay: "80ms" }}
      >
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Building2 className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="font-medium text-slate-500 text-sm">
              {busca
                ? <>Nenhuma empresa encontrada para &ldquo;{busca}&rdquo;</>
                : "Nenhuma empresa cadastrada"}
            </p>
            {!busca && isAdmin && (
              <p className="text-xs text-slate-400 mt-1">
                Clique em &ldquo;+ Novo Grupo&rdquo; para começar.
              </p>
            )}
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Empresa", "Lojas / Usuários", "Plano", "Cadastrado em", ""].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400"
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((t, i) => (
                  <tr
                    key={t.id}
                    className="group hover:bg-slate-50/60 transition-colors"
                    style={{
                      animation: "fadeInUp 0.3s ease-out both",
                      animationDelay: `${i * 28}ms`,
                    }}
                  >
                    {/* Empresa */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-block h-2 w-2 rounded-full shrink-0 transition-colors ${
                            t.isActive ? "bg-emerald-400" : "bg-slate-300"
                          }`}
                          title={t.isActive ? "Ativa" : "Inativa"}
                        />
                        <div>
                          <div className="font-semibold text-slate-900 leading-tight">
                            {t.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-400 font-mono">{t.slug}</span>
                            {t.codigoExterno && (
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono">
                                #{t.codigoExterno}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Lojas / Usuários */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-700">
                            {t.lojas.length}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-700">
                            {t.totalUsuarios}
                          </span>
                        </span>
                      </div>
                    </td>

                    {/* Plano */}
                    <td className="px-5 py-4">
                      {t.plan === "premium" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          ★ Premium
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500">
                          Free
                        </span>
                      )}
                    </td>

                    {/* Criado em */}
                    <td className="px-5 py-4 text-xs text-slate-400">
                      {formatarData(t.createdAt)}
                    </td>

                    {/* Ações */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        {/* Dashboard — só admin */}
                        {isAdmin && acessarDashboard && (
                          <form action={acessarDashboard} className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <input type="hidden" name="tenantId" value={t.id} />
                            <button
                              type="submit"
                              title={`Acessar dashboard de ${t.name}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all"
                            >
                              <LayoutDashboard className="h-3.5 w-3.5" />
                              Dashboard
                            </button>
                          </form>
                        )}

                        {/* Excluir — só admin */}
                        {isAdmin && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <BotaoExcluirCliente tenantId={t.id} tenantName={t.name} />
                          </div>
                        )}

                        {/* Gerenciar — todos podem ver */}
                        <Link
                          href={`/admin/empresas/${t.id}`}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white transition-all hover:bg-slate-700 hover:shadow-md hover:-translate-y-px"
                        >
                          {isAdmin ? "Gerenciar →" : "Ver detalhes →"}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {busca && (
              <div className="px-5 py-2.5 border-t border-slate-50 text-xs text-slate-400">
                {filtered.length} de {tenants.length}{" "}
                {tenants.length === 1 ? "empresa" : "empresas"}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
