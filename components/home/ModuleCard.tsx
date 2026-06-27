"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ModuleRow {
  label: string;
  value: string;
  subvalue?: string;
  locked?: boolean;
  highlight?: "green" | "red" | "amber";
}

export interface ModuleCardProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  accentColor: string;
  featureKey: string;
  isUnlocked: boolean;
  moduleHref: string;
  rows: ModuleRow[];
  progressValue?: number;
  progressLabel?: string;
  insight?: string | null;
  onUnlock: (featureKey: string, title: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HIGHLIGHT_COLORS: Record<string, string> = {
  green: "#22c55e",
  red: "#ef4444",
  amber: "#f59e0b",
};

// ─── Componente ───────────────────────────────────────────────────────────────

export function ModuleCard({
  title,
  subtitle,
  icon: Icon,
  accentColor,
  featureKey,
  isUnlocked,
  moduleHref,
  rows,
  progressValue,
  progressLabel,
  insight,
  onUnlock,
}: ModuleCardProps) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "12px",
        borderLeft: `3px solid ${accentColor}`,
      }}
      className="p-5 flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex items-center justify-center rounded-lg shrink-0"
            style={{ background: `${accentColor}20`, width: 36, height: 36 }}
          >
            <Icon size={18} style={{ color: accentColor }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
              {title}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {subtitle}
            </p>
          </div>
        </div>

        {/* Botão Painel completo */}
        {isUnlocked ? (
          <Link
            href={moduleHref}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors hover:opacity-80"
            style={{
              border: "1px solid var(--border-color)",
              color: "var(--text-muted)",
              background: "transparent",
            }}
          >
            <Lock size={12} />
            Painel completo
          </Link>
        ) : (
          <button
            onClick={() => onUnlock(featureKey, title)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors hover:opacity-80"
            style={{
              border: "1px solid var(--border-color)",
              color: "var(--text-muted)",
              background: "transparent",
            }}
          >
            <Lock size={12} />
            Painel completo
          </button>
        )}
      </div>

      {/* Grid de métricas */}
      <div className="grid grid-cols-2 gap-3">
        {rows.map((row, idx) => (
          <div key={idx} className="flex flex-col gap-0.5">
            <p
              className="text-xs uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              {row.label}
            </p>
            {row.locked ? (
              <p
                className="text-sm font-medium opacity-60 flex items-center gap-1"
                style={{ color: "var(--text-muted)" }}
              >
                — bloq. <Lock size={11} />
              </p>
            ) : (
              <>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {row.value}
                </p>
                {row.subvalue && (
                  <p
                    className="text-xs"
                    style={{
                      color: row.highlight
                        ? HIGHLIGHT_COLORS[row.highlight]
                        : "var(--text-muted)",
                    }}
                  >
                    {row.subvalue}
                  </p>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Barra de progresso */}
      {progressValue !== undefined && (
        <div className="flex flex-col gap-1.5">
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: 6, background: "var(--border-color)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(progressValue, 100)}%`,
                background: accentColor,
              }}
            />
          </div>
          {progressLabel && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {progressLabel}
            </p>
          )}
        </div>
      )}

      {/* Insight */}
      {insight && (
        <div
          className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{
            background: `${accentColor}12`,
            border: `1px solid ${accentColor}30`,
          }}
        >
          <span style={{ color: accentColor }} className="mt-0.5 shrink-0">
            {accentColor === "#f59e0b" ? "⚠" : "✓"}
          </span>
          <span style={{ color: "var(--text-muted)" }}>{insight}</span>
        </div>
      )}
    </div>
  );
}
