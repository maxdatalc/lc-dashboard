"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export interface FormasPagamentoData {
  nome: string;
  valor: number;
  percentual: number;
}

interface Props {
  data: FormasPagamentoData[];
}

const CORES = [
  "var(--accent-cyan)",
  "var(--accent-yellow)",
  "var(--accent-green)",
  "var(--accent-purple)",
  "var(--accent-orange)",
  "var(--accent-red)",
];

function formatCurrency(value: number): string {
  if (value >= 1_000_000)
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
  if (value >= 1_000)
    return `R$ ${(value / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; payload: FormasPagamentoData }[];
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs shadow-xl"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        color: "var(--text-primary)",
      }}
    >
      <p className="font-medium">{d.nome}</p>
      <p className="tabular-nums">{formatCurrency(d.valor)}</p>
      <p style={{ color: "var(--text-secondary)" }}>{d.percentual.toFixed(1)}%</p>
    </div>
  );
}

export function FormasPagamentoChart({ data }: Props) {
  const total = data.reduce((acc, d) => acc + d.valor, 0);

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

  return (
    <div className="flex items-center gap-4">
      {/* Donut */}
      <div className="relative flex-shrink-0" style={{ width: 180, height: 180 }}>
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie
              data={data}
              cx={85}
              cy={85}
              innerRadius={55}
              outerRadius={85}
              dataKey="valor"
              strokeWidth={0}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CORES[index % CORES.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Total no centro */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        >
          <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {formatCurrency(total)}
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            total
          </p>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {data.map((d, index) => (
          <div key={d.nome} className="flex items-center gap-2 min-w-0">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: CORES[index % CORES.length] }}
            />
            <span
              className="text-xs truncate flex-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {d.nome}
            </span>
            <span
              className="text-xs font-medium tabular-nums flex-shrink-0"
              style={{ color: "var(--text-primary)" }}
            >
              {d.percentual.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
