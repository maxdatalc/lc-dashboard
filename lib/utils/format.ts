export function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000)
      .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
  }
  if (value >= 1_000) {
    return `R$ ${(value / 1_000)
      .toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
  }
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

export function formatChange(value: number): string {
  const abs = Math.abs(value).toFixed(1).replace(".", ",");
  return value >= 0 ? `+${abs}%` : `-${abs}%`;
}

export function getDateRange(period: string): { start: string; end: string } {
  const hoje = new Date();
  const toStr = (d: Date) => d.toISOString().split("T")[0];
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  const hojeStr = toStr(hoje);

  switch (period) {
    case "today":
      return { start: hojeStr, end: hojeStr };
    case "7d":
      return { start: toStr(new Date(hoje.getTime() - 6 * 86400000)), end: hojeStr };
    case "month":
      return { start: `${y}-${String(m + 1).padStart(2, "0")}-01`, end: hojeStr };
    case "3m":
      return { start: toStr(new Date(y, m - 3, 1)), end: hojeStr };
    case "year":
      return { start: `${y}-01-01`, end: hojeStr };
    case "prev-year":
      return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` };
    default:
      return { start: `${y}-${String(m + 1).padStart(2, "0")}-01`, end: hojeStr };
  }
}
