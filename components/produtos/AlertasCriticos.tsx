"use client";

import { ClipboardX, TrendingDown, PackageX, ArrowDownWideNarrow, ChevronRight, CheckCircle2, Flame, TimerOff } from "lucide-react";
import type { ProdutosKpis, StatusEstoque } from "@/lib/db/produtos-estoque";
import { fmtInt, fmtMoeda } from "./utils";

interface Alerta {
  onClick: () => void;
  isSel: boolean;
  icon: React.ReactNode;
  titulo: string;
  desc: string;
  color: string;
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
  const IS = { width: 18, height: 18, strokeWidth: 2 } as const;

  const alertas: (Alerta & { count: number })[] = [
    { count: kpis.rupturaAtiva, onClick: () => onStatusClick("negativo"), isSel: activeStatus === "negativo", color: "#dc2626", icon: <Flame {...IS} />,
      titulo: `Ruptura ativa em ${fmtInt(kpis.rupturaAtiva)} itens`, desc: "Vendem e estão zerados — reposição urgente." },
    { count: kpis.negativo,  onClick: () => onStatusClick("negativo"), isSel: activeStatus === "negativo", color: "#f43f5e", icon: <PackageX {...IS} />,
      titulo: `Estoque negativo em ${fmtInt(kpis.negativo)} itens`, desc: "Risco de ruptura e atraso em entregas." },
    { count: kpis.margemNeg, onClick: () => onStatusClick("margemNeg"), isSel: activeStatus === "margemNeg", color: "#dc2626", icon: <TrendingDown {...IS} />,
      titulo: `Margem negativa em ${fmtInt(kpis.margemNeg)} produtos`, desc: "Revise preços e custos para evitar prejuízo." },
    { count: kpis.abaixoMin, onClick: () => onStatusClick("abaixo"), isSel: activeStatus === "abaixo", color: "#ef4444", icon: <ArrowDownWideNarrow {...IS} />,
      titulo: `${fmtInt(kpis.abaixoMin)} produtos abaixo do mínimo`, desc: "Priorize a reposição destes itens." },
    { count: kpis.parados, onClick: onParadoClick, isSel: paradoAtivo, color: "#a78bfa", icon: <TimerOff {...IS} />,
      titulo: `${fmtInt(kpis.parados)} produtos parados`, desc: `${fmtMoeda(kpis.valorParado)} em capital sem giro.` },
    { count: kpis.semMin,    onClick: () => onStatusClick("semMin"), isSel: activeStatus === "semMin", color: "#64748b", icon: <ClipboardX {...IS} />,
      titulo: `Cadastro crítico: ${fmtInt(kpis.semMin)} sem mínimo`, desc: "Impacta diretamente a reposição e a cobertura." },
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
    <div className="custom-scroll flex flex-col gap-2 h-full" style={{ overflowY: "auto" }}>
      {alertas.map((a, i) => (
          <button
            type="button"
            key={a.titulo}
            onClick={a.onClick}
            className="alerta-item flex items-center gap-3 rounded-xl text-left transition-all"
            style={{
              padding: "11px 12px",
              background: a.isSel ? `${a.color}12` : "var(--bg-elevated)",
              border: `1px solid ${a.isSel ? a.color : "var(--border-subtle)"}`,
              borderLeft: `3px solid ${a.color}`,
              cursor: "pointer",
              animation: "fadeInUp 0.35s ease-out both",
              animationDelay: `${i * 50}ms`,
            }}
          >
            <div className="flex-shrink-0 flex items-center justify-center rounded-lg"
              style={{ width: 34, height: 34, background: `${a.color}18`, color: a.color }}>
              {a.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>{a.titulo}</p>
              <p className="truncate" style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{a.desc}</p>
            </div>
            <ChevronRight style={{ width: 16, height: 16, color: "var(--text-muted)", flexShrink: 0 }} />
          </button>
      ))}
    </div>
  );
}
