"use client";

import { useEffect, useState, useCallback } from "react";
import { DollarSign, ShoppingCart, TrendingUp, RotateCcw, XCircle, Package } from "lucide-react";
import { usePeriod, computeRange } from "@/lib/contexts/period-context";
import { useLoja } from "@/lib/contexts/loja-context";
import { KpiCard } from "@/components/ui/KpiCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { FaturamentoMensalChart } from "@/components/charts/FaturamentoMensalChart";
import { FormasPagamentoChart } from "@/components/charts/FormasPagamentoChart";
import { TopProdutosChart } from "@/components/charts/TopProdutosChart";
import { TopClientesChart } from "@/components/charts/TopClientesChart";
import { VendasTipoChart } from "@/components/charts/VendasTipoChart";
import { TabelaVendas } from "@/components/dashboard/TabelaVendas";
import { formatCurrency, formatNumber } from "@/lib/utils/format";
import type { FaturamentoMensalData } from "@/components/charts/FaturamentoMensalChart";
import type { FormasPagamentoData } from "@/components/charts/FormasPagamentoChart";
import type { TopProdutoData } from "@/components/charts/TopProdutosChart";
import type { TopClienteData } from "@/components/charts/TopClientesChart";
import type { VendasTipoData } from "@/components/charts/VendasTipoChart";

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
  vendas: { value: number; change: number | null };
  ticketMedio: { value: number; change: number | null };
  outros: { value: number; valorTotal: number };
  totalVendas: number;
  totalDevolucoes: number;
  totalCancelamentos: number;
  valorDevolvido: number;
}

// ─── Card de Faturamento composto ─────────────────────────────────────────────

function FaturamentoKpiCard({
  vendaTotal,
  totalVendas,
  devolucaoTotal,
  totalDevolucoes,
  faturamentoLiquido,
  change,
  isLoading,
}: {
  vendaTotal: number;
  totalVendas: number;
  devolucaoTotal: number;
  totalDevolucoes: number;
  faturamentoLiquido: number;
  change?: number | null;
  isLoading?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2 transition-all duration-200"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderTop: "3px solid var(--accent-cyan)",
        animation: "fadeInUp 0.4s ease-out both",
        animationDelay: "0ms",
      }}
    >
      {/* Ícone + título + delta */}
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center flex-shrink-0 rounded-[8px]"
          style={{ width: 32, height: 32, backgroundColor: "rgba(0,229,255,0.12)", color: "#00e5ff" }}
        >
          <DollarSign style={{ width: 16, height: 16 }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold uppercase tracking-widest" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              Faturamento
            </p>
            {change != null && !isLoading && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                style={{
                  backgroundColor: change >= 0 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                  color: change >= 0 ? "#10b981" : "#ef4444",
                }}
              >
                {change >= 0 ? "+" : ""}
                {change.toFixed(1).replace(".", ",")}%
              </span>
            )}
          </div>
          {isLoading ? (
            <div className="shimmer rounded mt-2" style={{ height: 28, width: 120 }} />
          ) : (
            <p
              className="tabular-nums mt-1 leading-none"
              style={{
                fontFamily: "var(--font-display, 'DM Serif Display', serif)",
                fontSize: "clamp(16px, 2.5vw, 24px)",
                fontWeight: 400,
                color: "var(--text-primary)",
              }}
            >
              {formatCurrency(faturamentoLiquido)}
            </p>
          )}
        </div>
      </div>

      {/* Vendas vs Devoluções */}
      <div style={{ height: 1, backgroundColor: "var(--border-subtle)" }} />
      {isLoading ? (
        <div className="shimmer rounded" style={{ height: 12, width: 100 }} />
      ) : (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span style={{ color: "var(--text-muted)" }}>{formatNumber(totalVendas)} vendas</span>
          <span>
            <span style={{ color: "var(--accent-red)" }}>−{formatCurrency(devolucaoTotal)}</span>
            <span className="ml-1" style={{ color: "var(--text-muted)" }}>
              ({formatNumber(totalDevolucoes)} dev)
            </span>
          </span>
        </div>
      )}
    </div>
  );
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

const DELAY = [0, 60, 120, 180, 240];

