"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export type KpiTint = "ink" | "cyan" | "mist" | "rose";

/**
 * Mapeamento fixo de papel → tint (assinatura visual do redesign mobile):
 * 1. Faturamento/Receita → ink  2. Pedidos/Vendas → cyan
 * 3. Clientes → mist            4. Produtos/Estoque → rose
 */
const TINT_COLOR: Record<KpiTint, string> = {
  ink: "var(--text-primary)",
  cyan: "var(--accent-cyan)",
  mist: "var(--text-muted)",
  rose: "var(--accent-rose)",
};

export interface KpiTileProps {
  label: string;
  /** Valor já formatado pelo caller (BRL, número, %). */
  value: string;
  tint: KpiTint;
  /** Barra de progresso com significado real (ex.: % do período decorrido). */
  progress?: { value: number; label: string };
  icon?: ReactNode;
  /** Variação vs período anterior, em %. */
  changePercent?: number | null;
  /** Para métricas onde subir é ruim (ex.: custo), inverte a cor da variação. */
  invertChange?: boolean;
  /** Contexto curto abaixo do valor (ex.: "114 vendas no período"). */
  context?: string;
  /** Explicação do cálculo, num "?" discreto ao lado do label. */
  hint?: string;
  isLoading?: boolean;
}

export function KpiTile({
  label,
  value,
  tint,
  progress,
  icon,
  changePercent,
  invertChange = false,
  context,
  hint,
  isLoading = false,
}: KpiTileProps) {
  const tintColor = TINT_COLOR[tint];
  const hasChange = changePercent !== null && changePercent !== undefined;
  const isUp = hasChange && changePercent! >= 0;
  const good = hasChange ? (invertChange ? !isUp : isUp) : false;

  return (
    <div
      className="flex min-w-0 flex-col gap-1.5 rounded-xl p-3.5 xs:p-4"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex items-center gap-1.5">
        {icon && (
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
            style={{
              color: tintColor,
              background: `color-mix(in srgb, ${tintColor} 12%, transparent)`,
            }}
          >
            {icon}
          </span>
        )}
        <p
          className="min-w-0 truncate text-[12px] font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          {label}
        </p>
        {hint && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info
                  className="shrink-0 cursor-help"
                  style={{ width: 12, height: 12, color: "var(--text-muted)" }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" style={{ maxWidth: 240, lineHeight: 1.4 }}>
                {hint}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {isLoading ? (
        <div className="shimmer rounded" style={{ height: 26, width: "70%" }} />
      ) : (
        <p
          className="font-semibold leading-tight tabular-nums"
          style={{
            color: "var(--text-primary)",
            fontFamily: "var(--font-numeric)",
            fontSize: "clamp(20px, 6vw, 26px)",
            letterSpacing: "-0.01em",
            // formatCurrency insere espaço não separável entre "R$" e o número;
            // sem isso valores longos não têm ponto de quebra e vazam do card.
            overflowWrap: "anywhere",
          }}
        >
          {value}
        </p>
      )}

      {progress && !isLoading && (
        <div
          role="img"
          aria-label={progress.label}
          title={progress.label}
          className="h-1 w-full overflow-hidden rounded-full"
          style={{ background: "var(--chart-track-bg)" }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${Math.min(100, Math.max(0, progress.value))}%`,
              background: tintColor,
            }}
          />
        </div>
      )}

      {(hasChange || context) && !isLoading && (
        <div className="flex flex-col gap-0.5">
          {hasChange && (
            <span
              className="inline-flex items-center gap-1 text-[12px] font-semibold tabular-nums"
              style={{ color: good ? "var(--accent-green)" : "var(--accent-red)" }}
            >
              {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {isUp ? "+" : ""}
              {changePercent!.toFixed(1).replace(".", ",")}%
              <span className="hidden font-normal xs:inline" style={{ color: "var(--text-muted)" }}>
                vs período anterior
              </span>
            </span>
          )}
          {context && (
            <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              {context}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
