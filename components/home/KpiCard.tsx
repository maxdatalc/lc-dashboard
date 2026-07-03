"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { InfoHint } from "./InfoHint";

export interface KpiCardProps {
  label: string;
  value: string;
  /** Contexto curto abaixo do valor (ex: "114 vendas no período"). */
  context?: string;
  /** Variação vs período anterior, em %. null = não exibir. */
  changePercent?: number | null;
  /** Para métricas onde subir é ruim (ex: custo), inverte a cor da variação. */
  invertChange?: boolean;
  /** Explicação do cálculo, exibida num "?" discreto. */
  hint?: string;
  /** Realce sutil (usado no card principal — faturamento). */
  emphasis?: boolean;
}

const POS = "#10b981";
const NEG = "#ef4444";

export function KpiCard({
  label,
  value,
  context,
  changePercent,
  invertChange = false,
  hint,
  emphasis = false,
}: KpiCardProps) {
  const hasChange = changePercent !== null && changePercent !== undefined;
  const isUp = hasChange && changePercent! >= 0;
  const good = hasChange ? (invertChange ? !isUp : isUp) : false;
  const changeColor = good ? POS : NEG;

  return (
    <div
      className="kpi-card flex-1 min-w-[150px] rounded-xl p-4 flex flex-col gap-2"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderTop: emphasis ? "1px solid var(--border-subtle)" : undefined,
        boxShadow: emphasis ? "inset 0 1px 0 rgba(0,229,255,0.10)" : undefined,
      }}
    >
      <div className="flex items-center gap-1.5">
        <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
          {label}
        </p>
        {hint && <InfoHint text={hint} />}
      </div>

      <p
        className="text-[26px] font-bold leading-none tabular-nums"
        style={{
          color: "var(--text-primary)",
          fontFamily: "var(--font-numeric)",
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </p>

      <div className="flex flex-col gap-0.5 mt-0.5">
        {hasChange && (
          <span
            className="text-[12px] font-semibold inline-flex items-center gap-1 tabular-nums"
            style={{ color: changeColor }}
          >
            {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {isUp ? "+" : ""}
            {changePercent!.toFixed(1)}%
            <span className="font-normal" style={{ color: "var(--text-muted)" }}>
              vs. anterior
            </span>
          </span>
        )}
        {context && (
          <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            {context}
          </span>
        )}
      </div>
    </div>
  );
}
