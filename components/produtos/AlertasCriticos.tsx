"use client";

import { ClipboardX, TrendingDown, PackageX, ArrowDownWideNarrow, ChevronRight, CheckCircle2, Flame, TimerOff } from "lucide-react";
import type { ProdutosKpis, StatusEstoque } from "@/lib/db/produtos-estoque";
import { fmtInt, fmtMoeda } from "./utils";

interface Alerta {
  count: number;
  label: string;
  desc: string;
  color: string;
  icon: React.ReactNode;
  onClick: () => void;
  isSel: boolean;
}

export function AlertasCriticos({
  kpis, activeStatus, onStatusClick, paradoAtivo, onParadoClick,
}: {
  kpis: ProdutosKpis;
  activeStatus: StatusEstoque | null;
  onStatusClick: (s: StatusEstoque) => void;
  paradoAtivo: boolean;
  onParadoClick: () => void;
}) {
  const IS = { width: 15, height: 15, strokeWidth: 2 } as const;

  // Ordem = prioridade de ação para o gestor (mais urgente primeiro)
  const alertas: Alerta[] = [
    { count: kpis.rupturaAtiva, label: "Ruptura ativa", desc: "Vendem e estão zerados — repor primeiro.", color: "#dc2626", icon: <Flame {...IS} />,
      onClick: () => onStatusClick("negativo"), isSel: activeStatus === "negativo" },
    { count: kpis.negativo, label: "Estoque negativo", desc: "Saída sem entrada — acertar inventário.", color: "#f43f5e", icon: <PackageX {...IS} />,
      onClick: () => onStatusClick("negativo"), isSel: activeStatus === "negativo" },
    { count: kpis.margemNeg, label: "Margem negativa", desc: "Preço abaixo do custo — revisar preços.", color: "#dc2626", icon: <TrendingDown {...IS} />,
      onClick: () => onStatusClick("margemNeg"), isSel: activeStatus === "margemNeg" },
    { count: kpis.abaixoMin, label: "Abaixo do mínimo", desc: "Cobertura em risco — priorizar compra.", color: "#ef4444", icon: <ArrowDownWideNarrow {...IS} />,
      onClick: () => onStatusClick("abaixo"), isSel: activeStatus === "abaixo" },
    { count: kpis.parados, label: "Produtos parados", desc: `${fmtMoeda(kpis.valorParado)} em capital sem giro.`, color: "#a78bfa", icon: <TimerOff {...IS} />,
      onClick: onParadoClick, isSel: paradoAtivo },
    { count: kpis.semMin, label: "Sem mínimo informado", desc: "Compromete a análise de reposição.", color: "#64748b", icon: <ClipboardX {...IS} />,
      onClick: () => onStatusClick("semMin"), isSel: activeStatus === "semMin" },
  ].filter((a) => a.count > 0);

  if (alertas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-full text-center">
        <CheckCircle2 style={{ width: 26, height: 26, color: "#22c55e" }} />
        <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Nenhum alerta crítico no momento.</span>
      </div>
    );
  }

  return (
    <div className="custom-scroll flex flex-col gap-1.5 h-full" style={{ overflowY: "auto" }}>
      {alertas.map((a, i) => (
        <button
          type="button"
          key={a.label}
          onClick={a.onClick}
          className="alerta-item flex items-center gap-2.5 rounded-xl text-left w-full"
          style={{
            padding: "9px 11px",
            background: a.isSel ? `color-mix(in srgb, ${a.color} 8%, var(--bg-card))` : "var(--bg-elevated)",
            border: `1px solid ${a.isSel ? `color-mix(in srgb, ${a.color} 45%, transparent)` : "var(--border-subtle)"}`,
            borderLeft: `3px solid ${a.color}`,
            cursor: "pointer",
            animation: "fadeInUp 0.35s ease-out both",
            animationDelay: `${i * 45}ms`,
          }}
          aria-pressed={a.isSel}
          title={`Filtrar por ${a.label.toLowerCase()}`}
        >
          <div className="flex-shrink-0 flex items-center justify-center rounded-lg"
            style={{ width: 30, height: 30, background: `color-mix(in srgb, ${a.color} 12%, transparent)`, color: a.color }}>
            {a.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>{a.label}</p>
            <p className="truncate" style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 1 }}>{a.desc}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span style={{ fontSize: 15, fontWeight: 800, color: a.color, fontFamily: "var(--font-numeric)", fontVariantNumeric: "tabular-nums" }}>
              {fmtInt(a.count)}
            </span>
            <ChevronRight style={{ width: 14, height: 14, color: "var(--text-muted)" }} />
          </div>
        </button>
      ))}
    </div>
  );
}
