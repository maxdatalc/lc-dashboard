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
  Legend,
} from "recharts";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { useMediaQuery } from "@/hooks/use-media-query";

export interface FinFaturamentoData {
  mes: string;
  faturamento: number;
  recebido: number;
  qtdVendas: number;
  taxaRec?: number | null; // recebido ÷ faturado em %
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

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  // Pega taxa de recebimento do payload ou calcula dos valores presentes
  const fatEntry = payload.find((p) => p.dataKey === "faturamento");
  const recEntry = payload.find((p) => p.dataKey === "recebido");
  const taxaEntry= payload.find((p) => p.dataKey === "taxaRec");
  const fat = fatEntry ? fatEntry.value : 0;
  const rec = recEntry ? recEntry.value : 0;
  const taxa = taxaEntry?.value ?? (fat > 0 ? Math.round(rec / fat * 1000) / 10 : null);
  const gap = fat - rec;

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 12,
      minWidth: 190,
    }}>
      <p style={{ color: "var(--text-secondary)", marginBottom: 8, fontWeight: 600 }}>{label}</p>

      {fatEntry && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: fatEntry.color, marginBottom: 3 }}>
          <span>Faturado</span>
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>{fmt(fatEntry.value)}</span>
        </div>
      )}
      {recEntry && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: recEntry.color, marginBottom: 3 }}>
          <span>Recebido</span>
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>{fmt(recEntry.value)}</span>
        </div>
      )}

      {gap > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "var(--text-muted)", marginBottom: 3, borderTop: "1px solid var(--border-subtle)", paddingTop: 4, marginTop: 2 }}>
          <span>Gap (a receber)</span>
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>{fmt(gap)}</span>
        </div>
      )}

      {taxa !== null && taxa !== undefined && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#fbbf24", marginTop: 4 }}>
          <span>Taxa de recebimento</span>
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>{taxa.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

export function FinFaturamentoChart({ data, selectedMes, onMesClick }: Props) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const handleClick = (entry: { mes: string }) => {
    if (!onMesClick) return;
    onMesClick(selectedMes === entry.mes ? null : entry.mes);
  };

  return (
    <ChartFrame role="default">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 4, right: isMobile ? 8 : 48, left: 0, bottom: 0 }}>
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
          yAxisId="valor"
          tickFormatter={fmt}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={isMobile ? 44 : 60}
        />
        <YAxis
          yAxisId="pct"
          orientation="right"
          tickFormatter={(v) => `${v}%`}
          tick={{ fill: "var(--text-muted)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          domain={[0, 120]}
          width={38}
          hide={isMobile}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          iconType="circle"
          iconSize={9}
          formatter={(v) => <span style={{ color: "var(--text-secondary)" }}>{v}</span>}
        />
        <Bar
          yAxisId="valor"
          dataKey="faturamento"
          name="Faturado"
          fill="#2563eb"
          radius={[3, 3, 0, 0]}
          maxBarSize={22}
          cursor="pointer"
          onClick={(d: unknown) => handleClick(d as FinFaturamentoData)}
        >
          {data.map((entry) => (
            <Cell
              key={entry.mes}
              fill="url(#gradFat)"
              opacity={!selectedMes || selectedMes === entry.mes ? 1 : 0.25}
            />
          ))}
        </Bar>
        <Bar
          yAxisId="valor"
          dataKey="recebido"
          name="Recebido"
          fill="#22c55e"
          radius={[3, 3, 0, 0]}
          maxBarSize={22}
          cursor="pointer"
          onClick={(d: unknown) => handleClick(d as FinFaturamentoData)}
        >
          {data.map((entry) => (
            <Cell
              key={entry.mes}
              fill="url(#gradRec)"
              opacity={!selectedMes || selectedMes === entry.mes ? 1 : 0.25}
            />
          ))}
        </Bar>
        <Line
          yAxisId="pct"
          type="monotone"
          dataKey="taxaRec"
          name="Taxa Receb. %"
          stroke="#fbbf24"
          strokeWidth={2}
          dot={{ r: 3, fill: "#fbbf24", strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
    </ChartFrame>
  );
}
