// Página principal do dashboard — dados reais do Supabase com filtro de período
import { Card, CardContent } from "@/components/ui/card";
import { getSelectedLojaId } from "@/app/actions/lojas";
import {
  getPeriodoDates,
  getPeriodoAnteriorDates,
  getFaturamento,
  getVendasHoje,
  getVendasPeriodo,
  getTicketMedio,
  getVendasAgrupadas,
  getTopClientes,
  getVendasPorDiaSemana,
} from "@/lib/db/dashboard";
import { PeriodoSelector } from "@/components/dashboard/periodo-selector";
import { SyncButton } from "@/components/dashboard/sync-button";
import { GraficoFaturamento } from "@/components/dashboard/grafico-faturamento";
import { GraficoTopClientes } from "@/components/dashboard/grafico-top-clientes";
import { GraficoTopProdutos } from "@/components/dashboard/grafico-top-produtos";
import { GraficoDiaSemana } from "@/components/dashboard/grafico-dia-semana";
import { KpiSecao } from "@/components/dashboard/kpi-secao";

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string }>;
}) {
  const params = await searchParams;
  const periodo = params.periodo ?? "mes";
  const customDe = params.de;
  const customAte = params.ate;

  const lojaId = await getSelectedLojaId();

  // Sem loja selecionada — orientar o usuário
  if (!lojaId) {
    return (
      <div>
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md
          border-b border-border px-6 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-foreground">Dashboard</h1>
            <p className="text-[11px] text-muted-foreground">Visão geral do período</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SyncButton key="sem-loja" />
            <PeriodoSelector periodoAtivo={periodo} customDe={customDe} customAte={customAte} />
          </div>
        </div>
        <div className="p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm text-center py-8">
                Selecione uma loja na barra lateral para ver os dados
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Calcular intervalos de data
  const { dataInicio, dataFim, label } = getPeriodoDates(periodo, customDe, customAte);
  const periodoAnterior = getPeriodoAnteriorDates(periodo, customDe, customAte);

  // Buscar todos os KPIs em paralelo
  const [
    faturamento,
    faturamentoAnterior,
    vendasHoje,
    ticketMedio,
    vendasAgrupadas,
    vendasPeriodo,
    topClientes,
    diasSemana,
  ] = await Promise.all([
    getFaturamento(lojaId, dataInicio, dataFim),
    getFaturamento(lojaId, periodoAnterior.dataInicio, periodoAnterior.dataFim),
    getVendasHoje(lojaId),
    getTicketMedio(lojaId, dataInicio, dataFim),
    getVendasAgrupadas(lojaId, dataInicio, dataFim, periodo),
    getVendasPeriodo(lojaId, dataInicio, dataFim),
    getTopClientes(lojaId, dataInicio, dataFim),
    getVendasPorDiaSemana(lojaId, dataInicio, dataFim),
  ]);

  // Variação percentual em relação ao período anterior
  const variacao: number | null =
    faturamentoAnterior > 0
      ? ((faturamento - faturamentoAnterior) / faturamentoAnterior) * 100
      : null;

  // Variáveis formatadas para os KPI cards
  const fmtFaturamento = formatarMoeda(faturamento);
  const fmtFaturamentoAnterior = formatarMoeda(faturamentoAnterior);
  const variacaoFaturamento =
    variacao === null ? "Sem dados anteriores"
    : variacao > 0   ? `▲ ${variacao.toFixed(1).replace(".", ",")}%`
    : variacao < 0   ? `▼ ${Math.abs(variacao).toFixed(1).replace(".", ",")}%`
    : "Sem variação";
  const trendFaturamento: "up" | "down" | "neutral" =
    variacao === null || variacao === 0 ? "neutral" : variacao > 0 ? "up" : "down";

  const fmtTicketMedio = formatarMoeda(ticketMedio);

  // vendasHoje preservado para drill-down
  const fmtVendasHoje = `${vendasHoje.quantidade} ${vendasHoje.quantidade === 1 ? "venda" : "vendas"}`;

  return (
    <div>
      {/* Cabeçalho sticky com backdrop blur */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md
        border-b border-border px-6 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-foreground">Dashboard</h1>
          <p className="text-[11px] text-muted-foreground">
            Visão geral do período
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SyncButton key={lojaId} />
          <PeriodoSelector periodoAtivo={periodo} customDe={customDe} customAte={customAte} />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI cards com drill-down */}
        <KpiSecao
          cards={[
            {
              id: "faturamento",
              label: "Faturamento",
              value: fmtFaturamento,
              trend: variacaoFaturamento,
              trendType: trendFaturamento,
              accent: "blue",
              detalhe: {
                titulo: "Faturamento do período",
                descricao: "Total de vendas finalizadas no período selecionado",
                linhas: [
                  { label: "Período selecionado", valor: fmtFaturamento,         destaque: true },
                  { label: "Período anterior",    valor: fmtFaturamentoAnterior },
                  { label: "Variação",            valor: variacaoFaturamento },
                ],
              },
            },
            {
              id: "vendas",
              label: "Vendas realizadas",
              value: String(vendasPeriodo.quantidade),
              trend: formatarMoeda(vendasPeriodo.total),
              trendType: "neutral",
              accent: "green",
              detalhe: {
                titulo: "Vendas do período",
                descricao: "Quantidade de vendas finalizadas no período",
                linhas: [
                  { label: "Vendas no período", valor: String(vendasPeriodo.quantidade), destaque: true },
                  { label: "Total faturado",    valor: formatarMoeda(vendasPeriodo.total) },
                  { label: "Vendas hoje",       valor: fmtVendasHoje },
                ],
              },
            },
            {
              id: "ticket",
              label: "Ticket médio",
              value: fmtTicketMedio,
              trend: `por venda no ${label.toLowerCase()}`,
              trendType: "neutral",
              accent: "indigo",
              detalhe: {
                titulo: "Ticket médio do período",
                descricao: "Valor médio por venda no período selecionado",
                linhas: [
                  { label: "Ticket médio",     valor: fmtTicketMedio,          destaque: true },
                  { label: "Período anterior", valor: fmtFaturamentoAnterior },
                  { label: "Vendas no período", valor: String(vendasPeriodo.quantidade) },
                ],
              },
            },
            {
              id: "avencer",
              label: "A vencer (30d)",
              value: "—",
              trendType: "neutral",
              accent: "amber",
              detalhe: {
                titulo: "Contas a vencer",
                descricao: "Títulos com vencimento nos próximos 30 dias",
                linhas: [
                  { label: "Ver módulo Financeiro", valor: "→", destaque: true },
                ],
              },
            },
            {
              id: "inadimplencia",
              label: "Inadimplência",
              value: "—",
              trendType: "down",
              accent: "red",
              detalhe: {
                titulo: "Inadimplência",
                descricao: "Títulos vencidos e não pagos",
                linhas: [
                  { label: "Ver módulo Financeiro", valor: "→", destaque: true },
                ],
              },
            },
          ]}
        />

        {/* Gráfico de faturamento */}
        <GraficoFaturamento
          dados={vendasAgrupadas}
          totalGeral={faturamento}
          label={label}
        />

        {/* Análise detalhada */}
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Análise Detalhada
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GraficoTopClientes dados={topClientes} />
          <GraficoTopProdutos dataInicio={dataInicio} dataFim={dataFim} />
        </div>

        <GraficoDiaSemana dados={diasSemana} />
      </div>
    </div>
  );
}
