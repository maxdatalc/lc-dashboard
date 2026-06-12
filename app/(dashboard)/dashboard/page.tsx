"use client";

import { useEffect, useState, useCallback } from "react";
import { usePeriod, computeRange } from "@/lib/contexts/period-context";
import { useLoja } from "@/lib/contexts/loja-context";
import { KpiBar } from "@/components/ui/KpiBar";
import { ChartCard } from "@/components/ui/ChartCard";
import { VendasMensalChart } from "@/components/charts/VendasMensalChart";
import { FormasPagamentoChart } from "@/components/charts/FormasPagamentoChart";
import { TopProdutosChart } from "@/components/charts/TopProdutosChart";
import { TopClientesChart } from "@/components/charts/TopClientesChart";
import { VendasTipoChart } from "@/components/charts/VendasTipoChart";
import { TopVendedoresChart } from "@/components/charts/TopVendedoresChart";
import { TopGruposChart } from "@/components/charts/TopGruposChart";
import { ClientesRetencaoChart } from "@/components/charts/ClientesRetencaoChart";
import { ActiveFilterBar } from "@/components/ui/ActiveFilterBar";
import { useFilter } from "@/lib/contexts/filter-context";
import type { VendasMensalData } from "@/components/charts/VendasMensalChart";
import type { FormasPagamentoData } from "@/components/charts/FormasPagamentoChart";
import type { TopProdutoData } from "@/components/charts/TopProdutosChart";
import type { TopClienteData } from "@/components/charts/TopClientesChart";
import type { VendasTipoData } from "@/components/charts/VendasTipoChart";
import type { VendedorItem } from "@/components/charts/TopVendedoresChart";
import type { GrupoItem } from "@/components/charts/TopGruposChart";
import type { ClientesRetencaoData } from "@/components/charts/ClientesRetencaoChart";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface KpiResponse {
  faturamento: {
    value: number;
    change: number | null;
    vendaTotal: number;
    devolucaoTotal: number;
    totalVendas: number;
    totalDevolucoes: number;
  };
  custo: { value: number };
  lucro: { value: number; margem: number };
  clientes: { value: number };
  vendas: { value: number; change: number | null };
  ticketMedio: { value: number; change: number | null };
  outros: { value: number; valorTotal: number };
  totalVendas: number;
  totalDevolucoes: number;
  totalCancelamentos: number;
  valorDevolvido: number;
}

// ─── Skeleton de gráfico ──────────────────────────────────────────────────────

function ChartSkeleton({ height = 220 }: { height?: number }) {
  return <div className="shimmer rounded-lg w-full" style={{ height }} />;
}

// ─── Sem loja ─────────────────────────────────────────────────────────────────

