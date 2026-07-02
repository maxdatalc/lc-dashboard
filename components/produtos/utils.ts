// Utilitários compartilhados do Dashboard de Produtos & Estoque

import type { StatusEstoque } from "@/lib/db/produtos-estoque";

// ── Formatadores (pt-BR — números NÃO abreviados, conforme especificação) ──────

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export const fmtMoeda = (v: number): string => moeda.format(Number.isFinite(v) ? v : 0);

export const fmtInt = (v: number): string => inteiro.format(Math.round(Number.isFinite(v) ? v : 0));

export function fmtNum(v: number, dec = 0): string {
  if (!Number.isFinite(v)) return "0";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(v);
}

export function fmtPct(v: number, dec = 1): string {
  if (!Number.isFinite(v)) return "0%";
  return `${v.toFixed(dec).replace(".", ",")}%`;
}

// ── Metadados de status (rótulo + cor semântica) ───────────────────────────────

export interface StatusMeta {
  label: string;
  color: string;
  bg: string;
}

export const STATUS_META: Record<StatusEstoque, StatusMeta> = {
  abaixo:    { label: "Abaixo do mínimo",     color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  acima:     { label: "Acima do mínimo",      color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  semMin:    { label: "Mínimo não informado", color: "#64748b", bg: "rgba(100,116,139,0.16)" },
  negativo:  { label: "Estoque negativo",     color: "#f43f5e", bg: "rgba(244,63,94,0.14)" },
  margemNeg: { label: "Margem negativa",      color: "#dc2626", bg: "rgba(220,38,38,0.14)" },
  regular:   { label: "Regular",              color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
};

// Cores base do dashboard
export const COR_CUSTO = "#f59e0b";  // âmbar — capital investido / custo
export const COR_VENDA = "#22d3ee";  // ciano — potencial de venda
export const COR_MARGEM = "#22c55e"; // verde — margem positiva
