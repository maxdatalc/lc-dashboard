"use client";

import type { CSSProperties } from "react";
import {
  Coins, Tag, TrendingUp, AlertCircle, ShieldCheck, HelpCircle, PackageX,
} from "lucide-react";
import type { ProdutosKpis, StatusEstoque } from "@/lib/db/produtos-estoque";
import { useCountUp } from "./useCountUp";
import { fmtMoeda, fmtInt, fmtPct, COR_CUSTO, COR_VENDA, COR_MARGEM } from "./utils";

// ── Card de valor (moeda) — sem clique ─────────────────────────────────────────

function ValorCard({
  icon, label, valor, sub, color, delay,
}: {
  icon: React.ReactNode; label: string; valor: number; sub: string; color: string; delay: number;
}) {
  const animado = useCountUp(valor);
  return (
    <div
      className="kpi-card rounded-xl p-4 relative overflow-hidden"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        animation: "fadeInUp 0.4s ease-out both",
        animationDelay: `${delay}ms`,
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color, opacity: 0.9 }} />
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
      </div>
      <p style={{ fontFamily: "var(--font-numeric)", fontSize: "clamp(20px,2vw,28px)", fontWeight: 700, color, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
        {fmtMoeda(animado)}
      </p>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{sub}</p>
    </div>
  );
}

// ── Card de contagem/status — clicável (cross-filter) ──────────────────────────

function StatusCard({
  icon, label, valor, base, color, status, active, onClick, delay,
}: {
  icon: React.ReactNode; label: string; valor: number; base: number; color: string;
  status: StatusEstoque; active: boolean; onClick: (s: StatusEstoque) => void; delay: number;
}) {
  const animado = useCountUp(valor);
  const pct = base > 0 ? (valor / base) * 100 : 0;

  const style: CSSProperties = {
    background: active ? `${color}14` : "var(--bg-card)",
    border: `1px solid ${active ? color : "var(--border-subtle)"}`,
    borderLeft: `3px solid ${color}`,
    animation: "fadeInUp 0.4s ease-out both",
    animationDelay: `${delay}ms`,
    cursor: "pointer",
  };

  return (
    <button
      type="button"
      onClick={() => onClick(status)}
      className="kpi-card rounded-xl p-4 text-left transition-all"
      style={style}
      aria-pressed={active}
      title={`Filtrar por ${label.toLowerCase()}`}
    >
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
      </div>
      <p style={{ fontFamily: "var(--font-numeric)", fontSize: "clamp(20px,2vw,28px)", fontWeight: 700, color, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
        {fmtInt(animado)}
      </p>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
        {base > 0 ? `${fmtPct(pct)} da base` : "—"}
      </p>
    </button>
  );
}

// ── Grade de KPIs ──────────────────────────────────────────────────────────────

export function KpiCards({
  kpis, activeStatus, onStatusClick,
}: {
  kpis: ProdutosKpis;
  activeStatus: StatusEstoque | null;
  onStatusClick: (s: StatusEstoque) => void;
}) {
  const base = kpis.totalPosicoes;
  const IS = { width: 16, height: 16, strokeWidth: 2 } as const;

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-7">
      <ValorCard delay={0}  icon={<Coins {...IS} />}      label="Valor em Estoque — Custo" valor={kpis.valorCusto}   sub="capital investido"           color={COR_CUSTO} />
      <ValorCard delay={40} icon={<Tag {...IS} />}        label="Potencial de Venda"           valor={kpis.valorVenda}   sub="estoque a preço de venda"    color={COR_VENDA} />
      <ValorCard delay={80} icon={<TrendingUp {...IS} />} label="Margem Potencial"             valor={kpis.margemPotencial} sub="venda − custo"        color={COR_MARGEM} />

      <StatusCard delay={120} icon={<AlertCircle {...IS} />} label="Abaixo do Mínimo"      valor={kpis.abaixoMin} base={base} color="#ef4444" status="abaixo"    active={activeStatus === "abaixo"}    onClick={onStatusClick} />
      <StatusCard delay={160} icon={<ShieldCheck {...IS} />} label="Acima do Mínimo"       valor={kpis.acimaMin}  base={base} color="#f59e0b" status="acima"     active={activeStatus === "acima"}     onClick={onStatusClick} />
      <StatusCard delay={200} icon={<HelpCircle {...IS} />}  label="Mínimo não Informado"  valor={kpis.semMin}    base={base} color="#64748b" status="semMin"    active={activeStatus === "semMin"}    onClick={onStatusClick} />
      <StatusCard delay={240} icon={<PackageX {...IS} />}    label="Estoque Negativo"      valor={kpis.negativo}  base={base} color="#f43f5e" status="negativo"  active={activeStatus === "negativo"}  onClick={onStatusClick} />
    </div>
  );
}
