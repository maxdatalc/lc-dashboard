"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { usePeriod, computeRange } from "@/lib/contexts/period-context";
import { useLoja } from "@/lib/contexts/loja-context";
import { KpiCard } from "@/components/ui/KpiCard";
import { FaturamentoMensalChart } from "@/components/charts/FaturamentoMensalChart";
import { FormasPagamentoChart } from "@/components/charts/FormasPagamentoChart";
import { TopProdutosChart } from "@/components/charts/TopProdutosChart";
import { TopClientesChart } from "@/components/charts/TopClientesChart";
import { formatCurrency, formatNumber } from "@/lib/utils/format";
import type { FaturamentoMensalData } from "@/components/charts/FaturamentoMensalChart";
import type { FormasPagamentoData } from "@/components/charts/FormasPagamentoChart";
import type { TopProdutoData } from "@/components/charts/TopProdutosChart";
import type { TopClienteData } from "@/components/charts/TopClientesChart";

// ─── Tipos das respostas das APIs ────────────────────────────────────────────

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

// ─── Skeleton de card ────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderLeft: "3px solid var(--border-subtle)",
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="h-3 w-20 rounded animate-pulse"
          style={{ backgroundColor: "var(--border-subtle)" }}
        />
        <div
          className="w-9 h-9 rounded-lg animate-pulse"
          style={{ backgroundColor: "var(--border-subtle)" }}
        />
      </div>
      <div
        className="h-8 w-32 rounded animate-pulse"
        style={{ backgroundColor: "var(--border-subtle)" }}
      />
      <div
        className="h-4 w-24 rounded animate-pulse"
        style={{ backgroundColor: "var(--border-subtle)" }}
      />
    </div>
  );
}

// ─── Skeleton de gráfico ──────────────────────────────────────────────────────

