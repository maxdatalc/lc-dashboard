"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatCurrency } from "@/lib/utils/format";

export interface EvolucaoPoint {
  mes: string;
  vendas: number;
}

function formatYAxis(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return `${value}`;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-xl"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        color: "var(--text-primary)",
      }}
    >
      <p className="mb-1 font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="font-semibold tabular-nums" style={{ fontFamily: "var(--font-numeric)" }}>
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

export function EvolucaoFaturamentoChart({ data }: { data: EvolucaoPoint[] }) {
  const temDados = data.some((d) => d.vendas > 0);

  if (!temDados) {
    return (
      <div
        className="flex items-center justify-center h-[200px] text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        Sem faturamento registrado no intervalo.
      </div>
    );
  }

  // Recharts aplica cor de linha/área como atributo SVG (não resolve var() de CSS),
  // então usamos hex fixo — mesmo padrão dos demais gráficos do projeto. O ciano
  // é a cor primária da identidade. Textos de eixo usam vars (funcionam no <text>).
  const CYAN = "#00e5ff";

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="homeFaturGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CYAN} stopOpacity={0.28} />
            <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.14)" />
        <XAxis
          dataKey="mes"
          tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: CYAN, strokeWidth: 1, strokeOpacity: 0.4 }} />
        <Area
          type="monotone"
          dataKey="vendas"
          stroke={CYAN}
          strokeWidth={2}
          fill="url(#homeFaturGrad)"
          dot={false}
          activeDot={{ r: 4, fill: CYAN, stroke: "#0a0f1e", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
