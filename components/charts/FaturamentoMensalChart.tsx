"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils/format";

export interface FaturamentoMensalData {
  mes: string;
  faturamento: number;
  devolucoes?: number;
}

interface Props {
  data: FaturamentoMensalData[];
}

function formatYAxis(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
}


interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-xl px-3 py-2.5 text-xs shadow-xl"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        color: "var(--text-primary)",
      }}
    >
      <p className="mb-2 font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 tabular-nums">
          <span
            className="inline-block rounded-full flex-shrink-0"
            style={{ width: 7, height: 7, backgroundColor: entry.color }}
          />
          <span style={{ color: "var(--text-secondary)" }}>
            {entry.name === "faturamento" ? "Faturamento" : "Devoluções"}:
          </span>
          <span className="font-semibold">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

function CustomLegend() {
  return (
    <div className="flex items-center gap-4 justify-end px-1 pb-1 text-xs" style={{ color: "var(--text-muted)" }}>
      <div className="flex items-center gap-1.5">
        <span className="inline-block rounded-sm" style={{ width: 10, height: 10, backgroundColor: "#2563eb" }} />
        Faturamento
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block rounded-sm" style={{ width: 10, height: 10, backgroundColor: "#ef4444" }} />
        Devoluções
      </div>
    </div>
  );
}

export function FaturamentoMensalChart({ data }: Props) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center h-[220px] text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        Sem dados disponíveis
      </div>
    );
  }

  const temDevolucoes = data.some((d) => (d.devolucoes ?? 0) > 0);

  return (
    <div className="flex flex-col gap-1">
      <CustomLegend />
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }} barGap={3}>
          <defs>
            <linearGradient id="faturGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={1} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.35} />
            </linearGradient>
          </defs>
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
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "var(--border-subtle)", radius: 4 }}
          />
          <Bar
            dataKey="faturamento"
            radius={[4, 4, 0, 0]}
            maxBarSize={temDevolucoes ? 36 : 48}
            fill="url(#faturGrad)"
          />
          {temDevolucoes && (
            <Bar
              dataKey="devolucoes"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
              fill="#ef4444"
              fillOpacity={0.75}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
