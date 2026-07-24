"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Info } from "lucide-react";
import { useFitText } from "@/hooks/use-fit-text";

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
  const { ref: valueRef, fontSize: valueFontSize } = useFitText<HTMLParagraphElement>(value, { max: 27, min: 14 });

  return (
    <div
      className="flex min-w-0 flex-col gap-2 overflow-hidden rounded-xl p-4"
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
          // Popover (clique) em vez de tooltip (hover): funciona no toque do
          // mobile e é um popup fechável (clicar no ícone de novo, fora, ou Esc).
          // Renderiza em portal, então o overflow-hidden do card não o corta.
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Sobre: ${label}`}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                style={{ color: "var(--text-muted)", lineHeight: 0 }}
              >
                <Info style={{ width: 13, height: 13 }} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              className="w-64 p-3 text-[12px] leading-relaxed"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
              }}
            >
              {hint}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {isLoading ? (
        <div className="shimmer rounded" style={{ height: 26, width: "70%" }} />
      ) : (
        <p
          ref={valueRef}
          className="font-semibold leading-tight tabular-nums"
          style={{
            color: "var(--text-primary)",
            fontFamily: "var(--font-numeric)",
            fontSize: valueFontSize,
            letterSpacing: "-0.01em",
            // Nunca quebra linha — useFitText encolhe a fonte até caber no
            // card em vez de quebrar o número no meio. minWidth:0 é
            // necessário porque este <p> é item de um flex-col: sem isso,
            // o item flex por padrão não encolhe abaixo da largura do
            // conteúdo (min-width:auto), e o hook nunca detecta overflow.
            whiteSpace: "nowrap",
            minWidth: 0,
            width: "100%",
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
          className="h-1.5 w-full overflow-hidden rounded-full"
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
              className="inline-flex flex-wrap items-center gap-1 text-[12px] font-semibold tabular-nums"
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
