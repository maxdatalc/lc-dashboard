"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency } from "@/lib/utils/format";

export interface GrupoItem {
  nome: string;
  valor: number;
  quantidade: number;
}

const CORES = [
  "#00e5ff", "#f59e0b", "#10b981", "#7c3aed",
  "#f97316", "#ef4444", "#06b6d4", "#84cc16",
  "#ec4899", "#6366f1",
];

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; payload: GrupoItem }[];
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
    >
      <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        {d.nome}
      </p>
      <p style={{ color: "var(--accent-cyan)" }}>{formatCurrency(d.valor)}</p>
      <p style={{ color: "var(--text-muted)" }}>{d.quantidade.toLocaleString("pt-BR")} un.</p>
    </div>
  );
}

interface Props {
  data: GrupoItem[];
}

export function TopGruposChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem dados no período
        </p>
      </div>
    );
  }

  const top = data.slice(0, 10);
  const totalGeral = top.reduce((s, d) => s + d.valor, 0);

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={top} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
          <XAxis
            type="number"
            hide
          />
          <YAxis
            type="category"
            dataKey="nome"
            width={130}
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 18) + "…" : v}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--chart-cursor-bg)" }} />
          <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
            {top.map((_, i) => (
              <Cell key={i} fill={CORES[i % CORES.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Mini tabela de %  */}
      <div className="space-y-1.5">
        {top.slice(0, 5).map((g, i) => {
          const pct = totalGeral > 0 ? (g.valor / totalGeral) * 100 : 0;
          return (
            <div key={g.nome} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: CORES[i % CORES.length] }}
              />
              <span
                className="text-xs flex-1 truncate"
                style={{ color: "var(--text-secondary)" }}
              >
                {g.nome}
              </span>
              <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                {pct.toFixed(1)}%
              </span>
              <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                {formatCurrency(g.valor)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
