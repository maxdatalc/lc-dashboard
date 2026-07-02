"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  Coins, Tag, TrendingUp, AlertCircle, ShieldCheck, HelpCircle, PackageX, TimerOff,
} from "lucide-react";
import type { ProdutosKpis, StatusEstoque } from "@/lib/db/produtos-estoque";
import { useCountUp } from "./useCountUp";
import { fmtMoeda, fmtInt, fmtPct } from "./utils";

// ── Padrão visual compartilhado com o dashboard Financeiro ─────────────────────
// (mesmo cardBase / IconBadge / KpiHead de app/(dashboard)/dashboard/financeiro)

const cardBase: CSSProperties = {
  background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16,
  padding: "16px 18px", height: "100%", position: "relative", overflow: "hidden",
  animation: "fadeInUp 0.4s ease-out both",
};

function IconBadge({ children, color }: { children: ReactNode; color: string }) {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center",
      justifyContent: "center", background: `color-mix(in srgb, ${color} 14%, transparent)`,
      color, flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

function KpiHead({ label, icon, color }: { label: string; icon: ReactNode; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>{label}</span>
      <IconBadge color={color}>{icon}</IconBadge>
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
      <div style={{
        fontSize: "clamp(18px,1.7vw,24px)", fontWeight: 800, fontFamily: "var(--font-numeric)",
        color, letterSpacing: "-0.02em", lineHeight: 1, whiteSpace: "nowrap", marginBottom: 8,
        fontVariantNumeric: "tabular-nums",
      }}>
        {fmtMoeda(animado)}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{sub}</div>
    </div>
  );
}

// ── Card de contagem clicável (cross-filter) — genérico, usado por status e "parado" ──

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
    background: active ? `color-mix(in srgb, ${color} 8%, var(--bg-card))` : "var(--bg-card)",
  };

  return (
    <button type="button" className="kpi-card" onClick={onClick} style={style} aria-pressed={active} title={`Filtrar por ${label.toLowerCase()}`}>
      <KpiHead label={label} icon={icon} color={color} />
      <div style={{
        fontSize: "clamp(18px,1.7vw,24px)", fontWeight: 800, fontFamily: "var(--font-numeric)",
        color, letterSpacing: "-0.02em", lineHeight: 1, whiteSpace: "nowrap", marginBottom: 8,
        fontVariantNumeric: "tabular-nums",
      }}>
        {fmtInt(animado)}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
        {sub ?? (base > 0 ? `${fmtPct(pct)} da base` : "—")}
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
  const IS = { size: 17, strokeWidth: 2 } as const;

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
      <ValorCard delay={0}  icon={<Coins {...IS} />}      label="Valor em Estoque — Custo" valor={kpis.valorCusto}      sub="capital investido"        color="var(--accent-yellow)" />
      <ValorCard delay={40} icon={<Tag {...IS} />}        label="Potencial de Venda"        valor={kpis.valorVenda}      sub="estoque a preço de venda" color="var(--accent-cyan)" />
      <ValorCard delay={80} icon={<TrendingUp {...IS} />} label="Margem Potencial"          valor={kpis.margemPotencial} sub="venda − custo"            color="var(--accent-green)" />

      <CountCard delay={120} icon={<AlertCircle {...IS} />} label="Abaixo do Mínimo"     valor={kpis.abaixoMin} base={base} color="#ef4444" active={activeStatus === "abaixo"}    onClick={() => onStatusClick("abaixo")} />
      <CountCard delay={160} icon={<ShieldCheck {...IS} />} label="Acima do Mínimo"      valor={kpis.acimaMin}  base={base} color="var(--accent-yellow)" active={activeStatus === "acima"}     onClick={() => onStatusClick("acima")} />
      <CountCard delay={200} icon={<HelpCircle {...IS} />}  label="Mínimo não Informado" valor={kpis.semMin}    base={base} color="var(--text-muted)" active={activeStatus === "semMin"}    onClick={() => onStatusClick("semMin")} />
      <CountCard delay={240} icon={<PackageX {...IS} />}    label="Estoque Negativo"     valor={kpis.negativo}  base={base} color="#f43f5e" active={activeStatus === "negativo"}  onClick={() => onStatusClick("negativo")} />
      <CountCard delay={280} icon={<TimerOff {...IS} />}    label="Produtos Parados"     valor={kpis.parados}   base={base} color="#a78bfa" active={paradoAtivo} onClick={onParadoClick}
        sub={kpis.parados > 0 ? `${fmtMoeda(kpis.valorParado)} parados` : undefined} />
    </div>
  );
}
