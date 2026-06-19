"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Legend,
} from "recharts";

export interface FinFluxoCaixaData {
  mes: string;
  entradas: number;
  saidas: number;
  saldo: number;
  acumulado: number;
}

interface Props {
  data: FinFluxoCaixaData[];
  selectedMes?: string | null;
  onMesClick?: (mes: string | null) => void;
}

function fmt(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(0)}k`;
  return `${v.toFixed(0)}`;
}

function mesLabel(mes: string) {
  const [y, m] = mes.split("-");
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${meses[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const fmt2 = (v: number) => `R$ ${Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 12,
      minWidth: 180,
    }}>
      <p style={{ color: "var(--text-secondary)", marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, color: p.color, marginBottom: 2 }}>
          <span>{p.name}</span>
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>
            {p.value < 0 ? "-" : ""}{fmt2(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function FinFluxoCaixaChart({ data, selectedMes, onMesClick }: Props) {
  const handleClick = (entry: FinFluxoCaixaData) => {
    if (onMesClick) onMesClick(selectedMes === entry.mes ? null : entry.mes);
  };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.35} />
          </linearGradient>
          <linearGradient id="gradSaidas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.75} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <ReferenceLine y={0} stroke="var(--border-subtle)" strokeWidth={1} />
        <XAxis
          dataKey="mes"
          tickFormatter={mesLabel}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => fmt(v)}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
          formatter={(v) => <span style={{ color: "var(--text-secondary)" }}>{v}</span>}
        />
        <Bar
          dataKey="entradas"
          name="Entradas"
          radius={[3, 3, 0, 0]}
          maxBarSize={22}
          cursor="pointer"
          onClick={(d: unknown) => handleClick(d as FinFluxoCaixaData)}
        >
          {data.map((entry) => (
            <Cell
              key={entry.mes}
              fill="url(#gradEntradas)"
              opacity={!selectedMes || selectedMes === entry.mes ? 1 : 0.25}
            />
          ))}
        </Bar>
        <Bar
          dataKey="saidas"
          name="Saídas"
          radius={[3, 3, 0, 0]}
          maxBarSize={22}
          cursor="pointer"
          onClick={(d: unknown) => handleClick(d as FinFluxoCaixaData)}
        >
          {data.map((entry) => (
            <Cell
              key={entry.mes}
              fill="url(#gradSaidas)"
              opacity={!selectedMes || selectedMes === entry.mes ? 1 : 0.25}
            />
          ))}
        </Bar>
        <Line
          type="monotone"
          dataKey="saldo"
          name="Saldo Líquido"
          stroke="var(--accent-cyan)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--accent-cyan)", strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
