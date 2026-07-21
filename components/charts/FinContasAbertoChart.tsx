"use client";

import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

export interface FinContasAbertoData {
  mes: string;
  rVencido: number;
  rHoje: number;
  rAVencer: number;
  pVencido: number;
  pHoje: number;
  pAVencer: number;
}

type Tab = "vencidos" | "hoje" | "avencer";

interface Props {
  data: FinContasAbertoData[];
  selectedMes?: string | null;
  onMesClick?: (mes: string | null) => void;
}

const CYAN = "var(--accent-cyan)";
const AMBER = "var(--accent-yellow)";
const RED = "#ef4444";

const TABS: { key: Tab; label: string }[] = [
  { key: "vencidos", label: "Vencidos" },
  { key: "hoje", label: "Hoje" },
  { key: "avencer", label: "A Vencer" },
];

function axisAbbr(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `R$ ${(a / 1_000_000).toFixed(1)} mi`;
  if (a >= 1_000)     return `R$ ${(a / 1_000).toFixed(1)} mi`.replace(" mi", " mil");
  return `R$ ${v.toFixed(0)}`;
}
function fmtFull(v: number) {
  return `${v < 0 ? "-" : ""}R$ ${Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}
function mesLabel(mes: string) {
  const [y, m] = mes.split("-");
  const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${meses[parseInt(m, 10) - 1]}/${y}`;
}
function nowIdx(k: string) { const [y, m] = k.split("-").map(Number); return y * 12 + (m - 1); }

interface PlotRow { mes: string; receber: number; pagar: number; }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { payload: PlotRow }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "10px 14px", fontSize: 12, minWidth: 180, boxShadow: "0 12px 32px rgba(0,0,0,0.35)" }}>
      <p style={{ color: "var(--text-secondary)", marginBottom: 6, fontWeight: 700 }}>{label ? mesLabel(label) : ""}</p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: CYAN, marginBottom: 2 }}>
        <span>A Receber</span>
        <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>{fmtFull(d.receber)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: AMBER }}>
        <span>A Pagar</span>
        <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>{fmtFull(d.pagar)}</span>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--text-secondary)" }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
      {label}
    </span>
  );
}

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div style={{ display: "inline-flex", background: "var(--bg-card-hover)", borderRadius: 9, padding: 3, gap: 2 }}>
      {TABS.map((t) => {
        const on = tab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              padding: "5px 12px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
              border: "none", transition: "all .15s",
              background: on ? "var(--bg-card)" : "transparent",
              color: on ? "var(--text-primary)" : "var(--text-muted)",
              boxShadow: on ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Painel "Hoje": não é série temporal, então vira uma comparação simples ────

function HojePanel({ receber, pagar, onSelect, active }: { receber: number; pagar: number; onSelect: () => void; active: boolean }) {
  if (receber === 0 && pagar === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 214, color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "0 24px" }}>
        Nenhum título vence hoje.
      </div>
    );
  }
  const max = Math.max(receber, pagar, 1);
  const resultado = receber - pagar;
  const Row = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) => (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
          {icon} {label}
        </span>
        <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color }}>{fmtFull(value)}</span>
      </div>
      <div style={{ height: 10, borderRadius: 5, background: "var(--bg-card-hover)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(value / max) * 100}%`, background: color, borderRadius: 5, transition: "width .5s cubic-bezier(.22,.61,.36,1)" }} />
      </div>
    </div>
  );
  return (
    <button
      onClick={onSelect}
      style={{
        display: "flex", flexDirection: "column", gap: 18, width: "100%", height: 214, justifyContent: "center",
        padding: "0 4px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
        opacity: active ? 1 : 0.9,
      }}
      title="Clique para filtrar o painel pelo mês atual"
    >
      <Row icon={<ArrowDownCircle size={14} color={CYAN} />} label="A Receber hoje" value={receber} color={CYAN} />
      <Row icon={<ArrowUpCircle size={14} color={AMBER} />} label="A Pagar hoje" value={pagar} color={AMBER} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Resultado do dia</span>
        <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: resultado >= 0 ? "var(--accent-green)" : RED }}>
          {resultado >= 0 ? "+" : ""}{fmtFull(resultado)}
        </span>
      </div>
    </button>
  );
}

