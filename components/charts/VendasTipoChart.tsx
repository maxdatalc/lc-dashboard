"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils/format";

export interface VendasTipoData {
  pf: { total: number; clientes: number };
  pj: { total: number; clientes: number };
}

interface Props {
  data: VendasTipoData;
}

const CORES = { PF: "#00e5ff", PJ: "#7c3aed" };

export function VendasTipoChart({ data }: Props) {
  const totalVendas = data.pf.clientes + data.pj.clientes;

  if (totalVendas === 0) {
    return (
      <div
        className="flex items-center justify-center h-[220px] text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        Sem dados disponíveis
      </div>
    );
  }

  const chartData = [
    { name: "PF", value: data.pf.clientes, total: data.pf.total },
    { name: "PJ", value: data.pj.clientes, total: data.pj.total },
  ].filter((d) => d.value > 0);

  const dominantKey = data.pf.clientes >= data.pj.clientes ? "pf" : "pj";
  const dominantName = dominantKey === "pf" ? "PF" : "PJ";
  const dominantPct = Math.round((data[dominantKey].clientes / totalVendas) * 100);

  const legendItems = [
    { key: "pf" as const, name: "Pessoa Física", color: CORES.PF },
    { key: "pj" as const, name: "Pessoa Jurídica", color: CORES.PJ },
  ];

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Donut */}
      <div className="relative" style={{ width: 140, height: 140 }}>
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie
              data={chartData}
              cx={65}
              cy={65}
              innerRadius={44}
              outerRadius={64}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CORES[entry.name as keyof typeof CORES]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Percentual dominante no centro */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p
            className="tabular-nums leading-none"
            style={{
              fontFamily: "var(--font-display, 'DM Serif Display', serif)",
              fontSize: "1.25rem",
              color: CORES[dominantName as keyof typeof CORES],
            }}
          >
            {dominantPct}%
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            {dominantName === "PF" ? "Física" : "Jurídica"}
          </p>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-col gap-2 w-full">
        {legendItems.map((item) => {
          const d = data[item.key];
          const pct = totalVendas > 0 ? Math.round((d.clientes / totalVendas) * 100) : 0;
          return (
            <div key={item.key} className="flex items-center gap-2">
              <div
                className="flex-shrink-0 rounded-sm"
                style={{ width: 8, height: 8, backgroundColor: item.color }}
              />
              <span className="text-xs flex-1" style={{ color: "var(--text-secondary)" }}>
                {item.name}
              </span>
              <span
                className="text-xs font-semibold tabular-nums"
                style={{ color: "var(--text-primary)" }}
              >
                {pct}%
              </span>
              <span
                className="text-xs tabular-nums"
                style={{ color: "var(--text-muted)", minWidth: 50, textAlign: "right" }}
              >
                {d.clientes.toLocaleString("pt-BR")} vendas
              </span>
            </div>
          );
        })}
        <div style={{ height: 1, backgroundColor: "var(--border-subtle)", margin: "4px 0" }} />
        <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
          <span>Física: {formatCurrency(data.pf.total)}</span>
          <span>Jurídica: {formatCurrency(data.pj.total)}</span>
        </div>
      </div>
    </div>
  );
}
