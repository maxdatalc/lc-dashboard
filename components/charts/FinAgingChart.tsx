"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

export interface FinAgingData {
  faixa: string;
  label: string;
  qtd: number;
  valor: number;
}

interface Props {
  data: FinAgingData[];
  selectedAging?: string | null;
  onAgingClick?: (faixa: string | null) => void;
}

// Cores de calor: amarelo → laranja → vermelho escuro
const HEAT_COLORS = ["#f59e0b", "#f97316", "#ef4444", "#991b1b"];

function fmtV(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: FinAgingData }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 12,
    }}>
      <p style={{ color: "var(--text-secondary)", fontWeight: 700, marginBottom: 6 }}>{d.label}</p>
      <div style={{ color: "#f1f5f9", marginBottom: 2 }}>
        <span style={{ color: "var(--text-muted)" }}>Valor em atraso: </span>
        <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>{fmtV(d.valor)}</span>
      </div>
      <div style={{ color: "#f1f5f9" }}>
        <span style={{ color: "var(--text-muted)" }}>Títulos: </span>
        <span style={{ fontWeight: 700 }}>{d.qtd.toLocaleString("pt-BR")}</span>
      </div>
    </div>
  );
}

export function FinAgingChart({ data, selectedAging, onAgingClick }: Props) {
  const total = data.reduce((s, r) => s + r.valor, 0);

  const handleClick = (entry: FinAgingData) => {
    if (!onAgingClick) return;
    onAgingClick(selectedAging === entry.faixa ? null : entry.faixa);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Mini donut / stat header */}
      <div style={{
        display: "flex",
        gap: 12,
        marginBottom: 12,
        padding: "0 2px",
        flexWrap: "wrap",
      }}>
        {data.map((d, i) => {
          const pct = total > 0 ? (d.valor / total) * 100 : 0;
          const isActive = !selectedAging || selectedAging === d.faixa;
          return (
            <button
              key={d.faixa}
              onClick={() => handleClick(d)}
              style={{
                flex: "1 1 0",
                minWidth: 72,
                background: isActive ? `${HEAT_COLORS[i]}18` : "transparent",
                border: `1px solid ${isActive ? HEAT_COLORS[i] + "50" : "var(--border-subtle)"}`,
                borderRadius: 8,
                padding: "6px 8px",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              <div style={{
                fontSize: 10,
                color: isActive ? HEAT_COLORS[i] : "var(--text-muted)",
                fontWeight: 600,
                marginBottom: 2,
                letterSpacing: "0.03em",
              }}>
                {d.label}
              </div>
              <div style={{
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "var(--font-mono, monospace)",
                color: isActive ? HEAT_COLORS[i] : "var(--text-muted)",
              }}>
                {fmtV(d.valor)}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                {pct.toFixed(0)}% · {d.qtd} tít.
              </div>
            </button>
          );
        })}
      </div>

      {/* Barra horizontal de calor */}
      <ResponsiveContainer width="100%" height={130}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            tickFormatter={fmtV}
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={70}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar
            dataKey="valor"
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
            cursor="pointer"
            onClick={(d: unknown) => handleClick(d as FinAgingData)}
          >
            {data.map((entry, i) => (
              <Cell
                key={entry.faixa}
                fill={HEAT_COLORS[i]}
                opacity={!selectedAging || selectedAging === entry.faixa ? 1 : 0.2}
              />
            ))}
            <LabelList
              dataKey="valor"
              position="right"
              formatter={(v: unknown) => v != null ? fmtV(Number(v)) : ""}
              style={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "var(--font-mono, monospace)" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
