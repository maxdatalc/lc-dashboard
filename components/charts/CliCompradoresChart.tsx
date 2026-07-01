"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend, LabelList,
  type LabelProps,
} from "recharts";

export interface CliCompradoresData {
  mes: string;
  recorrentes: number;
  naoRecorrentes: number;
  total: number;
}

interface Props {
  data: CliCompradoresData[];
  selectedMes?: string | null;
  onMesClick?: (mes: string | null) => void;
}

function mesLabel(mes: string) {
  const [y, m] = mes.split("-");
  const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${meses[parseInt(m, 10) - 1]}/${y}`;
}
function num(v: number) { return v.toLocaleString("pt-BR"); }

function CustomTooltip({ active, label, payload }: { active?: boolean; label?: string; payload?: { payload: CliCompradoresData }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const pct = row.total > 0 ? (row.recorrentes / row.total) * 100 : 0;
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "10px 14px", fontSize: 12, minWidth: 220, boxShadow: "0 12px 32px rgba(0,0,0,0.35)" }}>
      <p style={{ color: "var(--text-secondary)", marginBottom: 6, fontWeight: 700 }}>{label ? mesLabel(label) : ""}</p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "var(--accent-cyan)", marginBottom: 2 }}>
        <span>Recorrentes</span><span style={{ fontWeight: 700 }}>{num(row.recorrentes)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "var(--accent-yellow)", marginBottom: 2 }}>
        <span>Não recorrentes</span><span style={{ fontWeight: 700 }}>{num(row.naoRecorrentes)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "var(--text-secondary)", marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border-subtle)" }}>
        <span>Total de compradores</span><span style={{ fontWeight: 700 }}>{num(row.total)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "var(--text-muted)", marginTop: 2 }}>
        <span>Recorrência</span><span style={{ fontWeight: 700 }}>{pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

// Rótulo dentro da barra: "555 (63%)" estilo imagem de referência.
// Recebe a série completa para calcular o % sobre o total de compradores do mês.
function makeStackLabel(data: CliCompradoresData[]) {
  return function StackLabel(props: LabelProps & { index?: number }) {
    const x = Number(props.x ?? 0), y = Number(props.y ?? 0);
    const width = Number(props.width ?? 0), height = Number(props.height ?? 0);
    const value = Number(props.value ?? 0), index = props.index ?? 0;
    if (!value || height < 15 || width < 34) return null;
    const total = data[index]?.total ?? 0;
    const pctv = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
      <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700} fill="#fff">
        {num(value)} ({pctv}%)
      </text>
    );
  };
}

export function CliCompradoresChart({ data, selectedMes, onMesClick }: Props) {
  const handleClick = (entry: CliCompradoresData) => {
    if (onMesClick) onMesClick(selectedMes === entry.mes ? null : entry.mes);
  };
  const dim = (mes: string) => (!selectedMes || selectedMes === mes ? 1 : 0.22);
  const showLabels = data.length <= 8;
  const StackLabel = makeStackLabel(data);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 24, right: 10, left: 6, bottom: 0 }} barCategoryGap="24%">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis dataKey="mes" tickFormatter={mesLabel} tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(127,127,127,0.06)" }} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(v) => <span style={{ color: "var(--text-secondary)" }}>{v}</span>} iconType="circle" />

        <Bar dataKey="recorrentes" name="Recorrentes" stackId="buyers" maxBarSize={54} cursor="pointer" fill="var(--accent-cyan)" onClick={(d: unknown) => handleClick(d as CliCompradoresData)}>
          {data.map((e) => <Cell key={e.mes} opacity={dim(e.mes)} />)}
          {showLabels && <LabelList dataKey="recorrentes" content={StackLabel} />}
        </Bar>
        <Bar dataKey="naoRecorrentes" name="Não recorrentes" stackId="buyers" radius={[4, 4, 0, 0]} maxBarSize={54} cursor="pointer" fill="var(--accent-yellow)" onClick={(d: unknown) => handleClick(d as CliCompradoresData)}>
          {data.map((e) => <Cell key={e.mes} opacity={dim(e.mes)} />)}
          {showLabels && <LabelList dataKey="naoRecorrentes" content={StackLabel} />}
        </Bar>
        <Line type="monotone" dataKey="total" name="Total de compradores" stroke="var(--text-secondary)" strokeWidth={2}
          dot={{ r: 3, fill: "var(--text-secondary)", strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }}>
          {showLabels && <LabelList dataKey="total" position="top" formatter={(v) => num(Number(v))} fill="var(--text-secondary)" fontSize={10} fontWeight={700} />}
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
