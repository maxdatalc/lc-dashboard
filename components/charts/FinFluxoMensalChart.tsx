"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine, Legend, LabelList,
} from "recharts";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { useEmpresa } from "@/lib/contexts/empresa-context";

export interface FinFluxoMensalData {
  mes: string;
  recebimentos: number;
  pagamentos: number;
  resultado: number;
}

interface Props {
  data: FinFluxoMensalData[];
  selectedMes?: string | null;
  onMesClick?: (mes: string | null) => void;
}

// Abreviação estilo gerencial: R$ 1,32 mi · R$ 968 mil · -R$ 43,7 mil
function abbr(v: number): string {
  const s = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${s}R$ ${(a / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  if (a >= 1_000)     return `${s}R$ ${Math.round(a / 1_000).toLocaleString("pt-BR")} mil`;
  return `${s}R$ ${a.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}
// Valor exato, sem abreviação — usado no tooltip (o eixo e os rótulos das barras continuam abreviados)
function fmtFull(v: number): string {
  return `${v < 0 ? "-" : ""}R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function axisAbbr(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${v < 0 ? "-" : ""}R$ ${(a / 1_000_000).toFixed(1)} mi`;
  if (a >= 1_000)     return `${v < 0 ? "-" : ""}R$ ${Math.round(a / 1_000)} mil`;
  return `R$ ${v.toFixed(0)}`;
}
function mesLabel(mes: string) {
  const [y, m] = mes.split("-");
  const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${meses[parseInt(m, 10) - 1]}/${y}`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "10px 14px", fontSize: 12, minWidth: 260, boxShadow: "0 12px 32px rgba(0,0,0,0.35)" }}>
      <p style={{ color: "var(--text-secondary)", marginBottom: 6, fontWeight: 700 }}>{label ? mesLabel(label) : ""}</p>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, color: p.color, marginBottom: 2 }}>
          <span>{p.name}</span>
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700, whiteSpace: "nowrap" }}>{fmtFull(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function FinFluxoMensalChart({ data, selectedMes, onMesClick }: Props) {
  const { getModuleColor } = useEmpresa();
  const pagamentosColor = getModuleColor("modulo_financeiro") ?? "#ef4444";

  const handleClick = (entry: FinFluxoMensalData) => {
    if (onMesClick) onMesClick(selectedMes === entry.mes ? null : entry.mes);
  };
  const dim = (mes: string) => (!selectedMes || selectedMes === mes ? 1 : 0.22);
  const showLabels = data.length <= 8;

  return (
    <ChartFrame role="featured">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 24, right: 10, left: 6, bottom: 0 }} barGap={2} barCategoryGap="22%">
        <defs>
          <linearGradient id="fluxoReceb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity={0.95} />
            <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity={0.55} />
          </linearGradient>
          <linearGradient id="fluxoPag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={pagamentosColor} stopOpacity={0.9} />
            <stop offset="100%" stopColor={pagamentosColor} stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <ReferenceLine y={0} stroke="var(--border-subtle)" strokeWidth={1} />
        <XAxis dataKey="mes" tickFormatter={mesLabel} tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
        <YAxis tickFormatter={axisAbbr} tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={62} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(127,127,127,0.06)" }} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} iconSize={9} formatter={(v) => <span style={{ color: "var(--text-secondary)" }}>{v}</span>} iconType="circle" />

        <Bar dataKey="recebimentos" name="Recebimentos" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} maxBarSize={34} cursor="pointer" onClick={(d: unknown) => handleClick(d as FinFluxoMensalData)}>
          {data.map((e) => <Cell key={e.mes} fill="url(#fluxoReceb)" opacity={dim(e.mes)} />)}
          {showLabels && <LabelList dataKey="recebimentos" position="top" formatter={(v) => abbr(Number(v))} fill="var(--text-muted)" fontSize={9.5} fontWeight={600} />}
        </Bar>
        <Bar dataKey="pagamentos" name="Pagamentos" fill={pagamentosColor} radius={[4, 4, 0, 0]} maxBarSize={34} cursor="pointer" onClick={(d: unknown) => handleClick(d as FinFluxoMensalData)}>
          {data.map((e) => <Cell key={e.mes} fill="url(#fluxoPag)" opacity={dim(e.mes)} />)}
          {showLabels && <LabelList dataKey="pagamentos" position="top" formatter={(v) => abbr(Number(v))} fill="var(--text-muted)" fontSize={9.5} fontWeight={600} />}
        </Bar>
        <Line type="monotone" dataKey="resultado" name="Resultado Bruto" stroke="var(--accent-green)" fill="var(--accent-green)" strokeWidth={2.5}
          dot={{ r: 3.5, fill: "var(--accent-green)", strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }}>
          {showLabels && <LabelList dataKey="resultado" position="bottom" formatter={(v) => abbr(Number(v))} fill="var(--accent-green)" fontSize={9.5} fontWeight={700} />}
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
    </ChartFrame>
  );
}
