"use client";

import { useEffect, useState, useCallback } from "react";
import { DollarSign, ShoppingCart, TrendingUp, RotateCcw, XCircle } from "lucide-react";
import { usePeriod, computeRange } from "@/lib/contexts/period-context";
import { useLoja } from "@/lib/contexts/loja-context";
import { KpiCard } from "@/components/ui/KpiCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { FaturamentoMensalChart } from "@/components/charts/FaturamentoMensalChart";
import { FormasPagamentoChart } from "@/components/charts/FormasPagamentoChart";
import { TopProdutosChart } from "@/components/charts/TopProdutosChart";
import { TopClientesChart } from "@/components/charts/TopClientesChart";
import { TabelaVendas } from "@/components/dashboard/TabelaVendas";
import { formatCurrency, formatNumber } from "@/lib/utils/format";
import type { FaturamentoMensalData } from "@/components/charts/FaturamentoMensalChart";
import type { FormasPagamentoData } from "@/components/charts/FormasPagamentoChart";
import type { TopProdutoData } from "@/components/charts/TopProdutosChart";
import type { TopClienteData } from "@/components/charts/TopClientesChart";

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
  totalVendas: number;
  totalDevolucoes: number;
  totalCancelamentos: number;
  valorDevolvido: number;
}

// ─── Card de Faturamento composto (Precision Dark) ────────────────────────────

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
      className="rounded-xl p-5 flex flex-col gap-3 transition-all duration-200"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderTop: "3px solid var(--accent-cyan)",
        animation: "fadeInUp 0.4s ease-out both",
        animationDelay: "0ms",
      }}
    >
      {/* Título + ícone */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center flex-shrink-0 rounded-[10px]"
          style={{ width: 40, height: 40, backgroundColor: "rgba(0,229,255,0.12)", color: "#00e5ff" }}
        >
          <DollarSign style={{ width: 20, height: 20 }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
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
            <div className="shimmer rounded mt-2" style={{ height: 36, width: 140 }} />
          ) : (
            <p
              className="tabular-nums mt-1 leading-none"
              style={{
                fontFamily: "var(--font-display, 'DM Serif Display', serif)",
                fontSize: "1.8rem",
                fontWeight: 400,
                color: "var(--text-primary)",
              }}
            >
              {formatCurrency(faturamentoLiquido)}
            </p>
          )}
        </div>
      </div>

      {/* Divisor */}
      <div style={{ height: 1, backgroundColor: "var(--border-subtle)" }} />

      {/* Bruto vs Devoluções */}
      {isLoading ? (
        <div className="shimmer rounded" style={{ height: 14, width: 120 }} />
      ) : (
        <div className="flex items-center justify-between gap-2 text-xs">
          <div>
            <span style={{ color: "var(--text-muted)" }}>Bruto </span>
            <span className="font-medium tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {formatCurrency(vendaTotal)}
            </span>
            <span className="ml-1" style={{ color: "var(--text-muted)" }}>
              ({formatNumber(totalVendas)} vd)
            </span>
          </div>
          <div>
            <span style={{ color: "var(--accent-red)" }}>−{formatCurrency(devolucaoTotal)}</span>
            <span className="ml-1" style={{ color: "var(--text-muted)" }}>
              ({formatNumber(totalDevolucoes)} dev)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton de gráfico ──────────────────────────────────────────────────────

function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="shimmer rounded-lg w-full" style={{ height }} />
  );
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

    const [kpisRes, faturamentoRes, pagamentosRes, produtosRes, clientesRes] =
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
      ]);

    setKpiLoading(false);
    setChartsLoading(false);

    if (kpisRes.status === "fulfilled" && kpisRes.value) setKpis(kpisRes.value);
    if (faturamentoRes.status === "fulfilled") setFaturamentoMensal(faturamentoRes.value as FaturamentoMensalData[]);
    if (pagamentosRes.status === "fulfilled") setFormasPagamento(pagamentosRes.value as FormasPagamentoData[]);
    if (produtosRes.status === "fulfilled") setTopProdutos(produtosRes.value as TopProdutoData[]);
    if (clientesRes.status === "fulfilled") setTopClientes(clientesRes.value as TopClienteData[]);
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
    <div className="p-6 flex flex-col gap-6">
      {/* ── KPIs ──────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4">
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

      {/* ── Faturamento Mensal + Formas de Pagamento ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <ChartCard title="Faturamento Mensal" subtitle="últimos 6 meses" animationDelay={80}>
            {chartsLoading ? <ChartSkeleton /> : <FaturamentoMensalChart data={faturamentoMensal} />}
          </ChartCard>
        </div>
        <div className="lg:col-span-2">
          <ChartCard title="Formas de Pagamento" subtitle="período selecionado" animationDelay={120}>
            {chartsLoading ? <ChartSkeleton /> : <FormasPagamentoChart data={formasPagamento} />}
          </ChartCard>
        </div>
      </div>

      {/* ── Top Produtos + Top Clientes ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Top Produtos" subtitle="por faturamento — período selecionado" animationDelay={160}>
          {chartsLoading ? <ChartSkeleton height={280} /> : <TopProdutosChart data={topProdutos} />}
        </ChartCard>
        <ChartCard title="Top Clientes" subtitle="por faturamento — período selecionado" animationDelay={200}>
          {chartsLoading ? <ChartSkeleton height={280} /> : <TopClientesChart data={topClientes} />}
        </ChartCard>
      </div>

      {/* ── Tabela de Vendas ──────────────────────────────────────────────────── */}
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