export function FinContasAbertoChart({ data, selectedMes, onMesClick }: Props) {
  const [tab, setTab] = useState<Tab>("vencidos");
  const nowKey = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const baseIdx = nowIdx(nowKey);

  const plot: PlotRow[] = useMemo(() => {
    if (tab === "vencidos") {
      return data
        .filter((d) => nowIdx(d.mes) <= baseIdx)
        .map((d) => ({ mes: d.mes, receber: d.rVencido, pagar: d.pVencido }))
        .filter((d) => d.receber > 0 || d.pagar > 0);
    }
    if (tab === "avencer") {
      return data
        .filter((d) => nowIdx(d.mes) >= baseIdx)
        .map((d) => ({ mes: d.mes, receber: d.rAVencer - d.rHoje, pagar: d.pAVencer - d.pHoje }))
        .filter((d) => d.receber > 0 || d.pagar > 0);
    }
    return [];
  }, [data, tab, baseIdx]);

  // Muitos meses (sobretudo em "Vencidos") não cabem lado a lado — rola horizontalmente
  // em vez de espremer ou cortar meses.
  const chartWidth = Math.max(320, plot.length * 68);

  const hojeRow = data.find((d) => d.mes === nowKey);
  const hojeReceber = hojeRow?.rHoje ?? 0;
  const hojePagar = hojeRow?.pHoje ?? 0;

  const handleClick = (entry: PlotRow) => { if (onMesClick) onMesClick(selectedMes === entry.mes ? null : entry.mes); };
  const dim = (mes: string) => (!selectedMes || selectedMes === mes ? 1 : 0.25);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="flex flex-wrap items-center justify-center gap-2 md:justify-between">
        <div style={{ display: "flex", gap: 14 }}>
          <LegendDot color={CYAN} label="A Receber" />
          <LegendDot color={AMBER} label="A Pagar" />
        </div>
        <TabBar tab={tab} onChange={setTab} />
      </div>

      {tab === "hoje" ? (
        <HojePanel
          receber={hojeReceber}
          pagar={hojePagar}
          active={!selectedMes || selectedMes === nowKey}
          onSelect={() => onMesClick?.(selectedMes === nowKey ? null : nowKey)}
        />
      ) : plot.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 214, color: "var(--text-muted)", fontSize: 13 }}>
          {tab === "vencidos" ? "Sem títulos vencidos." : "Sem títulos a vencer."}
        </div>
      ) : (
        <div style={{ overflowX: "auto", overflowY: "hidden" }}>
          <div style={{ width: chartWidth, height: 214 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={plot} margin={{ top: 6, right: 8, left: 4, bottom: 0 }} barGap={4} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="mes" tickFormatter={mesLabel} tick={{ fill: "var(--text-muted)", fontSize: 10.5 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tickFormatter={axisAbbr} tick={{ fill: "var(--text-muted)", fontSize: 10.5 }} axisLine={false} tickLine={false} width={58} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(127,127,127,0.06)" }} />
                <Bar dataKey="receber" name="A Receber" radius={[3, 3, 0, 0]} maxBarSize={26} cursor="pointer" onClick={(d: unknown) => handleClick(d as PlotRow)}>
                  {plot.map((e) => <Cell key={e.mes} fill={CYAN} opacity={dim(e.mes)} />)}
                </Bar>
                <Bar dataKey="pagar" name="A Pagar" radius={[3, 3, 0, 0]} maxBarSize={26} cursor="pointer" onClick={(d: unknown) => handleClick(d as PlotRow)}>
                  {plot.map((e) => <Cell key={e.mes} fill={AMBER} opacity={dim(e.mes)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
