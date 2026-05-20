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
  secondaryValue?: string;
  secondaryLabel?: string;
  secondaryColor?: string;
  subtitle?: string;
  titleTooltip?: string;
  animationDelay?: number;
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded ${className ?? ""}`}
      style={{ backgroundColor: "var(--border-subtle)" }}
    />
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
  secondaryValue,
  secondaryLabel,
  secondaryColor,
  subtitle,
  titleTooltip,
  animationDelay = 0,
}: KpiCardProps) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4 transition-colors"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderLeft: `3px solid ${accentColor}`,
        animationDelay: `${animationDelay}ms`,
        animation: "kpiEntrance 0.4s ease both",
      }}
    >
      {/* Topo — título + ícone */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-secondary)" }}
          >
            {title}
          </p>
          {titleTooltip && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info
                    className="cursor-help flex-shrink-0"
                    style={{ width: "14px", height: "14px", color: "var(--text-muted)" }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" style={{ maxWidth: "240px", lineHeight: "1.4" }}>
                  {titleTooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: `${accentColor}1f`,
            color: accentColor,
          }}
        >
          <Icon className="h-4.5 w-4.5" style={{ width: "18px", height: "18px" }} />
        </div>
      </div>

      {/* Valor principal */}
      {isLoading ? (
        <Skeleton className="h-8 w-32" />
      ) : (
        <p
          className="text-3xl font-bold tabular-nums leading-none"
          style={{ color: "var(--text-primary)" }}
        >
          {value}
        </p>
      )}

      {/* Rodapé — variação ou valor secundário */}
      <div className="flex items-center justify-between gap-2 min-h-[20px]">
        {isLoading ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <>
            {/* Subtítulo simples (sem variação) */}
            {subtitle && change === undefined && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {subtitle}
              </span>
            )}

            {/* Variação percentual */}
            {change !== undefined && (
              <div
                className="flex items-center gap-1 text-xs font-medium"
                style={{
                  color:
                    change > 0
                      ? "var(--accent-green)"
                      : change < 0
                      ? "var(--accent-red)"
                      : "var(--text-secondary)",
                }}
              >
                {change > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : change < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : null}
                <span>
                  {change > 0 ? "+" : ""}
                  {change.toFixed(1).replace(".", ",")}%
                </span>
                {changeLabel && (
                  <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                    {changeLabel}
                  </span>
                )}
              </div>
            )}

            {/* Valor secundário (ex: devoluções) */}
            {secondaryValue && (
              <div className="flex items-center gap-1 text-xs">
                <span
                  className="font-semibold tabular-nums"
                  style={{ color: secondaryColor ?? "var(--text-secondary)" }}
                >
                  {secondaryValue}
                </span>
                {secondaryLabel && (
                  <span style={{ color: "var(--text-muted)" }}>{secondaryLabel}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
