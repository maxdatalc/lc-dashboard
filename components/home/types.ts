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
      identificados: number;
      taxaRecorrencia: number;
      perfilDominante: "PJ" | "PF";
      perfilPercent: number;
      maiorCliente: { nome: string; valor: number } | null;
      maiorClienteIdentificado: { nome: string; valor: number } | null;
      consumidorFinal: { valor: number; qtd: number; clientesDistintos: number; percentFaturamento: number };
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
//
// "info" é distinto de "ok": não é um veredito positivo, é contexto neutro (ex.: vendas
// para consumidor final, meta não configurada) que não deve parecer bom nem ruim.
// Cores usam variáveis CSS (não hex fixo) para se adaptarem corretamente ao tema
// claro/escuro — cada tema já define seu próprio tom de verde/âmbar/vermelho em
// app/globals.css.
export type StatusLevel = "ok" | "warn" | "crit" | "info";

export const STATUS_TOKENS: Record<
  StatusLevel,
  { color: string; soft: string; label: string }
> = {
  ok:   { color: "var(--accent-green)",  soft: "color-mix(in srgb, var(--accent-green) 14%, transparent)",  label: "Saudável" },
  warn: { color: "var(--accent-yellow)", soft: "color-mix(in srgb, var(--accent-yellow) 14%, transparent)", label: "Atenção" },
  crit: { color: "var(--accent-red)",    soft: "color-mix(in srgb, var(--accent-red) 14%, transparent)",    label: "Crítico" },
  info: { color: "var(--accent-cyan)",   soft: "color-mix(in srgb, var(--accent-cyan) 12%, transparent)",   label: "Informativo" },
};

// "CONSUMIDOR"/"CLIENTE BALCÃO" é o cadastro genérico de venda rápida/balcão do
// MaxManager — representa uma operação comercial válida (ex.: NFC-e sem identificação
// individual do cliente), não um erro de cadastro. Cobre "CONSUMIDOR", "CONSUMIDOR
// FINAL", "CLIENTE CONSUMIDOR", "CLIENTE BALCÃO/BALCAO", "VENDA BALCÃO/BALCAO".
// Usada apenas para exibição no frontend — a detecção autoritativa (que também
// considera cliId = 1) acontece no backend, ver isGenericConsumidor em
// app/api/home/summary/route.ts.
export function isConsumidorFinal(nome: string | null | undefined): boolean {
  if (!nome) return false;
  return /consumidor|balc/i.test(nome);
}
