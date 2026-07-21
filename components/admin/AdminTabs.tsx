"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export interface AdminTabItem {
  value: string;
  label: string;
  /** Ícone já renderizado (ex.: `<Zap className="h-4 w-4" />`) — nunca o tipo do
   * componente, que não pode atravessar a fronteira Server→Client como prop. */
  icon?: ReactNode;
  count?: number;
}

/**
 * Tabs por navegação (Link), estilo Supabase: sublinhado fino, item ativo com
 * texto forte + traço na cor de destaque, sem "pill" pesada.
 *
 * `hrefFor` recebe uma função não é permitido (Server→Client boundary), por
 * isso o href é montado aqui a partir de `basePath` + `queryParam`.
 */
export function AdminTabs({
  tabs,
  active,
  basePath,
  queryParam = "aba",
}: {
  tabs: AdminTabItem[];
  active: string;
  basePath: string;
  queryParam?: string;
}) {
  return (
    <div
      role="tablist"
      className="flex gap-5 overflow-x-auto"
      style={{ borderBottom: "1px solid var(--adm-line)" }}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <Link
            key={tab.value}
            href={`${basePath}?${queryParam}=${tab.value}`}
            role="tab"
            aria-selected={isActive}
            className="adm-focusable relative flex shrink-0 items-center gap-2 pb-3 pt-1 text-sm transition-colors"
            style={{
              color: isActive ? "var(--adm-text)" : "var(--adm-text-dim)",
              fontWeight: isActive ? 600 : 500,
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none"
                style={{
                  background: isActive ? "var(--adm-accent-soft)" : "var(--adm-surface-3)",
                  color: isActive ? "var(--adm-accent)" : "var(--adm-text-faint)",
                }}
              >
                {tab.count}
              </span>
            )}
            <span
              aria-hidden
              className="absolute inset-x-0 -bottom-px h-0.5 rounded-full transition-opacity"
              style={{
                background: "var(--adm-accent)",
                opacity: isActive ? 1 : 0,
              }}
            />
          </Link>
        );
      })}
    </div>
  );
}

/** Variante para tabs client-side (onClick em vez de navegação). */
export function AdminTabsButton({
  tabs,
  active,
  onChange,
}: {
  tabs: AdminTabItem[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="tablist"
      className="flex gap-5 overflow-x-auto"
      style={{ borderBottom: "1px solid var(--adm-line)" }}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className="adm-focusable relative flex shrink-0 items-center gap-2 pb-3 pt-1 text-sm transition-colors"
            style={{
              color: isActive ? "var(--adm-text)" : "var(--adm-text-dim)",
              fontWeight: isActive ? 600 : 500,
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none"
                style={{
                  background: isActive ? "var(--adm-accent-soft)" : "var(--adm-surface-3)",
                  color: isActive ? "var(--adm-accent)" : "var(--adm-text-faint)",
                }}
              >
                {tab.count}
              </span>
            )}
            <span
              aria-hidden
              className="absolute inset-x-0 -bottom-px h-0.5 rounded-full transition-opacity"
              style={{ background: "var(--adm-accent)", opacity: isActive ? 1 : 0 }}
            />
          </button>
        );
      })}
    </div>
  );
}

export function AdminTabPanel({ children }: { children: ReactNode }) {
  return (
    <div className="adm-rise" style={{ animationDelay: "40ms" }}>
      {children}
    </div>
  );
}
