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
        className="adm-rise relative"
        style={{ animationDelay: "50ms" }}
      >
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: "var(--adm-text-faint)" }}
        />
        <input
          type="text"
          placeholder="Buscar por nome ou slug…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="adm-field w-full py-2.5 pl-10 pr-4 text-sm"
        />
      </div>

      {/* Tabela */}
      <div
        className="adm-rise overflow-x-auto rounded-xl"
        style={{
          animationDelay: "80ms",
          background: "var(--adm-surface)",
          border: "1px solid var(--adm-line)",
          boxShadow: "var(--adm-shadow-sm)",
        }}
      >
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Building2
              className="mx-auto mb-3 h-10 w-10"
              style={{ color: "var(--adm-text-faint)" }}
            />
            <p className="text-sm font-medium" style={{ color: "var(--adm-text-dim)" }}>
              {busca
                ? <>Nenhuma empresa encontrada para &ldquo;{busca}&rdquo;</>
                : "Nenhuma empresa cadastrada"}
            </p>
            {!busca && isAdmin && (
              <p className="mt-1 text-xs" style={{ color: "var(--adm-text-faint)" }}>
                Clique em &ldquo;+ Novo Grupo&rdquo; para começar.
              </p>
            )}
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--adm-line)" }}>
                  {["Empresa", "Lojas / Usuários", "Plano", "Cadastrado em", ""].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: "var(--adm-text-faint)" }}
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr
                    key={t.id}
                    className="adm-rise adm-row group"
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid var(--adm-line)",
                      animationDelay: `${i * 28}ms`,
                    }}
                  >
                    {/* Empresa */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{
                            background: t.isActive ? "var(--adm-signal)" : "var(--adm-text-faint)",
                          }}
                          title={t.isActive ? "Ativa" : "Inativa"}
                        />
                        <div>
                          <div
                            className="font-semibold leading-tight"
                            style={{ color: "var(--adm-text)" }}
                          >
                            {t.name}
                          </div>
                          <div
                            className="adm-mono mt-0.5 text-xs"
                            style={{ color: "var(--adm-text-faint)" }}
                          >
                            {t.slug}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Lojas / Usuários */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-4">
                        <span
                          className="flex items-center gap-1.5 text-xs"
                          style={{ color: "var(--adm-text-dim)" }}
                        >
                          <Building2 className="h-3.5 w-3.5" style={{ color: "var(--adm-text-faint)" }} />
                          <span className="adm-mono font-semibold" style={{ color: "var(--adm-text)" }}>
                            {t.lojas.length}
                          </span>
                        </span>
                        <span
                          className="flex items-center gap-1.5 text-xs"
                          style={{ color: "var(--adm-text-dim)" }}
                        >
                          <Users className="h-3.5 w-3.5" style={{ color: "var(--adm-text-faint)" }} />
                          <span className="adm-mono font-semibold" style={{ color: "var(--adm-text)" }}>
                            {t.totalUsuarios}
                          </span>
                        </span>
                      </div>
                    </td>

                    {/* Plano */}
                    <td className="px-5 py-4">
                      {t.plan === "premium" ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{ background: "var(--adm-warn-soft)", color: "var(--adm-warn)" }}
                        >
                          ★ Premium
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                          style={{ background: "var(--adm-surface-2)", color: "var(--adm-text-dim)" }}
                        >
                          Free
                        </span>
                      )}
                    </td>

                    {/* Criado em */}
                    <td
                      className="adm-mono px-5 py-4 text-xs"
                      style={{ color: "var(--adm-text-faint)" }}
                    >
                      {formatarData(t.createdAt)}
                    </td>

                    {/* Ações */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Dashboard — só admin */}
                        {isAdmin && acessarDashboard && (
                          <form action={acessarDashboard} className="opacity-0 transition-opacity group-hover:opacity-100">
                            <input type="hidden" name="tenantId" value={t.id} />
                            <button
                              type="submit"
                              title={`Acessar dashboard de ${t.name}`}
                              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                              style={{
                                color: "var(--adm-text-dim)",
                                border: "1px solid var(--adm-line-strong)",
                                background: "var(--adm-surface-2)",
                              }}
                            >
                              <LayoutDashboard className="h-3.5 w-3.5" />
                              Dashboard
                            </button>
                          </form>
                        )}

                        {/* Excluir — só admin */}
                        {isAdmin && (
                          <div className="opacity-0 transition-opacity group-hover:opacity-100">
                            <BotaoExcluirCliente tenantId={t.id} tenantName={t.name} />
                          </div>
                        )}

                        {/* Gerenciar — todos podem ver */}
                        <Link
                          href={`/admin/empresas/${t.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all"
                          style={{ background: "var(--adm-accent)", color: "#04121a" }}
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
              <div
                className="px-5 py-2.5 text-xs"
                style={{ borderTop: "1px solid var(--adm-line)", color: "var(--adm-text-faint)" }}
              >
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
