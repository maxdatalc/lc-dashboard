"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { DollarSign } from "lucide-react";

export interface VendasTipoData {
  pf: { total: number; clientes: number };
  pj: { total: number; clientes: number };
}

interface Props {
  data: VendasTipoData;
  selectedTipo?: "PF" | "PJ" | null;
  onSelect?: (tipo: "PF" | "PJ" | null) => void;
}

const CORES = { PF: "#2563eb", PJ: "#7c3aed" };

const fmtK = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

export function VendasTipoChart({ data, selectedTipo, onSelect }: Props) {
  const totalVendas = data.pf.clientes + data.pj.clientes;
  const totalFat    = data.pf.total + data.pj.total;

  if (totalVendas === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-xs" style={{ color: "var(--text-muted)" }}>
        Sem dados disponíveis
      </div>
    );
  }

  const chartData = [
    { name: "PF", value: data.pf.clientes, total: data.pf.total },
    { name: "PJ", value: data.pj.clientes, total: data.pj.total },
  ].filter((d) => d.value > 0);

  const items = [
    { key: "PF" as const, label: "Pessoa Física",   color: CORES.PF, d: data.pf },
    { key: "PJ" as const, label: "Pessoa Jurídica",  color: CORES.PJ, d: data.pj },
  ];

  function toggle(tipo: "PF" | "PJ") {
    if (!onSelect) return;
    onSelect(selectedTipo === tipo ? null : tipo);
  }

  const hasSelected = !!selectedTipo;

  return (
    <div className="flex flex-col gap-3">

      {/* ── Linha principal: pizza + stats ─────────────────────────── */}
      <div className="flex gap-4 items-center">

        {/* Pizza — grande, ocupa ~45% do card */}
        <div className="flex-shrink-0" style={{ width: 175, height: 175 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={85}
                innerRadius={0}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={(entry: any) => toggle((entry as { name: string }).name as "PF" | "PJ")}
                style={{ cursor: onSelect ? "pointer" : "default" }}
              >
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={CORES[entry.name as keyof typeof CORES]}
                    opacity={hasSelected && selectedTipo !== entry.name ? 0.25 : 1}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Stats por tipo */}
        <div className="flex flex-col flex-1 min-w-0">
          {items.map((item, i) => {
            const pct = totalVendas > 0 ? Math.round((item.d.clientes / totalVendas) * 100) : 0;
            const isDimmed = hasSelected && selectedTipo !== item.key;

            return (
              <div key={item.key}>
                {i > 0 && (
                  <div style={{ height: 1, backgroundColor: "var(--border-subtle)", margin: "10px 0" }} />
                )}
                <div
                  className="flex items-center gap-2 rounded-lg transition-all"
                  style={{
                    opacity: isDimmed ? 0.35 : 1,
                    cursor: onSelect ? "pointer" : "default",
                    padding: "4px 6px",
                    background: !isDimmed && hasSelected && selectedTipo === item.key
                      ? "rgba(37,99,235,0.05)"
                      : "transparent",
                  }}
                  onClick={() => toggle(item.key)}
                >
                  {/* Porcentagem grande */}
                  {/* % + label */}
                  <div className="flex-shrink-0" style={{ minWidth: 60 }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%",
                        backgroundColor: item.color, display: "inline-block", flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1 }}>
                        {item.label}
                      </span>
                    </div>
                    <span style={{
                      fontSize: "2rem", fontWeight: 700, lineHeight: 1,
                      color: item.color, fontVariantNumeric: "tabular-nums",
                      fontFamily: "var(--font-numeric)",
                    }}>
                      {pct}%
                    </span>
                  </div>

                  {/* Separador vertical */}
                  <div style={{ width: 1, height: 48, backgroundColor: "var(--border-subtle)", flexShrink: 0 }} />

                  {/* Vendas */}
                  <div className="flex-1 text-center min-w-0">
                    <p style={{
                      fontSize: 16, fontWeight: 700, color: "var(--text-primary)",
                      fontVariantNumeric: "tabular-nums", lineHeight: 1,
                    }}>
                      {item.d.clientes.toLocaleString("pt-BR")}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>vendas</p>
                  </div>

                  {/* Separador vertical */}
                  <div style={{ width: 1, height: 48, backgroundColor: "var(--border-subtle)", flexShrink: 0 }} />

                  {/* Faturamento */}
                  <div className="flex-1 text-right min-w-0">
                    <p style={{
                      fontSize: 12, fontWeight: 700, color: "var(--text-primary)",
                      fontVariantNumeric: "tabular-nums", lineHeight: 1,
                    }}>
                      {fmtK(item.d.total)}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>faturamento</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Rodapé: Total Geral ─────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-full"
          style={{
            width: 26, height: 26,
            background: "rgba(37,99,235,0.1)",
            border: "1px solid rgba(37,99,235,0.2)",
          }}
        >
          <DollarSign style={{ width: 13, height: 13, color: "var(--accent-cyan)" }} />
        </div>

        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", flexShrink: 0 }}>
          Total Geral
        </span>

        <div style={{ width: 1, height: 16, background: "var(--border-subtle)", flexShrink: 0 }} />

        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
          {totalVendas.toLocaleString("pt-BR")} vendas
        </span>

        <div style={{ width: 1, height: 16, background: "var(--border-subtle)", flexShrink: 0 }} />

        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", flex: 1, textAlign: "right" }}>
          {fmtK(totalFat)}
        </span>

        <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>fat. total</span>
      </div>
    </div>
  );
}
