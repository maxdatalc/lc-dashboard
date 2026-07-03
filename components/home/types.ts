// Tipos compartilhados do dashboard "Visão Geral".
// Espelha a resposta de GET /api/home/summary (route.ts é a fonte da verdade).

export interface HomeSummaryResponse {
  periodo: { start: string; end: string; label: string };
  kpis: {
    faturamento: number;
    faturamentoVar: number | null;
    lucroLiquido: number;
    lucroVar: number | null;
    margemLucro: number;
    ticketMedio: number;
    ticketMedioVar: number | null;
    totalClientes: number;
    clientesNovos: number;
    clientesRecorrentes: number;
    totalVendas: number;
    totalVendasAnt: number;
    vendasVar: number | null;
  };
  emAberto: { qtd: number; valorTotal: number; qtdOs: number; qtdVendas: number };
  meta: {
    valor: number;
    percentAtingido: number | null;
    projecao: number;
    projecaoPercentMeta: number | null;
  };
  diasUteis: { trabalhados: number; restantes: number; total: number; percentual: number };
  modulos: {
    vendas: {
      faturamento: number;
      ticketMedio: number;
      melhorVendedor: { nome: string; valor: number } | null;
      metaPercent: number | null;
      insight: string | null;
    };
    financeiro: {
      lucroLiquido: number;
      margemLucro: number;
      custoReceita: number;
      custoStatus: "ok" | "alert" | "danger";
      formaPrincipalPagto: string | null;
      formaPrincipalPercent: number;
      insight: string | null;
    };
    clientes: {
      total: number;
      taxaRecorrencia: number;
      perfilDominante: "PJ" | "PF";
      perfilPercent: number;
      maiorCliente: { nome: string; valor: number } | null;
      insight: string | null;
    };
    produtos: {
      topProdutos: Array<{ nome: string; valor: number; qtde: number; percent: number }>;
      insight: string | null;
    };
  };
  rankingVendedores: Array<{ nome: string; valor: number; percent: number }>;
}

// ─── Paleta de status (usada pelo diagnóstico e por realces contextuais) ───────

export type StatusLevel = "ok" | "warn" | "crit";

export const STATUS_TOKENS: Record<
  StatusLevel,
  { color: string; soft: string; label: string }
> = {
  ok:   { color: "#10b981", soft: "rgba(16,185,129,0.12)", label: "Saudável" },
  warn: { color: "#f59e0b", soft: "rgba(245,158,11,0.12)", label: "Atenção" },
  crit: { color: "#ef4444", soft: "rgba(239,68,68,0.12)", label: "Crítico" },
};

// "CONSUMIDOR" é o cliente padrão de balcão do MaxManager — não é um cliente real.
export function isClienteNaoIdentificado(nome: string | null | undefined): boolean {
  if (!nome) return false;
  return /consumidor|não\s*identificad|nao\s*identificad|consumidor\s*final/i.test(nome);
}
