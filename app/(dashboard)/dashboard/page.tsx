// Página principal do dashboard — dados reais do Supabase com filtro de período
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { GraficoFaturamento } from "@/components/dashboard/grafico-faturamento";
import { GraficoTopClientes } from "@/components/dashboard/grafico-top-clientes";
import { GraficoTopProdutos } from "@/components/dashboard/grafico-top-produtos";
import { GraficoDiaSemana } from "@/components/dashboard/grafico-dia-semana";

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
      <div className="p-6">
        <div className="flex justify-between items-start gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">Visão geral do seu negócio</p>
          </div>
          <PeriodoSelector periodoAtivo={periodo} customDe={customDe} customAte={customAte} />
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-500 text-sm text-center py-8">
              Selecione uma loja na barra lateral para ver os dados
            </p>
          </CardContent>
        </Card>
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

  // Variação percentual em relação ao período anterior (null = sem dados para comparar)
  const variacao: number | null =
    faturamentoAnterior > 0
      ? ((faturamento - faturamentoAnterior) / faturamentoAnterior) * 100
      : null;

  const hojeStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="p-6">
      {/* Cabeçalho com seletor de período */}
      <div className="flex justify-between items-start gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">{label}</p>
        </div>
        <PeriodoSelector periodoAtivo={periodo} customDe={customDe} customAte={customAte} />
      </div>

      {/* Grid de KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">

        {/* Card 1 — Faturamento do período */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Faturamento — {label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold text-slate-900">
              {formatarMoeda(faturamento)}
            </p>
            {variacao === null ? (
              <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100">
                Sem dados anteriores
              </Badge>
            ) : variacao > 0 ? (
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                ▲ {variacao.toFixed(1).replace(".", ",")}%
              </Badge>
            ) : variacao < 0 ? (
              <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                ▼ {Math.abs(variacao).toFixed(1).replace(".", ",")}%
              </Badge>
            ) : (
              <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100">
                Sem variação
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Card 2 — Vendas no período */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Vendas — {label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold text-slate-900">
              {vendasPeriodo.quantidade}{" "}
              <span className="text-base font-medium text-slate-500">
                {vendasPeriodo.quantidade === 1 ? "venda" : "vendas"}
              </span>
            </p>
            <p className="text-sm text-slate-500">
              {formatarMoeda(vendasPeriodo.total)}
            </p>
          </CardContent>
        </Card>

        {/* Card 3 — Vendas hoje (fixo, não afetado pelo seletor) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Vendas Hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold text-slate-900">
              {vendasHoje.quantidade}{" "}
              <span className="text-base font-medium text-slate-500">
                {vendasHoje.quantidade === 1 ? "venda" : "vendas"}
              </span>
            </p>
            <p className="text-sm text-slate-500">{formatarMoeda(vendasHoje.total)}</p>
            <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 text-xs">
              {hojeStr}
            </Badge>
          </CardContent>
        </Card>

        {/* Card 4 — Ticket médio */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Ticket Médio — {label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold text-slate-900">
              {formatarMoeda(ticketMedio)}
            </p>
            <p className="text-sm text-slate-500">média por venda no período</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de faturamento */}
      <GraficoFaturamento
        dados={vendasAgrupadas}
        totalGeral={faturamento}
        label={label}
      />

      {/* Análise detalhada */}
      <h2 className="text-sm font-medium text-slate-500 mt-6 mb-3">
        Análise Detalhada
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <GraficoTopClientes dados={topClientes} />
        <GraficoTopProdutos dataInicio={dataInicio} dataFim={dataFim} />
      </div>

      <GraficoDiaSemana dados={diasSemana} />
    </div>
  );
}