function formatCurrencyFull(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatChangeValue(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")}%`;
}

function FaturamentoKpiCard({
  vendaTotal,
  totalVendas,
  devolucaoTotal,
  totalDevolucoes,
  faturamentoLiquido,
  change,
}: {
  vendaTotal: number;
  totalVendas: number;
  devolucaoTotal: number;
  totalDevolucoes: number;
  faturamentoLiquido: number;
  change?: number;
}) {
  const accentColor = "var(--accent-cyan)";

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2 transition-colors min-h-[128px]"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderLeft: `3px solid ${accentColor}`,
        animationDelay: "0ms",
        animation: "kpiEntrance 0.4s ease both",
      }}
    >
      <div className="flex items-center justify-between">
        <p
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-secondary)" }}
        >
          Faturamento
        </p>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${accentColor}1f`, color: accentColor }}
        >
          <DollarSign className="h-4 w-4" style={{ width: "16px", height: "16px" }} />
        </div>
      </div>

      <div className="text-center">
        <p className="text-[11px] font-medium leading-none" style={{ color: "var(--text-secondary)" }}>
          Venda
        </p>
        <p
          className="mt-1 text-xl font-bold tabular-nums leading-tight"
          style={{ color: accentColor }}
        >
          {formatCurrencyFull(vendaTotal)}
        </p>
        <p className="text-[11px] leading-tight" style={{ color: "var(--text-muted)" }}>
          {formatNumber(totalVendas)} vendas realizadas
        </p>
      </div>

      <div className="text-center">
        <p className="text-[11px] font-medium leading-none" style={{ color: "var(--accent-red)" }}>
          Devolução
        </p>
        <p
          className="mt-1 text-base font-bold tabular-nums leading-tight"
          style={{ color: "var(--accent-red)" }}
        >
          {formatCurrencyFull(devolucaoTotal)}
        </p>
        <p className="text-[11px] leading-tight" style={{ color: "var(--text-muted)" }}>
          {formatNumber(totalDevolucoes)} devoluções
        </p>
      </div>

      <div
        className="flex items-center justify-between gap-2 border-t pt-2"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <p className="text-[11px] leading-tight" style={{ color: "var(--text-muted)" }}>
          Líquido:{" "}
          <span className="font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {formatCurrencyFull(faturamentoLiquido)}
          </span>
        </p>
        {change !== undefined && (
          <span
            className="text-[11px] font-medium whitespace-nowrap"
            style={{
              color:
                change > 0
                  ? "var(--accent-green)"
                  : change < 0
                  ? "var(--accent-red)"
                  : "var(--text-secondary)",
            }}
          >
            {formatChangeValue(change)}
          </span>
        )}
      </div>
    </div>
  );
}

function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div
      className="rounded animate-pulse w-full"
      style={{ height, backgroundColor: "var(--border-subtle)" }}
    />
  );
}

// ─── Card de seção com título ─────────────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Sem loja selecionada ─────────────────────────────────────────────────────

function SemLoja() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div
        className="rounded-xl p-10 text-center max-w-sm"
        style={{
          backgroundColor: "var(--bg-card)",
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

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { period, customRange } = usePeriod();
  const { selectedLojaId } = useLoja();

  const [kpiLoading, setKpiLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);

  const [kpis, setKpis] = useState<KpiResponse | null>(null);
  const [faturamentoMensal, setFaturamentoMensal] = useState<FaturamentoMensalData[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormasPagamentoData[]>([]);
  const [topProdutos, setTopProdutos] = useState<TopProdutoData[]>([]);
  const [topClientes, setTopClientes] = useState<TopClienteData[]>([]);

  const fetchDados = useCallback(async () => {
    if (!selectedLojaId) return;

    setKpiLoading(true);
    setChartsLoading(true);

    // Calcular o intervalo de datas diretamente (evita dependência instável de getDateRange)
    let start: string, end: string;
    if (period === "custom" && customRange) {
      start = customRange.start.toISOString().split("T")[0];
      end = customRange.end.toISOString().split("T")[0];
    } else if (period === "custom") {
      // 'custom' sem range definido: aguarda o usuário selecionar
      setKpiLoading(false);
      setChartsLoading(false);
      return;
    } else {
      const range = computeRange(period);
      start = range.start;
      end = range.end;
    }

    const params = new URLSearchParams({ lojaId: selectedLojaId, period, start, end });

    // KPIs e gráficos em paralelo
    const [kpisRes, faturamentoRes, pagamentosRes, produtosRes, clientesRes] =
      await Promise.allSettled([
        fetch(`/api/dashboard/kpis?${params}`).then(async (r) => {
          if (!r.ok) {
            console.error("[dashboard] erro kpis:", await r.text());
            return null;
          }
          return r.json() as Promise<KpiResponse>;
        }),
        fetch(`/api/dashboard/charts?${params}&type=faturamento-mensal`).then(async (r) => {
          if (!r.ok) {
            console.error("[dashboard] erro faturamento-mensal:", await r.text());
            return [];
          }
          return r.json() as Promise<FaturamentoMensalData[]>;
        }),
        fetch(`/api/dashboard/charts?${params}&type=formas-pagamento`).then(async (r) => {
          if (!r.ok) {
            console.error("[dashboard] erro formas-pagamento:", await r.text());
            return [];
          }
          return r.json() as Promise<FormasPagamentoData[]>;
        }),
        fetch(`/api/dashboard/charts?${params}&type=top-produtos`).then(async (r) => {
          if (!r.ok) {
            console.error("[dashboard] erro top-produtos:", await r.text());
            return [];
          }
          return r.json() as Promise<TopProdutoData[]>;
        }),
        fetch(`/api/dashboard/charts?${params}&type=top-clientes`).then(async (r) => {
          if (!r.ok) {
            console.error("[dashboard] erro top-clientes:", await r.text());
            return [];
          }
          return r.json() as Promise<TopClienteData[]>;
        }),
      ]);

    setKpiLoading(false);
    setChartsLoading(false);

    if (kpisRes.status === "fulfilled" && kpisRes.value) setKpis(kpisRes.value);
    if (faturamentoRes.status === "fulfilled") setFaturamentoMensal(faturamentoRes.value as FaturamentoMensalData[]);
    if (pagamentosRes.status === "fulfilled") setFormasPagamento(pagamentosRes.value as FormasPagamentoData[]);
    if (produtosRes.status === "fulfilled") setTopProdutos(produtosRes.value as TopProdutoData[]);
    if (clientesRes.status === "fulfilled") setTopClientes(clientesRes.value as TopClienteData[]);
  }, [selectedLojaId, period, customRange]);

  useEffect(() => {
    void fetchDados();
  }, [fetchDados]);

  if (!selectedLojaId) return <SemLoja />;

  const DELAY = [0, 60, 120, 180, 240];

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* ── Linha 1 — KPIs principais ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4">
        {kpiLoading ? (
          <>
            {[0, 1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
          </>
        ) : (
          <>
            <FaturamentoKpiCard
              vendaTotal={kpis?.faturamento.vendaTotal ?? 0}
              totalVendas={kpis?.faturamento.totalVendas ?? 0}
              devolucaoTotal={kpis?.faturamento.devolucaoTotal ?? 0}
              totalDevolucoes={kpis?.faturamento.totalDevolucoes ?? 0}
              faturamentoLiquido={kpis?.faturamento.value ?? 0}
              change={kpis?.faturamento.change ?? undefined}
            />
            <KpiCard
              title="Vendas"
              value={formatNumber(kpis?.totalVendas ?? 0)}
              icon={ShoppingCart}
              accentColor="var(--accent-purple)"
              change={kpis?.vendas.change ?? undefined}
              changeLabel="vs período ant."
              animationDelay={DELAY[1]}
            />
            <KpiCard
              title="Ticket Médio"
              value={formatCurrency(kpis?.ticketMedio.value ?? 0)}
              icon={TrendingUp}
              accentColor="var(--accent-green)"
              change={kpis?.ticketMedio.change ?? undefined}
              changeLabel="vs período ant."
              animationDelay={DELAY[2]}
            />
            <KpiCard
              title="Devoluções"
              value={formatNumber(kpis?.totalDevolucoes ?? 0)}
              icon={RotateCcw}
              accentColor="var(--accent-red)"
              subtitle={`${formatCurrency(kpis?.valorDevolvido ?? 0)} devolvidos`}
              titleTooltip="Devoluções identificadas por CFOP fiscal (1xxx, 2xxx, 3xxx)"
              animationDelay={DELAY[3]}
            />
            <KpiCard
              title="Cancelamentos"
              value={formatNumber(kpis?.totalCancelamentos ?? 0)}
              icon={XCircle}
              accentColor="var(--accent-orange)"
              subtitle="cancelamentos no período"
              titleTooltip="Vendas canceladas antes do fechamento fiscal"
              animationDelay={DELAY[4]}
            />
          </>
        )}
      </div>

      {/* ── Linha 2 — Faturamento Mensal + Formas de Pagamento ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <SectionCard title="Faturamento Mensal" subtitle="últimos 6 meses">
            {chartsLoading ? (
              <ChartSkeleton height={200} />
            ) : (
              <FaturamentoMensalChart data={faturamentoMensal} />
            )}
          </SectionCard>
        </div>

        <div className="lg:col-span-2">
          <SectionCard title="Formas de Pagamento" subtitle="período selecionado">
            {chartsLoading ? (
              <ChartSkeleton height={200} />
            ) : (
              <FormasPagamentoChart data={formasPagamento} />
            )}
          </SectionCard>
        </div>
      </div>

      {/* ── Linha 3 — Top Produtos + Top Clientes ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title="Top Produtos"
          subtitle={`por faturamento — período selecionado`}
        >
          {chartsLoading ? (
            <ChartSkeleton height={200} />
          ) : (
            <TopProdutosChart data={topProdutos} />
          )}
        </SectionCard>

        <SectionCard
          title="Top Clientes"
          subtitle="por faturamento — período selecionado"
        >
          {chartsLoading ? (
            <ChartSkeleton height={200} />
          ) : (
            <TopClientesChart data={topClientes} />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
