"use client";

import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

export interface FinFaturamentoData {
  mes: string;
  faturamento: number;
  recebido: number;
  qtdVendas: number;
}

interface Props {
  data: FinFaturamentoData[];
  selectedMes?: string | null;
  onMesClick?: (mes: string | null) => void;
}

function fmt(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function mesLabel(mes: string) {
  const [y, m] = mes.split("-");
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${meses[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 12,
    }}>
      <p style={{ color: "var(--text-secondary)", marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, color: p.color }}>
          <span>{p.name}</span>
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>
            {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function FinFaturamentoChart({ data, selectedMes, onMesClick }: Props) {
  const handleClick = (entry: { mes: string }) => {
    if (!onMesClick) return;
    onMesClick(selectedMes === entry.mes ? null : entry.mes);
  };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity={0.9} />
            <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity={0.5} />
          </linearGradient>
          <linearGradient id="gradRec" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.85} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.45} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis
          dataKey="mes"
          tickFormatter={mesLabel}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmt}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
          formatter={(v) => <span style={{ color: "var(--text-secondary)" }}>{v}</span>}
        />
        <Bar
          dataKey="faturamento"
          name="Faturamento"
          radius={[3, 3, 0, 0]}
          maxBarSize={24}
          cursor="pointer"
          onClick={(d: unknown) => handleClick(d as FinFaturamentoData)}
        >
          {data.map((entry) => {
            const isSelected = !selectedMes || selectedMes === entry.mes;
            return (
              <Cell
                key={entry.mes}
                fill="url(#gradFat)"
                opacity={isSelected ? 1 : 0.25}
              />
            );
          })}
        </Bar>
        <Bar
          dataKey="recebido"
          name="Recebido"
          radius={[3, 3, 0, 0]}
          maxBarSize={24}
          cursor="pointer"
          onClick={(d: unknown) => handleClick(d as FinFaturamentoData)}
        >
          {data.map((entry) => {
            const isSelected = !selectedMes || selectedMes === entry.mes;
            return (
              <Cell
                key={entry.mes}
                fill="url(#gradRec)"
                opacity={isSelected ? 1 : 0.25}
              />
            );
          })}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
