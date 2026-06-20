"use client";

import { TrendingUp, TrendingDown, Info, type LucideIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface KpiCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  accentColor: string;
  isLoading?: boolean;
  change?: number;
  changeLabel?: string;
  subtitle?: string;
  titleTooltip?: string;
  animationDelay?: number;
  // Compatibilidade com uso anterior
  secondaryValue?: string;
  secondaryLabel?: string;
  secondaryColor?: string;
}

function DeltaBadge({ change, label }: { change: number; label?: string }) {
  const pos = change > 0;
  const neu = change === 0;
  const bg = pos ? "rgba(16,185,129,0.15)" : neu ? "rgba(71,85,105,0.3)" : "rgba(239,68,68,0.15)";
  const color = pos ? "#10b981" : neu ? "#94a3b8" : "#ef4444";

  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
      style={{ backgroundColor: bg, color }}
    >
      {pos ? (
        <TrendingUp style={{ width: 10, height: 10 }} />
      ) : !neu ? (
        <TrendingDown style={{ width: 10, height: 10 }} />
      ) : null}
      <span>
        {pos ? "+" : ""}
        {change.toFixed(1).replace(".", ",")}%
      </span>
      {label && (
        <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{label}</span>
      )}
    </div>
  );
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  accentColor,
  isLoading = false,
  change,
  changeLabel,
  subtitle,
  titleTooltip,
  animationDelay = 0,
}: KpiCardProps) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2 transition-all duration-200"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderTop: `3px solid ${accentColor}`,
        animation: `fadeInUp 0.4s ease-out both`,
        animationDelay: `${animationDelay}ms`,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = `${accentColor}66`;
        el.style.boxShadow = `0 0 20px ${accentColor}18`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "var(--border-subtle)";
        el.style.boxShadow = "none";
      }}
    >
      {/* Topo: ícone + título + delta */}
      <div className="flex items-start gap-2.5">
        {/* Ícone 32×32 */}
        <div
          className="flex items-center justify-center flex-shrink-0 rounded-[8px]"
          style={{
            width: 32,
            height: 32,
            backgroundColor: `${accentColor}1f`,
            color: accentColor,
          }}
        >
          <Icon style={{ width: 16, height: 16 }} />
        </div>

        {/* Título + valor */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            {/* Título com tooltip opcional */}
            <div className="flex items-center gap-1">
              <p
                className="font-semibold uppercase tracking-widest"
                style={{ fontSize: "11px", color: "var(--text-secondary)" }}
              >
                {title}
              </p>
              {titleTooltip && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info
                        className="cursor-help flex-shrink-0"
                        style={{ width: 12, height: 12, color: "var(--text-muted)" }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" style={{ maxWidth: 240, lineHeight: 1.4 }}>
                      {titleTooltip}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Delta badge */}
            {change !== undefined && !isLoading && (
              <DeltaBadge change={change} label={changeLabel} />
            )}
          </div>

          {/* Valor principal em DM Serif Display */}
          {isLoading ? (
            <div className="shimmer rounded mt-2" style={{ height: 28, width: 120 }} />
          ) : (
            <p
              className="tabular-nums mt-1 leading-none"
              style={{
                fontFamily: "var(--font-display, 'DM Serif Display', serif)",
                fontSize: "clamp(16px, 2.5vw, 24px)",
                fontWeight: 400,
                color: "var(--text-primary)",
              }}
            >
              {value}
            </p>
          )}
        </div>
      </div>

      {/* Subtítulo opcional com divisor */}
      {subtitle && !isLoading && (
        <>
          <div style={{ height: 1, backgroundColor: "var(--border-subtle)" }} />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        </>
      )}

      {/* Loading skeleton para subtítulo */}
      {isLoading && (
        <div className="shimmer rounded" style={{ height: 14, width: 100 }} />
      )}
    </div>
  );
}
