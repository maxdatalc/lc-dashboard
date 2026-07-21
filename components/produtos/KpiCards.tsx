"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  Coins, Tag, TrendingUp, AlertCircle, ShieldCheck, HelpCircle, PackageX, TimerOff,
} from "lucide-react";
import type { ProdutosKpis, StatusEstoque } from "@/lib/db/produtos-estoque";
import { useCountUp } from "./useCountUp";
import { fmtMoeda, fmtInt, fmtPct } from "./utils";

// ── Padrão visual compartilhado com o dashboard Financeiro ─────────────────────
// Hierarquia: label pequeno em caixa alta → valor grande tabular → subtítulo curto.
// Cards financeiros (moeda) têm subtítulo neutro; cards de status (clicáveis para
// cross-filter) mostram um pill tingido com a participação na base.

const cardBase: CSSProperties = {
  background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 14,
  padding: "14px 16px", height: "100%", display: "flex", flexDirection: "column",
  justifyContent: "space-between", gap: 10, overflow: "hidden",
  boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
  animation: "fadeInUp 0.4s ease-out both",
};

const valueStyle = (color: string): CSSProperties => ({
  fontSize: "clamp(17px,1.6vw,23px)", fontWeight: 800, fontFamily: "var(--font-numeric)",
  color, letterSpacing: "-0.02em", lineHeight: 1.05, whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
});

function KpiHead({ label, icon, color }: { label: string; icon: ReactNode; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
      <span style={{
        fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
        color: "var(--text-muted)", lineHeight: 1.35, paddingTop: 2,
      }}>
        {label}
      </span>
      <div style={{
        width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center",
        justifyContent: "center", background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color, flexShrink: 0,
      }}>
        {icon}
      </div>
    </div>
  );
}

// ── Card de valor (moeda) — sem clique ─────────────────────────────────────────

function ValorCard({
  icon, label, valor, sub, color, delay,
}: {
  icon: ReactNode; label: string; valor: number; sub: string; color: string; delay: number;
}) {
  const animado = useCountUp(valor);
  return (
    <div style={{ ...cardBase, animationDelay: `${delay}ms` }}>
      <KpiHead label={label} icon={icon} color={color} />
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={valueStyle(color)}>{fmtMoeda(animado)}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.3 }}>{sub}</div>
      </div>
    </div>
  );
}

// ── Card de contagem clicável (cross-filter) — status e "parado" ───────────────

function CountCard({
  icon, label, valor, base, color, active, onClick, delay, sub,
}: {
  icon: ReactNode; label: string; valor: number; base: number; color: string;
  active: boolean; onClick: () => void; delay: number; sub?: string;
}) {
  const animado = useCountUp(valor);
  const pct = base > 0 ? (valor / base) * 100 : 0;

  const style: CSSProperties = {
    ...cardBase,
    animationDelay: `${delay}ms`,
    textAlign: "left",
    cursor: "pointer",
    border: `1px solid ${active ? `color-mix(in srgb, ${color} 45%, transparent)` : "var(--border-subtle)"}`,
    background: active ? `color-mix(in srgb, ${color} 7%, var(--bg-card))` : "var(--bg-card)",
  };

  return (
    <button type="button" className="kpi-card" onClick={onClick} style={style} aria-pressed={active} title={`Filtrar por ${label.toLowerCase()}`}>
      <KpiHead label={label} icon={icon} color={color} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
        <div style={valueStyle(color)}>{fmtInt(animado)}</div>
        <span style={{
          fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
          background: `color-mix(in srgb, ${color} 9%, transparent)`, color,
          maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {sub ?? (base > 0 ? `${fmtPct(pct)} da base` : "—")}
        </span>
      </div>
    </button>
  );
}

// ── Grade de KPIs ──────────────────────────────────────────────────────────────

export function KpiCards({
  kpis, activeStatus, onStatusClick, paradoAtivo, onParadoClick,
}: {
  kpis: ProdutosKpis;
  activeStatus: StatusEstoque | null;
  onStatusClick: (s: StatusEstoque) => void;
  paradoAtivo: boolean;
  onParadoClick: () => void;
}) {
  const base = kpis.totalPosicoes;
  const IS = { size: 15, strokeWidth: 2 } as const;

  return (
    <div className="grid gap-3 grid-cols-1 xs:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
      <ValorCard delay={0}  icon={<Coins {...IS} />}      label="Valor em Estoque"   valor={kpis.valorCusto}      sub="capital investido a custo" color="var(--accent-yellow)" />
      <ValorCard delay={40} icon={<Tag {...IS} />}        label="Potencial de Venda" valor={kpis.valorVenda}      sub="estoque a preço de venda"  color="var(--accent-cyan)" />
      <ValorCard delay={80} icon={<TrendingUp {...IS} />} label="Margem Potencial"   valor={kpis.margemPotencial} sub="venda − custo"             color="var(--accent-green)" />

      <CountCard delay={120} icon={<AlertCircle {...IS} />} label="Abaixo do Mínimo" valor={kpis.abaixoMin} base={base} color="#ef4444" active={activeStatus === "abaixo"}   onClick={() => onStatusClick("abaixo")} />
      <CountCard delay={160} icon={<ShieldCheck {...IS} />} label="Acima do Mínimo"  valor={kpis.acimaMin}  base={base} color="var(--accent-yellow)" active={activeStatus === "acima"} onClick={() => onStatusClick("acima")} />
      <CountCard delay={200} icon={<HelpCircle {...IS} />}  label="Sem Mínimo"       valor={kpis.semMin}    base={base} color="var(--text-muted)" active={activeStatus === "semMin"}   onClick={() => onStatusClick("semMin")} />
      <CountCard delay={240} icon={<PackageX {...IS} />}    label="Estoque Negativo" valor={kpis.negativo}  base={base} color="#f43f5e" active={activeStatus === "negativo"} onClick={() => onStatusClick("negativo")} />
      <CountCard delay={280} icon={<TimerOff {...IS} />}    label="Produtos Parados" valor={kpis.parados}   base={base} color="#a78bfa" active={paradoAtivo} onClick={onParadoClick}
        sub={kpis.parados > 0 ? `${fmtMoeda(kpis.valorParado)} parados` : undefined} />
    </div>
  );
}
