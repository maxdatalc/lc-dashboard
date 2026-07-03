"use client";

import Link from "next/link";
import { ArrowUpRight, Lock } from "lucide-react";
import { InfoHint } from "./InfoHint";
import { type StatusLevel, STATUS_TOKENS } from "./types";

export interface AnalyticalRow {
  label: string;
  value: string;
  subvalue?: string;
  /** Realce semântico do subvalue (não do valor principal). */
  highlight?: StatusLevel | null;
  hint?: string;
  /** Ocupa a linha inteira do grid (2 colunas). */
  wide?: boolean;
}

export interface AnalyticalCardProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  href: string;
  isUnlocked: boolean;
  featureKey: string;
  onUnlock: (featureKey: string, title: string) => void;
  rows: AnalyticalRow[];
  progress?: { value: number; label: string; color?: string };
  alert?: { level: StatusLevel; text: string } | null;
}

export function AnalyticalCard({
  title,
  subtitle,
  icon: Icon,
  href,
  isUnlocked,
  featureKey,
  onUnlock,
  rows,
  progress,
  alert,
}: AnalyticalCardProps) {
  return (
    <div
      className="kpi-card rounded-2xl p-5 flex flex-col gap-4"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="flex items-center justify-center rounded-lg shrink-0"
            style={{ background: "var(--bg-elevated)", width: 34, height: 34 }}
          >
            <Icon size={17} style={{ color: "var(--text-secondary)" }} />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
              {title}
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              {subtitle}
            </p>
          </div>
        </div>

        {isUnlocked ? (
          <Link
            href={href}
            className="flex items-center gap-1 text-[12px] font-semibold shrink-0 transition-opacity hover:opacity-80"
            style={{ color: "var(--accent-cyan)" }}
          >
            Ver detalhes
            <ArrowUpRight size={14} />
          </Link>
        ) : (
          <button
            onClick={() => onUnlock(featureKey, title)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium shrink-0 transition-colors"
            style={{
              border: "1px solid var(--border-subtle)",
              color: "var(--text-muted)",
              background: "transparent",
            }}
          >
            <Lock size={12} />
            Desbloquear
          </button>
        )}
      </div>

      {/* ── Métricas ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
        {rows.map((row, idx) => (
          <div key={idx} className={`flex flex-col gap-1 min-w-0 ${row.wide ? "col-span-2" : ""}`}>
            <span className="text-[11px] inline-flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
              {row.label}
              {row.hint && <InfoHint text={row.hint} />}
            </span>
            <span
              className="text-[15px] font-semibold leading-tight truncate"
              style={{ color: "var(--text-primary)" }}
              title={row.value}
            >
              {row.value}
            </span>
            {row.subvalue && (
              <span
                className="text-[12px] leading-snug"
                style={{
                  color: row.highlight ? STATUS_TOKENS[row.highlight].color : "var(--text-muted)",
                }}
              >
                {row.subvalue}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ── Barra de progresso ─────────────────────────────────── */}
      {progress && (
        <div className="flex flex-col gap-1.5">
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: 5, background: "var(--chart-track-bg)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(Math.max(progress.value, 0), 100)}%`,
                background: progress.color ?? "var(--accent-cyan)",
              }}
            />
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {progress.label}
          </p>
        </div>
      )}

      {/* ── Alerta contextual ──────────────────────────────────── */}
      {alert && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] leading-snug"
          style={{
            background: STATUS_TOKENS[alert.level].soft,
            color: "var(--text-secondary)",
          }}
        >
          <span
            className="mt-1 shrink-0 rounded-full"
            style={{ width: 6, height: 6, background: STATUS_TOKENS[alert.level].color }}
          />
          <span>{alert.text}</span>
        </div>
      )}
    </div>
  );
}
