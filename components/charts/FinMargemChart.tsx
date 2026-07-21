"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { useMediaQuery } from "@/hooks/use-media-query";

export interface FinMargemData {
  mes: string;
  receita: number;
  custo: number;
  lucro: number;
  margemPct: number;
}

interface Props {
  data: FinMargemData[];
  selectedMes?: string | null;
  onMesClick?: (mes: string | null) => void;
}

function mesLabel(mes: string) {
  const [y, m] = mes.split("-");
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${meses[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

function fmtR(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
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
      minWidth: 170,
    }}>
      <p style={{ color: "var(--text-secondary)", marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, color: p.color, marginBottom: 2 }}>
          <span>{p.name}</span>
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>
            {p.name === "Margem %" ? `${p.value.toFixed(1)}%` : fmtR(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function FinMargemChart({ data, selectedMes: _selectedMes, onMesClick: _onMesClick }: Props) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  return (
    <ChartFrame role="default">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id="gradCusto" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id="gradMargem" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#a855f7" stopOpacity={0.04} />
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
          yAxisId="valor"
          tickFormatter={fmtR}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={isMobile ? 44 : 60}
        />
        <YAxis
          yAxisId="pct"
          orientation="right"
          tickFormatter={(v) => `${v}%`}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          domain={[0, 100]}
          width={40}
          hide={isMobile}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
          formatter={(v) => <span style={{ color: "var(--text-secondary)" }}>{v}</span>}
        />
        <Area
          yAxisId="valor"
          type="monotone"
          dataKey="receita"
          name="Receita"
          stroke="var(--accent-cyan)"
          strokeWidth={1.5}
          fill="url(#gradReceita)"
        />
        <Area
          yAxisId="valor"
          type="monotone"
          dataKey="custo"
          name="Custo"
          stroke="#ef4444"
          strokeWidth={1.5}
          fill="url(#gradCusto)"
        />
        <Line
          yAxisId="pct"
          type="monotone"
          dataKey="margemPct"
          name="Margem %"
          stroke="#a855f7"
          strokeWidth={2.5}
          dot={{ r: 4, fill: "#a855f7", strokeWidth: 0 }}
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
    </ChartFrame>
  );
}
