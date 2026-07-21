/**
 * Alturas padrão para todo ResponsiveContainer do Recharts.
 * Nunca usar número fixo em px direto no gráfico — em telas pequenas isso vira
 * scroll infinito de caixas altas empilhadas. O clamp mantém a proporção
 * relativa ao viewport com piso/teto legíveis.
 */
export const CHART_HEIGHT = {
  /** Sparkline / mini-gráfico dentro de card compacto. */
  compact: "clamp(160px, 38vh, 220px)",
  /** Gráfico principal de uma seção. */
  default: "clamp(200px, 45vh, 280px)",
  /** Gráfico único de destaque na página. */
  featured: "clamp(240px, 55vh, 340px)",
} as const;

export type ChartHeightRole = keyof typeof CHART_HEIGHT;