export default function DashboardPage() {
  const { period, customRange } = usePeriod();
  const { selectedLojaId, lojasDisponiveis, lojasSelecionadas } = useLoja();

  const [kpiLoading, setKpiLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);

  const [kpis, setKpis] = useState<KpiResponse | null>(null);
  const [faturamentoMensal, setFaturamentoMensal] = useState<FaturamentoMensalData[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormasPagamentoData[]>([]);
  const [topProdutos, setTopProdutos] = useState<TopProdutoData[]>([]);
  const [topClientes, setTopClientes] = useState<TopClienteData[]>([]);
  const [vendasTipo, setVendasTipo] = useState<VendasTipoData>({
    pf: { total: 0, clientes: 0 },
    pj: { total: 0, clientes: 0 },
  });

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

    const params = new URLSearchParams({ lojaIds: lojaIds.join(","), period, start, end });

    const [kpisRes, faturamentoRes, pagamentosRes, produtosRes, clientesRes, tipoRes] =
      await Promise.allSettled([
        fetch(`/api/dashboard/kpis?${params}`).then((r) =>
          r.ok ? (r.json() as Promise<KpiResponse>) : null
        ),
        fetch(`/api/dashboard/charts?${params}&type=faturamento-mensal`).then((r) =>
          r.ok ? (r.json() as Promise<FaturamentoMensalData[]>) : []
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
      ]);

    setKpiLoading(false);
    setChartsLoading(false);

    if (kpisRes.status === "fulfilled" && kpisRes.value) setKpis(kpisRes.value);
    if (faturamentoRes.status === "fulfilled") setFaturamentoMensal(faturamentoRes.value as FaturamentoMensalData[]);
    if (pagamentosRes.status === "fulfilled") setFormasPagamento(pagamentosRes.value as FormasPagamentoData[]);
    if (produtosRes.status === "fulfilled") setTopProdutos(produtosRes.value as TopProdutoData[]);
    if (clientesRes.status === "fulfilled") setTopClientes(clientesRes.value as TopClienteData[]);
    if (tipoRes.status === "fulfilled") setVendasTipo(tipoRes.value as VendasTipoData);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojaIds.join(","), period, customRange]);

  useEffect(() => {
    void fetchDados();
  }, [fetchDados]);

  if (lojaIds.length === 0) return <SemLoja />;

  // range para TabelaVendas
  let tabelaStart: string | undefined;
  let tabelaEnd: string | undefined;
  if (period === "custom" && customRange) {
    tabelaStart = customRange.start.toISOString().split("T")[0];
    tabelaEnd = customRange.end.toISOString().split("T")[0];
  } else if (period !== "custom") {
    const range = computeRange(period);
    tabelaStart = range.start;
    tabelaEnd = range.end;
  }

  return (
    <div className="p-6 flex flex-col gap-5">
      {/* ── KPIs — 5 cards em linha ─────────────────────────────────────────── */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <FaturamentoKpiCard
          vendaTotal={kpis?.faturamento.vendaTotal ?? 0}
          totalVendas={kpis?.faturamento.totalVendas ?? 0}
          devolucaoTotal={kpis?.faturamento.devolucaoTotal ?? 0}
          totalDevolucoes={kpis?.faturamento.totalDevolucoes ?? 0}
          faturamentoLiquido={kpis?.faturamento.value ?? 0}
          change={kpis?.faturamento.change}
          isLoading={kpiLoading}
        />
        <KpiCard
          title="Vendas"
          value={kpiLoading ? "—" : formatNumber(kpis?.totalVendas ?? 0)}
          icon={ShoppingCart}
          accentColor="#7c3aed"
          isLoading={kpiLoading}
          change={kpis?.vendas.change ?? undefined}
          changeLabel="vs período ant."
          animationDelay={DELAY[1]}
        />
        <KpiCard
          title="Ticket Médio"
          value={kpiLoading ? "—" : formatCurrency(kpis?.ticketMedio.value ?? 0)}
          icon={TrendingUp}
          accentColor="#10b981"
          isLoading={kpiLoading}
          change={kpis?.ticketMedio.change ?? undefined}
          changeLabel="vs período ant."
          animationDelay={DELAY[2]}
        />
        <KpiCard
          title="Devoluções"
          value={kpiLoading ? "—" : formatNumber(kpis?.totalDevolucoes ?? 0)}
          icon={RotateCcw}
          accentColor="#ef4444"
          isLoading={kpiLoading}
          subtitle={kpis ? `${formatCurrency(kpis.valorDevolvido)} devolvidos` : undefined}
          titleTooltip="Identificadas por CFOP fiscal (1xxx, 2xxx, 3xxx)"
          animationDelay={DELAY[3]}
        />
        <KpiCard
          title="Cancelamentos"
          value={kpiLoading ? "—" : formatNumber(kpis?.totalCancelamentos ?? 0)}
          icon={XCircle}
          accentColor="#f97316"
          isLoading={kpiLoading}
          subtitle="cancelamentos no período"
          titleTooltip="Vendas com status cancelada antes do fechamento fiscal"
          animationDelay={DELAY[4]}
        />
      </div>

      {/* ── Linha 2: Top Produtos | PF/PJ | Faturamento Mensal ──────────────── */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "1fr 0.85fr 1fr" }}
      >
        <ChartCard title="Top Produtos" subtitle="por faturamento — período selecionado" animationDelay={80}>
          {chartsLoading ? <ChartSkeleton height={260} /> : <TopProdutosChart data={topProdutos} />}
        </ChartCard>

        <ChartCard title="PF vs PJ" subtitle="tipo de cliente — período selecionado" animationDelay={100}>
          {chartsLoading ? <ChartSkeleton height={260} /> : <VendasTipoChart data={vendasTipo} />}
        </ChartCard>

        <ChartCard title="Faturamento Mensal" subtitle="últimos 6 meses com dados" animationDelay={120}>
          {chartsLoading ? <ChartSkeleton /> : <FaturamentoMensalChart data={faturamentoMensal} />}
        </ChartCard>
      </div>

      {/* ── Linha 3: Top Clientes | Formas de Pagamento ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Top Clientes" subtitle="por faturamento — período selecionado" animationDelay={160}>
          {chartsLoading ? <ChartSkeleton height={260} /> : <TopClientesChart data={topClientes} />}
        </ChartCard>
        <ChartCard title="Formas de Pagamento" subtitle="período selecionado" animationDelay={200}>
          {chartsLoading ? <ChartSkeleton /> : <FormasPagamentoChart data={formasPagamento} />}
        </ChartCard>
      </div>

      {/* ── Tabela de Vendas ─────────────────────────────────────────────────── */}
      {tabelaStart && tabelaEnd && (
        <ChartCard title="Vendas" subtitle="drill-down com detalhes por venda" animationDelay={240}>
          <TabelaVendas
            lojaIds={lojaIds}
            period={period}
            start={tabelaStart}
            end={tabelaEnd}
          />
        </ChartCard>
      )}
    </div>
  );
}
