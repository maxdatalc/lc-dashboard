"use client";

import { useState } from "react";
import { Activity, Wifi } from "lucide-react";
import { BridgeMonitorClient } from "@/components/admin/BridgeMonitorClient";

export type AccessRow = {
  id: string;
  name: string;
  slug: string;
  lastSeenAt: string | null;
  totalAccesses: number | null;
  lastUserName: string | null;
};

export type AccessSummary = {
  ativos24h: number;
  ativos7d: number;
  total: number;
};

interface Props {
  rows: AccessRow[];
  summary: AccessSummary;
}

type Tab = "bridges" | "acessos";

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function statusAcesso(dateStr: string | null) {
  if (!dateStr) return { label: "Nunca", dot: "bg-slate-300", text: "text-slate-400" };
  const h = (Date.now() - new Date(dateStr).getTime()) / 3_600_000;
  if (h < 24) return { label: "Hoje", dot: "bg-emerald-500", text: "text-emerald-700" };
  if (h < 168) return { label: "Esta semana", dot: "bg-amber-400", text: "text-amber-700" };
  return { label: "Inativo", dot: "bg-slate-300", text: "text-slate-500" };
}

// ── Componente principal ───────────────────────────────────────────────────────

export function MonitoramentoClient({ rows, summary }: Props) {
  const [tab, setTab] = useState<Tab>("bridges");

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        <TabButton
          active={tab === "bridges"}
          onClick={() => setTab("bridges")}
          icon={<Wifi className="h-3.5 w-3.5" />}
          label="Bridges"
        />
        <TabButton
          active={tab === "acessos"}
          onClick={() => setTab("acessos")}
          icon={<Activity className="h-3.5 w-3.5" />}
          label="Acessos"
        />
      </div>

      {/* Conteúdo da tab */}
      {tab === "bridges" ? (
        <BridgeMonitorClient />
      ) : (
        <AcessosTab rows={rows} summary={summary} />
      )}
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function AcessosTab({ rows, summary }: { rows: AccessRow[]; summary: AccessSummary }) {
  return (
    <div className="space-y-5">
      {/* KPI chips */}
      <div className="flex gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-center min-w-[100px]">
          <p className="text-2xl font-bold text-emerald-700 tabular-nums">{summary.ativos24h}</p>
          <p className="text-xs text-emerald-600 font-medium">Ativos hoje</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-center min-w-[100px]">
          <p className="text-2xl font-bold text-amber-700 tabular-nums">{summary.ativos7d}</p>
          <p className="text-xs text-amber-600 font-medium">Esta semana</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-center min-w-[100px]">
          <p className="text-2xl font-bold text-slate-700 tabular-nums">{summary.total}</p>
          <p className="text-xs text-slate-500 font-medium">Total clientes</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Status", "Empresa", "Último Acesso", "Requisições (total)", "Último Usuário"].map(
                (col) => (
                  <th
                    key={col}
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {col}
                  </th>
                )
              )}
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
              rows.map((row) => {
                const status = statusAcesso(row.lastSeenAt);
                return (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${status.text}`}>
                        <span className={`inline-block h-2 w-2 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-900">{row.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{row.slug}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      {row.lastSeenAt ? (
                        <div>
                          <div className="font-medium text-slate-800">
                            {tempoRelativo(row.lastSeenAt)}
                          </div>
                          <div className="text-xs text-slate-400">
                            {new Date(row.lastSeenAt).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "America/Sao_Paulo",
                            })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {row.totalAccesses != null ? (
                        <span className="font-semibold text-slate-700">
                          {row.totalAccesses.toLocaleString("pt-BR")}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {row.lastUserName ?? <span className="text-slate-400">—</span>}
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
