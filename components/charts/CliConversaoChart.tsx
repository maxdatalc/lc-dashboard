"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend, LabelList,
} from "recharts";
import { ChartFrame } from "@/components/charts/ChartFrame";

export interface CliConversaoData {
  mes: string;
  cadastros: number;
  primeiraCompra: number;
  conversao: number | null; // % primeiraCompra / cadastros
}

interface Props {
  data: CliConversaoData[];
  selectedMes?: string | null;
  onMesClick?: (mes: string | null) => void;
}

function mesLabel(mes: string) {
  const [y, m] = mes.split("-");
  const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${meses[parseInt(m, 10) - 1]}/${y}`;
}
function num(v: number) { return v.toLocaleString("pt-BR"); }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { payload: CliConversaoData }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "10px 14px", fontSize: 12, minWidth: 210, boxShadow: "0 12px 32px rgba(0,0,0,0.35)" }}>
      <p style={{ color: "var(--text-secondary)", marginBottom: 6, fontWeight: 700 }}>{label ? mesLabel(label) : ""}</p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "var(--accent-cyan)", marginBottom: 2 }}>
        <span>Novos cadastros</span><span style={{ fontWeight: 700 }}>{num(row?.cadastros ?? 0)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "var(--accent-green)", marginBottom: 2 }}>
        <span>Primeira compra</span><span style={{ fontWeight: 700 }}>{num(row?.primeiraCompra ?? 0)}</span>
      </div>
      {row?.conversao != null && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "var(--text-muted)", marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border-subtle)" }}>
          <span>Conversão</span><span style={{ fontWeight: 700 }}>{row.conversao.toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}

export function CliConversaoChart({ data, selectedMes, onMesClick }: Props) {
  const handleClick = (entry: CliConversaoData) => {
    if (onMesClick) onMesClick(selectedMes === entry.mes ? null : entry.mes);
  };
  const dim = (mes: string) => (!selectedMes || selectedMes === mes ? 1 : 0.22);
  const showLabels = data.length <= 8;

  return (
    <ChartFrame role="featured">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 24, right: 10, left: 6, bottom: 0 }} barCategoryGap="30%">
        <defs>
          <linearGradient id="cliCad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity={0.95} />
            <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis dataKey="mes" tickFormatter={mesLabel} tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(127,127,127,0.06)" }} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(v) => <span style={{ color: "var(--text-secondary)" }}>{v}</span>} iconType="circle" />

        <Bar dataKey="cadastros" name="Novos cadastros" radius={[4, 4, 0, 0]} maxBarSize={40} cursor="pointer" onClick={(d: unknown) => handleClick(d as CliConversaoData)}>
          {data.map((e) => <Cell key={e.mes} fill="url(#cliCad)" opacity={dim(e.mes)} />)}
          {showLabels && <LabelList dataKey="cadastros" position="top" formatter={(v) => num(Number(v))} fill="var(--text-muted)" fontSize={9.5} fontWeight={600} />}
        </Bar>
        <Line type="monotone" dataKey="primeiraCompra" name="Primeira compra" stroke="var(--accent-green)" strokeWidth={2.5}
          dot={{ r: 3.5, fill: "var(--accent-green)", strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }}>
          {showLabels && <LabelList dataKey="primeiraCompra" position="top" formatter={(v) => num(Number(v))} fill="var(--accent-green)" fontSize={9.5} fontWeight={700} />}
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
    </ChartFrame>
  );
}
