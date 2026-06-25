"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type Period = "today" | "7d" | "month" | "3m" | "year" | "prev-year" | "custom";

interface PeriodContextValue {
  period: Period;
  setPeriod: (period: Period) => void;
  customRange: { start: Date; end: Date } | null;
  setCustomRange: (range: { start: Date; end: Date } | null) => void;
  getDateRange: () => { start: string; end: string };
}

const PeriodContext = createContext<PeriodContextValue | null>(null);

// Formata usando timezone local do browser (evita bug UTC para BR UTC-3/UTC-4)
function toStr(d: Date): string {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${dy}`;
}

export function computeRange(period: Exclude<Period, "custom">): { start: string; end: string } {
  const hoje = new Date();
  const y    = hoje.getFullYear();
  const m    = hoje.getMonth();
  const d    = hoje.getDate();
  const hojeStr = toStr(hoje);

  switch (period) {
    case "today":
      return { start: hojeStr, end: hojeStr };
    case "7d":
      // últimos 7 dias inclusive hoje
      return { start: toStr(new Date(y, m, d - 6)), end: hojeStr };
    case "month":
      return { start: `${y}-${String(m + 1).padStart(2, "0")}-01`, end: hojeStr };
    case "3m":
      return { start: toStr(new Date(y, m - 3, 1)), end: hojeStr };
    case "year":
      return { start: `${y}-01-01`, end: hojeStr };
    case "prev-year":
      return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` };
  }
}

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Period>("month");
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | null>(null);

  function getDateRange(): { start: string; end: string } {
    if (period === "custom" && customRange) {
      return { start: toStr(customRange.start), end: toStr(customRange.end) };
    }
    if (period === "custom") {
      // Fallback para mês atual se 'custom' ainda sem intervalo definido
      return computeRange("month");
    }
    return computeRange(period);
  }

  return (
    <PeriodContext.Provider value={{ period, setPeriod, customRange, setCustomRange, getDateRange }}>
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriod() {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriod deve ser usado dentro de PeriodProvider");
  return ctx;
}
