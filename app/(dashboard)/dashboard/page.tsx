"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import { TopProgressBar } from "@/components/ui/TopProgressBar";
import { useFilter } from "@/lib/contexts/filter-context";
import type { VendasMensalData } from "@/components/charts/VendasMensalChart";
import type { FormasPagamentoData } from "@/components/charts/FormasPagamentoChart";
import type { TopProdutoData } from "@/components/charts/TopProdutosChart";
import type { TopClienteData } from "@/components/charts/TopClientesChart";
import type { VendasTipoData } from "@/components/charts/VendasTipoChart";
import type { VendedorItem } from "@/components/charts/TopVendedoresChart";
import type { GrupoItem } from "@/components/charts/TopGruposChart";

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
  const { period, customRange, setPeriod, setCustomRange } = usePeriod();
  const { selectedLojaId, lojasDisponiveis, lojasSelecionadas } = useLoja();

  const [selectedMes, setSelectedMes] = useState<string | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedOnce = useRef(false);

  const [kpis, setKpis] = useState<KpiResponse | null>(null);
  const [vendasMensal, setVendasMensal] = useState<VendasMensalData[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormasPagamentoData[]>([]);
  const [topProdutos, setTopProdutos] = useState<TopProdutoData[]>([]);
  const [topClientes, setTopClientes] = useState<TopClienteData[]>([]);
  const [topVendedores, setTopVendedores] = useState<VendedorItem[]>([]);
  const [topGrupos, setTopGrupos] = useState<GrupoItem[]>([]);
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

    setIsRefreshing(true);
    if (!hasLoadedOnce.current) {
      setKpiLoading(true);
      setChartsLoading(true);
    }

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

    const paramsObj: Record<string, string> = { lojaIds: lojaIds.join(","), period, start, end };
    if (activeFilter?.type === "vendedor") paramsObj.vendedorId = String(activeFilter.id);
    if (activeFilter?.type === "cliente")  paramsObj.clienteNome = String(activeFilter.id);
    if (activeFilter?.type === "produto")  paramsObj.produtoNome = String(activeFilter.id);
    const params = new URLSearchParams(paramsObj);

    const [kpisRes, faturamentoRes, pagamentosRes, produtosRes, clientesRes, tipoRes, vendedoresRes, gruposRes] =
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
      ]);

    setKpiLoading(false);
    setChartsLoading(false);
    setIsRefreshing(false);
    hasLoadedOnce.current = true;

    if (kpisRes.status === "fulfilled" && kpisRes.value) setKpis(kpisRes.value);
    if (faturamentoRes.status === "fulfilled") setVendasMensal(faturamentoRes.value as VendasMensalData[]);
    if (pagamentosRes.status === "fulfilled") setFormasPagamento(pagamentosRes.value as FormasPagamentoData[]);
    if (produtosRes.status === "fulfilled") setTopProdutos(produtosRes.value as TopProdutoData[]);
    if (clientesRes.status === "fulfilled") setTopClientes(clientesRes.value as TopClienteData[]);
    if (tipoRes.status === "fulfilled") setVendasTipo(tipoRes.value as VendasTipoData);
    if (vendedoresRes.status === "fulfilled") setTopVendedores(vendedoresRes.value as VendedorItem[]);
    if (gruposRes.status === "fulfilled") setTopGrupos(gruposRes.value as GrupoItem[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojaIds.join(","), period, customRange, activeFilter]);

  useEffect(() => {
    void fetchDados();
  }, [fetchDados]);

  if (lojaIds.length === 0) return <SemLoja />;

  return (
    <div className="px-3 py-3 sm:px-4 md:px-5 md:py-3 flex flex-col gap-3">
      <TopProgressBar loading={isRefreshing} />

      {/* ── Conteúdo — dimming suave durante refresh ───────────────────────── */}
      <div
        className="flex flex-col gap-3"
        style={{
          opacity: isRefreshing && hasLoadedOnce.current ? 0.55 : 1,
          transition: 'opacity 0.2s ease',
          pointerEvents: isRefreshing && hasLoadedOnce.current ? 'none' : 'auto',
        }}
      >

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

      {/* ── Linha 1: Top Clientes | Top Produtos ──────────────────────────────── */}
      <div className="grid gap-2 grid-cols-1 lg:grid-cols-2">
        <ChartCard title="Top 50 Clientes" subtitle="por faturamento — período selecionado" animationDelay={80}>
          {chartsLoading ? <ChartSkeleton height={280} /> : (
            <TopClientesChart
              data={topClientes}
              selectedNome={activeFilter?.type === "cliente" ? String(activeFilter.id) : null}
              onSelect={(nome) => nome ? setFilter({ type: "cliente", id: nome, label: nome }) : setFilter(null)}
            />
          )}
        </ChartCard>

        <ChartCard title="Top 50 Produtos/Serviços" subtitle="por faturamento — período selecionado" animationDelay={120}>
          {chartsLoading ? <ChartSkeleton height={280} /> : (
            <TopProdutosChart
              data={topProdutos}
              selectedNome={activeFilter?.type === "produto" ? String(activeFilter.id) : null}
              onSelect={(nome) => nome ? setFilter({ type: "produto", id: nome, label: nome }) : setFilter(null)}
            />
          )}
        </ChartCard>
      </div>

      {/* ── Linha 2: Top Vendedores | Vendas Mensal ──────────────────────────── */}
      <div className="grid gap-2 grid-cols-1 lg:grid-cols-2">
        <ChartCard title="Top 10 Vendedores" animationDelay={140} className="h-full">
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

        <ChartCard title="Vendas Brutas e Taxa de Devolução" subtitle="Últimos 12 meses com base no filtro selecionado" animationDelay={160} className="h-full">
          {chartsLoading ? <ChartSkeleton height={230} /> : (
            <VendasMensalChart
              data={vendasMensal}
              selectedMes={selectedMes}
              onMesClick={(mesKey) => {
                if (selectedMes === mesKey) {
                  setSelectedMes(null);
                  setPeriod("month");
                  setCustomRange(null);
                } else {
                  setSelectedMes(mesKey);
                  const [y, m] = mesKey.split("-").map(Number);
                  const start = new Date(y, m - 1, 1);
                  const end = new Date(y, m, 0);
                  setPeriod("custom");
                  setCustomRange({ start, end });
                }
              }}
            />
          )}
        </ChartCard>
      </div>

      {/* ── Linha 3: Top Fabricantes | PF vs PJ | Formas de Pagamento ─────── */}
      <div className="grid gap-2 grid-cols-1 lg:grid-cols-3">
        <ChartCard title="Top Fabricantes" subtitle="por faturamento — período selecionado" animationDelay={180}>
          {chartsLoading ? <ChartSkeleton height={280} /> : <TopGruposChart data={topGrupos} />}
        </ChartCard>

        <ChartCard title="Pessoa Física vs Jurídica" subtitle="tipo de cliente — período selecionado" animationDelay={185}>
          {chartsLoading ? <ChartSkeleton height={260} /> : <VendasTipoChart data={vendasTipo} />}
        </ChartCard>

        <ChartCard title="Formas de Pagamento" subtitle="período selecionado" animationDelay={190}>
          {chartsLoading ? <ChartSkeleton height={260} /> : <FormasPagamentoChart data={formasPagamento} />}
        </ChartCard>
      </div>

      </div>{/* fim do wrapper de dimming */}
    </div>
  );
}
