"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

export interface FinContasAbertoData {
  mes: string;
  rVencido: number;
  rAVencer: number;
  pVencido: number;
  pAVencer: number;
}

interface Props {
  data: FinContasAbertoData[];
  selectedMes?: string | null;
  onMesClick?: (mes: string | null) => void;
}

const CYAN = "var(--accent-cyan)";
const AMBER = "var(--accent-yellow)";

function axisAbbr(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `R$ ${(a / 1_000_000).toFixed(1)} mi`;
  if (a >= 1_000)     return `R$ ${(a / 1_000).toFixed(1)} mi`.replace(" mi", " mil");
  return `R$ ${v.toFixed(0)}`;
}
function fmtFull(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}
function mesLabel(mes: string) {
  const [y, m] = mes.split("-");
  const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${meses[parseInt(m, 10) - 1]}/${y}`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { payload: FinContasAbertoData }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const receber = d.rVencido + d.rAVencer;
  const pagar = d.pVencido + d.pAVencer;
  const Row = ({ c, l, v }: { c: string; l: string; v: number }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}>
      <span style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{l}
      </span>
      <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700, color: "var(--text-primary)" }}>{fmtFull(v)}</span>
    </div>
  );
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "10px 14px", fontSize: 12, minWidth: 210, boxShadow: "0 12px 32px rgba(0,0,0,0.35)" }}>
      <p style={{ color: "var(--text-secondary)", marginBottom: 6, fontWeight: 700 }}>{label ? mesLabel(label) : ""}</p>
      <Row c={CYAN} l="A Receber" v={receber} />
      <div style={{ fontSize: 10.5, color: "var(--text-muted)", paddingLeft: 14, marginBottom: 4 }}>
        vencido {fmtFull(d.rVencido)} · a vencer {fmtFull(d.rAVencer)}
      </div>
      <Row c={AMBER} l="A Pagar" v={pagar} />
      <div style={{ fontSize: 10.5, color: "var(--text-muted)", paddingLeft: 14 }}>
        vencido {fmtFull(d.pVencido)} · a vencer {fmtFull(d.pAVencer)}
      </div>
    </div>
  );
}

function LegendChip({ color, label, hollow }: { color: string; label: string; hollow?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--text-secondary)" }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: hollow ? "transparent" : color, border: `1.5px solid ${color}` }} />
      {label}
    </span>
  );
}

export function FinContasAbertoChart({ data, selectedMes, onMesClick }: Props) {
  if (data.length === 0) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 230, color: "var(--text-muted)", fontSize: 13 }}>Sem títulos em aberto no período</div>;
  }
  const handleClick = (entry: FinContasAbertoData) => { if (onMesClick) onMesClick(selectedMes === entry.mes ? null : entry.mes); };
  const dim = (mes: string) => (!selectedMes || selectedMes === mes ? 1 : 0.22);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", paddingLeft: 4 }}>
        <LegendChip color={CYAN} label="A Receber" />
        <LegendChip color={AMBER} label="A Pagar" />
        <LegendChip color="var(--text-muted)" label="vencido = tom cheio" />
        <LegendChip color="var(--text-muted)" label="a vencer = tom claro" hollow />
      </div>
      <ResponsiveContainer width="100%" height={214}>
        <BarChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 0 }} barGap={2} barCategoryGap="26%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
          <XAxis dataKey="mes" tickFormatter={mesLabel} tick={{ fill: "var(--text-muted)", fontSize: 10.5 }} axisLine={false} tickLine={false} interval={0} />
          <YAxis tickFormatter={axisAbbr} tick={{ fill: "var(--text-muted)", fontSize: 10.5 }} axisLine={false} tickLine={false} width={58} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(127,127,127,0.06)" }} />
          {/* A Receber — stack R (a vencer claro embaixo, vencido cheio em cima) */}
          <Bar dataKey="rAVencer" stackId="R" name="A Receber a vencer" maxBarSize={30} cursor="pointer" onClick={(d: unknown) => handleClick(d as FinContasAbertoData)}>
            {data.map((e) => <Cell key={e.mes} fill={CYAN} fillOpacity={0.4} opacity={dim(e.mes)} />)}
          </Bar>
          <Bar dataKey="rVencido" stackId="R" name="A Receber vencido" radius={[3, 3, 0, 0]} maxBarSize={30} cursor="pointer" onClick={(d: unknown) => handleClick(d as FinContasAbertoData)}>
            {data.map((e) => <Cell key={e.mes} fill={CYAN} opacity={dim(e.mes)} />)}
          </Bar>
          {/* A Pagar — stack P */}
          <Bar dataKey="pAVencer" stackId="P" name="A Pagar a vencer" maxBarSize={30} cursor="pointer" onClick={(d: unknown) => handleClick(d as FinContasAbertoData)}>
            {data.map((e) => <Cell key={e.mes} fill={AMBER} fillOpacity={0.4} opacity={dim(e.mes)} />)}
          </Bar>
          <Bar dataKey="pVencido" stackId="P" name="A Pagar vencido" radius={[3, 3, 0, 0]} maxBarSize={30} cursor="pointer" onClick={(d: unknown) => handleClick(d as FinContasAbertoData)}>
            {data.map((e) => <Cell key={e.mes} fill={AMBER} opacity={dim(e.mes)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
