"use client";

import { TrendingUp, TrendingDown, Minus, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiAccent = "blue" | "green" | "indigo" | "amber" | "red";
export type KpiTrend = "up" | "down" | "neutral";

export interface KpiCardProps {
  label: string;
  value: string;
  trend?: string;
  trendType?: KpiTrend;
  accent?: KpiAccent;
  onClick?: () => void;
}

const topStripe: Record<KpiAccent, string> = {
  blue:   "before:bg-gradient-to-r before:from-blue-700 before:to-blue-400",
  green:  "before:bg-emerald-500",
  indigo: "before:bg-indigo-400",
  amber:  "before:bg-amber-400",
  red:    "before:bg-red-400",
};

export function KpiCard({
  label, value, trend, trendType = "neutral", accent = "blue", onClick,
}: KpiCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative w-full text-left overflow-hidden",
        "bg-card border border-border rounded-xl p-4",
        "hover:border-primary/40 hover:bg-primary/5",
        "transition-all duration-150",
        "before:absolute before:inset-x-0 before:top-0 before:h-[2px]",
        topStripe[accent]
      )}
    >
      <ArrowUpRight className="absolute top-3 right-3 h-3.5 w-3.5
        text-transparent group-hover:text-muted-foreground/50 transition-colors" />

      <p className="text-[10px] font-semibold uppercase tracking-widest
        text-muted-foreground mb-2 pr-4">
        {label}
      </p>

      <p className="text-xl font-bold tabular-nums text-foreground
        leading-none mb-2">
        {value}
      </p>

      {trend && (
        <p className={cn("flex items-center gap-1 text-[11px]", {
          "text-emerald-500": trendType === "up",
          "text-red-400":     trendType === "down",
          "text-muted-foreground": trendType === "neutral",
        })}>
          {trendType === "up"      && <TrendingUp   className="h-3 w-3" />}
          {trendType === "down"    && <TrendingDown  className="h-3 w-3" />}
          {trendType === "neutral" && <Minus         className="h-3 w-3" />}
          {trend}
        </p>
      )}
    </button>
  );
}
