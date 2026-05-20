"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export interface FaturamentoMensalData {
  mes: string;
  faturamento: number;
}

interface Props {
  data: FaturamentoMensalData[];
}

function formatYAxis(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const valor = payload[0].value;
  const fmt =
    valor >= 1_000_000
      ? `R$ ${(valor / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`
      : valor >= 1_000
      ? `R$ ${(valor / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`
      : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div
      className="rounded-xl px-3 py-2 text-xs shadow-xl"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        color: "var(--text-primary)",
      }}
    >
      <p style={{ color: "var(--text-secondary)" }}>{label}</p>
      <p className="font-semibold tabular-nums">{fmt}</p>
    </div>
  );
}

// Mês atual baseado em YYYY-MM
function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function FaturamentoMensalChart({ data }: Props) {
  const atual = mesAtual();

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center h-[200px] text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        Sem dados disponíveis
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
        <XAxis
          dataKey="mes"
          tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,212,255,0.06)" }} />
        <Bar dataKey="faturamento" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.mes === atual ? "var(--accent-cyan)" : "rgba(0,212,255,0.35)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
