// Formatar moeda em real brasileiro — SEMPRE valor completo, sem abreviação
// Ex: 12100.50 → "R$ 12.100,50"
// Ex: 535.6 → "R$ 535,60"
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Formatar número inteiro com separador de milhar
// Ex: 3847 → "3.847"
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value)
}

export function formatChange(value: number): string {
  const abs = Math.abs(value).toFixed(1).replace(".", ",");
  return value >= 0 ? `+${abs}%` : `-${abs}%`;
}

// "Hoje" ancorado no fuso de Brasília (YYYY-MM-DD), independente do fuso do servidor.
// A Vercel roda em UTC por padrão (sem TZ configurada) — usar `new Date().getFullYear()`/
// `toISOString()` direto faz "hoje" virar o dia seguinte assim que bate 21h em Brasília
// (UTC-3), porque em UTC já é meia-noite do dia seguinte. Isso adiantava em 1 dia os
// filtros rápidos (Hoje, Este mês, Últimos 7 dias, 3 meses, Este ano) durante ~3h todo dia.
function hojeBrasilStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function getDateRange(period: string): { start: string; end: string } {
  const toStr = (d: Date) => d.toISOString().split("T")[0];
  const hojeStr = hojeBrasilStr();
  const [y, mo] = hojeStr.split("-").map(Number);
  const m = mo - 1; // 0-indexado, para uso em Date.UTC
  // Meio-dia UTC do "hoje" de Brasília — base segura para aritmética de dias (evita
  // qualquer novo rollover ao somar/subtrair milissegundos a partir daqui).
  const hoje = new Date(`${hojeStr}T12:00:00Z`);

  switch (period) {
    case "today":
      return { start: hojeStr, end: hojeStr };
    case "7d":
      return { start: toStr(new Date(hoje.getTime() - 6 * 86400000)), end: hojeStr };
    case "month":
      return { start: `${y}-${String(m + 1).padStart(2, "0")}-01`, end: hojeStr };
    case "3m":
      return { start: toStr(new Date(Date.UTC(y, m - 3, 1, 12))), end: hojeStr };
    case "year":
      return { start: `${y}-01-01`, end: hojeStr };
    case "prev-year":
      return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` };
    default:
      return { start: `${y}-${String(m + 1).padStart(2, "0")}-01`, end: hojeStr };
  }
}