function SemLoja() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div
        className="rounded-2xl p-10 text-center max-w-sm"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Selecione uma loja na barra lateral para visualizar os dados.
        </p>
      </div>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { period, customRange } = usePeriod();
  const { selectedLojaId, lojasDisponiveis, lojasSelecionadas } = useLoja();

  const [kpiLoading, setKpiLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);

  const [kpis, setKpis] = useState<KpiResponse | null>(null);
  const [vendasMensal, setVendasMensal] = useState<VendasMensalData[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormasPagamentoData[]>([]);
  const [topProdutos, setTopProdutos] = useState<TopProdutoData[]>([]);
  const [topClientes, setTopClientes] = useState<TopClienteData[]>([]);
  const [topVendedores, setTopVendedores] = useState<VendedorItem[]>([]);
  const [topGrupos, setTopGrupos] = useState<GrupoItem[]>([]);
  const [retencao, setRetencao] = useState<ClientesRetencaoData>({
    novos: 0, recorrentes: 0, faturamentoNovos: 0, faturamentoRecorrentes: 0,
  });
  const [vendasTipo, setVendasTipo] = useState<VendasTipoData>({
    pf: { total: 0, clientes: 0 },
    pj: { total: 0, clientes: 0 },
  });

  const { activeFilter, setFilter } = useFilter();

  // lojaIds: usa multi-select se houver seleção explícita; senão, todas as lojas disponíveis
  const lojaIds =
    lojasSelecionadas.length > 0
      ? lojasSelecionadas
      : lojasDisponiveis.length > 0
      ? lojasDisponiveis.map((l) => l.id)
      : selectedLojaId
      ? [selectedLojaId]
      : [];

  const fetchDados = useCallback(async () => {
    if (lojaIds.length === 0) return;

    setKpiLoading(true);
    setChartsLoading(true);

    let start: string, end: string;
    if (period === "custom" && customRange) {
      start = customRange.start.toISOString().split("T")[0];
      end = customRange.end.toISOString().split("T")[0];
    } else if (period === "custom") {
      setKpiLoading(false);
      setChartsLoading(false);
      return;
    } else {
      const range = computeRange(period);
      start = range.start;
      end = range.end;
    }

    // Incluir vendedorId nos params quando filtro de vendedor estiver ativo
    const paramsObj: Record<string, string> = { lojaIds: lojaIds.join(","), period, start, end };
    if (activeFilter?.type === "vendedor") {
      paramsObj.vendedorId = String(activeFilter.id);
    }
    const params = new URLSearchParams(paramsObj);

    const [kpisRes, faturamentoRes, pagamentosRes, produtosRes, clientesRes, tipoRes, vendedoresRes, gruposRes, retencaoRes] =
      await Promise.allSettled([
        fetch(`/api/dashboard/kpis?${params}`).then((r) =>
          r.ok ? (r.json() as Promise<KpiResponse>) : null
        ),
        fetch(`/api/dashboard/charts?${params}&type=faturamento-mensal`).then((r) =>
          r.ok ? (r.json() as Promise<VendasMensalData[]>) : []
        ),
        fetch(`/api/dashboard/charts?${params}&type=formas-pagamento`).then((r) =>
          r.ok ? (r.json() as Promise<FormasPagamentoData[]>) : []
        ),
        fetch(`/api/dashboard/charts?${params}&type=top-produtos`).then((r) =>
          r.ok ? (r.json() as Promise<TopProdutoData[]>) : []
        ),
        fetch(`/api/dashboard/charts?${params}&type=top-clientes`).then((r) =>
          r.ok ? (r.json() as Promise<TopClienteData[]>) : []
        ),
        fetch(`/api/dashboard/charts?${params}&type=vendas-tipo-cliente`).then((r) =>
          r.ok ? (r.json() as Promise<VendasTipoData>) : { pf: { total: 0, clientes: 0 }, pj: { total: 0, clientes: 0 } }
        ),
        fetch(`/api/dashboard/charts?${params}&type=top-vendedores`).then((r) =>
          r.ok ? (r.json() as Promise<VendedorItem[]>) : []
        ),
        fetch(`/api/dashboard/charts?${params}&type=top-fabricantes`).then((r) =>
          r.ok ? (r.json() as Promise<GrupoItem[]>) : []
        ),
        fetch(`/api/dashboard/charts?${params}&type=clientes-retencao`).then((r) =>
          r.ok ? (r.json() as Promise<ClientesRetencaoData>) : { novos: 0, recorrentes: 0, faturamentoNovos: 0, faturamentoRecorrentes: 0 }
        ),
      ]);

    setKpiLoading(false);
    setChartsLoading(false);

    if (kpisRes.status === "fulfilled" && kpisRes.value) setKpis(kpisRes.value);
    if (faturamentoRes.status === "fulfilled") setVendasMensal(faturamentoRes.value as VendasMensalData[]);
    if (pagamentosRes.status === "fulfilled") setFormasPagamento(pagamentosRes.value as FormasPagamentoData[]);
    if (produtosRes.status === "fulfilled") setTopProdutos(produtosRes.value as TopProdutoData[]);
    if (clientesRes.status === "fulfilled") setTopClientes(clientesRes.value as TopClienteData[]);
    if (tipoRes.status === "fulfilled") setVendasTipo(tipoRes.value as VendasTipoData);
    if (vendedoresRes.status === "fulfilled") setTopVendedores(vendedoresRes.value as VendedorItem[]);
    if (gruposRes.status === "fulfilled") setTopGrupos(gruposRes.value as GrupoItem[]);
    if (retencaoRes.status === "fulfilled") setRetencao(retencaoRes.value as ClientesRetencaoData);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojaIds.join(","), period, customRange, activeFilter]);

  useEffect(() => {
    void fetchDados();
  }, [fetchDados]);

  if (lojaIds.length === 0) return <SemLoja />;

  return (
    <div className="px-3 py-4 sm:px-4 md:p-6 flex flex-col gap-5">
      {/* ── Filtro ativo — aparece quando um vendedor/produto está selecionado ── */}
      <ActiveFilterBar />

      {/* ── KPIs — barra horizontal unificada ──────────────────────────────── */}
      <KpiBar
        faturamento={kpis?.faturamento?.value ?? 0}
        totalVendas={kpis?.faturamento?.totalVendas ?? 0}
        devolucaoTotal={kpis?.valorDevolvido ?? 0}
        totalDevolucoes={kpis?.totalDevolucoes ?? 0}
        custo={kpis?.custo?.value ?? 0}
        ticketMedio={kpis?.ticketMedio?.value ?? 0}
        lucro={kpis?.lucro?.value ?? 0}
        margem={kpis?.lucro?.margem ?? 0}
        totalClientes={kpis?.clientes?.value ?? 0}
        isLoading={kpiLoading}
      />

      {/* ── Linha 1: Top Produtos | Formas de Pagamento ──────────────────────── */}
      <div className="grid gap-3 grid-cols-1 lg:grid-cols-2 items-start">
        <ChartCard title="Top 50 Produtos" subtitle="por faturamento — período selecionado" animationDelay={80} className="min-h-[360px]">
          {chartsLoading ? <ChartSkeleton height={280} /> : <TopProdutosChart data={topProdutos} />}
        </ChartCard>

        <ChartCard title="Formas de Pagamento" subtitle="período selecionado" animationDelay={120}>
          {chartsLoading ? <ChartSkeleton /> : <FormasPagamentoChart data={formasPagamento} />}
        </ChartCard>
      </div>

      {/* ── Linha 1.5: Top Fabricantes | PF vs PJ | Novos vs Recorrentes ─────── */}
      <div className="grid gap-3 grid-cols-1 lg:grid-cols-3">
        <ChartCard title="Top Fabricantes" subtitle="por faturamento — período selecionado" animationDelay={140} className="min-h-[360px]">
          {chartsLoading ? <ChartSkeleton height={280} /> : <TopGruposChart data={topGrupos} />}
        </ChartCard>

        <ChartCard title="Pessoa Física vs Jurídica" subtitle="tipo de cliente — período selecionado" animationDelay={145}>
          {chartsLoading ? <ChartSkeleton height={260} /> : <VendasTipoChart data={vendasTipo} />}
        </ChartCard>

        <ChartCard title="Novos vs Recorrentes" subtitle="retenção de clientes — período selecionado" animationDelay={150}>
          {chartsLoading ? <ChartSkeleton height={260} /> : <ClientesRetencaoChart data={retencao} />}
        </ChartCard>
      </div>

      {/* ── Linha 2: Top Clientes (40%) | Vendas Mensal (60%) ───────────────── */}
      <div className="grid gap-3 grid-cols-1 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ChartCard title="Top 50 Clientes" subtitle="por faturamento — período selecionado" animationDelay={160} className="min-h-[360px] h-full">
            {chartsLoading ? <ChartSkeleton height={280} /> : <TopClientesChart data={topClientes} />}
          </ChartCard>
        </div>
        <div className="lg:col-span-3">
          <ChartCard title="Vendas | Devolução por Mês/Ano" subtitle="últimos 12 meses a partir do período selecionado" animationDelay={180} className="h-full">
            {chartsLoading ? <ChartSkeleton height={200} /> : <VendasMensalChart data={vendasMensal} />}
          </ChartCard>
        </div>
      </div>

      {/* ── Linha 3: Top Vendedores ──────────────────────────────────────────── */}
      <ChartCard title="Top 10 Vendedores" animationDelay={220} className="min-h-[360px]">
        {chartsLoading ? <ChartSkeleton height={280} /> : (
          <TopVendedoresChart
            data={topVendedores}
            selectedId={activeFilter?.type === "vendedor" ? activeFilter.id as number : null}
            onSelect={(id, nome) => {
              if (id === null) {
                setFilter(null);
              } else {
                setFilter({ type: "vendedor", id, label: nome ?? "" });
              }
            }}
          />
        )}
      </ChartCard>

    </div>
  );
}
