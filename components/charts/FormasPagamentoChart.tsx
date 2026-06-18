"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils/format";

export interface FormasPagamentoData {
  nome: string;
  valor: number;
  percentual: number;
  qtdVendas?: number;
}

interface Props {
  data: FormasPagamentoData[];
}

const CORES = [
  "#00e5ff",
  "#f59e0b",
  "#10b981",
  "#7c3aed",
  "#f97316",
  "#ef4444",
];


interface TooltipProps {
  active?: boolean;
  payload?: { value: number; payload: FormasPagamentoData }[];
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-xs shadow-xl"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        color: "var(--text-primary)",
      }}
    >
      <p className="font-medium mb-1">{d.nome}</p>
      <p className="tabular-nums">{formatCurrency(d.valor)}</p>
      <p style={{ color: "var(--text-muted)" }}>{d.percentual.toFixed(1)}% do total</p>
    </div>
  );
}

export function FormasPagamentoChart({ data }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const top6 = data.slice(0, 6);
  const total = data.reduce((acc, d) => acc + d.valor, 0);

  if (!top6.length) {
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
    <div className="flex items-center gap-4" style={{ minHeight: 120 }}>
      {/* Donut com hover expand */}
      <div className="relative flex-shrink-0" style={{ width: 110, height: 110 }}>
        <ResponsiveContainer width={110} height={110}>
          <PieChart>
            <Pie
              data={top6}
              cx={50}
              cy={50}
              innerRadius={32}
              outerRadius={50}
              paddingAngle={3}
              dataKey="valor"
              strokeWidth={0}
              onMouseEnter={(_: unknown, index: number) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              {top6.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CORES[index % CORES.length]}
                  opacity={activeIndex === undefined || activeIndex === index ? 1 : 0.45}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Total no centro */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p
            className="tabular-nums font-medium leading-tight"
            style={{
              fontSize: "0.7rem",
              color: "var(--text-primary)",
            }}
          >
            {formatCurrency(total)}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            total
          </p>
        </div>
      </div>

      {/* Legenda lado direito */}
      <div className="flex flex-col gap-2.5 flex-1 min-w-0">
        {top6.map((d, index) => (
          <div
            key={d.nome}
            className="flex items-center gap-2 min-w-0 cursor-default"
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(undefined)}
            style={{ opacity: activeIndex === undefined || activeIndex === index ? 1 : 0.45, transition: "opacity 0.15s" }}
          >
            <div
              className="flex-shrink-0 rounded-sm"
              style={{ width: 8, height: 8, backgroundColor: CORES[index % CORES.length] }}
            />
            <span className="text-xs truncate flex-1" style={{ color: "var(--text-secondary)" }}>
              {d.nome}
            </span>
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                {d.percentual.toFixed(0)}%
              </span>
              {d.qtdVendas != null && (
                <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {d.qtdVendas} vd.
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
