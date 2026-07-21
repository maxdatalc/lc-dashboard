"use client";

import type { CSSProperties, ReactNode } from "react";

type Breakpoint = "sm" | "md" | "lg";

export interface RowListColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Coluna some abaixo deste breakpoint (ausente = sempre visível). */
  minBreakpoint?: Breakpoint;
  /** Track do grid-template-columns (ex.: "1fr", "100px", "minmax(0,1fr)"). */
  width: string;
  align?: "left" | "right" | "center";
}

export interface ResponsiveRowListProps<T> {
  columns: RowListColumn<T>[];
  rows: T[];
  keyField: keyof T;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  /** Sem cabeçalho (ex.: listas tipo feed onde o conteúdo se explica). */
  hideHeader?: boolean;
}

const HIDDEN_CLASS: Record<Breakpoint, string> = {
  sm: "hidden sm:block",
  md: "hidden md:block",
  lg: "hidden lg:block",
};

const ALIGN_CLASS = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

/** Tracks visíveis num dado tier (base = mobile, depois sm/md/lg). */
function tracksFor<T>(columns: RowListColumn<T>[], tier: Breakpoint | "base"): string {
  const order: Record<Breakpoint, number> = { sm: 1, md: 2, lg: 3 };
  const tierLevel = tier === "base" ? 0 : order[tier];
  return columns
    .filter((c) => !c.minBreakpoint || order[c.minBreakpoint] <= tierLevel)
    .map((c) => c.width)
    .join(" ");
}

/**
 * Substituto responsivo de <table>: cada linha é um grid CSS cujas colunas
 * menos críticas somem por breakpoint (padrão generalizado do TabelaVendas).
 * Em 375px mostre no máximo 3-4 colunas; o resto entra via minBreakpoint.
 */
export function ResponsiveRowList<T>({
  columns,
  rows,
  keyField,
  onRowClick,
  emptyMessage = "Nenhum registro no período.",
  hideHeader = false,
}: ResponsiveRowListProps<T>) {
  const gridVars = {
    "--rrl-cols-base": tracksFor(columns, "base"),
    "--rrl-cols-sm": tracksFor(columns, "sm"),
    "--rrl-cols-md": tracksFor(columns, "md"),
    "--rrl-cols-lg": tracksFor(columns, "lg"),
  } as CSSProperties;

  if (rows.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div style={gridVars}>
      {!hideHeader && (
        <div
          className="rrl-grid items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          {columns.map((col) => (
            <span
              key={col.key}
              className={`${col.minBreakpoint ? HIDDEN_CLASS[col.minBreakpoint] : ""} ${ALIGN_CLASS[col.align ?? "left"]} min-w-0 truncate`}
            >
              {col.header}
            </span>
          ))}
        </div>
      )}

      <div>
        {rows.map((row) => {
          const RowTag = onRowClick ? "button" : "div";
          return (
            <RowTag
              key={String(row[keyField])}
              type={onRowClick ? "button" : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`rrl-grid w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] ${
                onRowClick ? "cursor-pointer transition-colors hover:bg-[var(--bg-card-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""
              }`}
              style={{
                color: "var(--text-primary)",
                borderTop: "1px solid var(--border-subtle)",
              }}
            >
              {columns.map((col) => (
                <span
                  key={col.key}
                  className={`${col.minBreakpoint ? HIDDEN_CLASS[col.minBreakpoint] : ""} ${ALIGN_CLASS[col.align ?? "left"]} min-w-0 truncate`}
                >
                  {col.render(row)}
                </span>
              ))}
            </RowTag>
          );
        })}
      </div>
    </div>
  );
}
