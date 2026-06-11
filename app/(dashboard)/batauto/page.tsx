"use client";

import { useEffect, useState, useCallback } from "react";
import { usePeriod, computeRange } from "@/lib/contexts/period-context";
import { useLoja } from "@/lib/contexts/loja-context";
import { ChartCard } from "@/components/ui/ChartCard";
import { VendasMensalChart } from "@/components/charts/VendasMensalChart";
import { TopProdutosChart } from "@/components/charts/TopProdutosChart";
import { TopClientesChart } from "@/components/charts/TopClientesChart";
import { TopVendedoresChart } from "@/components/charts/TopVendedoresChart";
import type { VendasMensalData } from "@/components/charts/VendasMensalChart";
import type { TopProdutoData } from "@/components/charts/TopProdutosChart";
import type { ClienteItem } from "@/components/charts/TopClientesChart";
import type { VendedorItem } from "@/components/charts/TopVendedoresChart";

// ─── tipos ────────────────────────────────────────────────────────────────────

interface KpiData {
  faturamento: number;
  totalVendas: number;
  ticketMedio: number;
  clientes: number;
  osAbertas: number;
  varFaturamento: number | null;
  varVendas: number | null;
}

interface StatusOsItem {
  status: string;
  qtd: number;
  total: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR").format(v);

function Variacao({ val }: { val: number | null }) {
  if (val === null) return null;
  const up = val >= 0;
  return (
    <span
      className="text-xs font-medium"
      style={{ color: up ? "var(--accent-cyan)" : "#ef4444" }}
    >
      {up ? "▲" : "▼"} {Math.abs(val).toFixed(1)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  variacao,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  variacao?: number | null;
  loading?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-1"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      {loading ? (
        <div className="shimmer h-7 w-28 rounded" />
      ) : (
        <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          {value}
        </p>
      )}
      <div className="flex items-center gap-2">
        {sub && (
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {sub}
          </span>
        )}
        {variacao !== undefined && <Variacao val={variacao ?? null} />}
      </div>
    </div>
  );
}

function ChartSkeleton({ height = 220 }: { height?: number }) {
  return <div className="shimmer rounded-lg w-full" style={{ height }} />;
}

// ─── página ───────────────────────────────────────────────────────────────────

export default function BatautoPage() {
  const { period, customRange } = usePeriod();
  const { selectedLojaId } = useLoja();

  const [kpiLoading, setKpiLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);

  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [mensal, setMensal] = useState<VendasMensalData[]>([]);
  const [topServicos, setTopServicos] = useState<TopProdutoData[]>([]);
  const [topClientes, setTopClientes] = useState<ClienteItem[]>([]);
  const [topTecnicos, setTopTecnicos] = useState<VendedorItem[]>([]);
  const [statusOs, setStatusOs] = useState<StatusOsItem[]>([]);

  const fetchDados = useCallback(async () => {
    let start: string, end: string;

    if (period === "custom" && customRange) {
      start = customRange.start.toISOString().split("T")[0];
      end = customRange.end.toISOString().split("T")[0];
    } else if (period === "custom") {
      return;
    } else {
      const range = computeRange(period);
      start = range.start;
      end = range.end;
    }

    setKpiLoading(true);
    setChartsLoading(true);

    const params = new URLSearchParams({ start, end });
    if (selectedLojaId) params.set("lojaId", selectedLojaId);

    const [kpisRes, mensalRes, servicosRes, clientesRes, tecnicosRes, statusRes] =
      await Promise.allSettled([
        fetch(`/api/batauto/kpis?${params}`).then((r) =>
          r.ok ? (r.json() as Promise<KpiData>) : null
        ),
        fetch(`/api/batauto/charts?${params}&type=faturamento-mensal`).then((r) =>
          r.ok ? (r.json() as Promise<VendasMensalData[]>) : []
        ),
        fetch(`/api/batauto/charts?${params}&type=top-servicos`).then((r) =>
          r.ok ? (r.json() as Promise<TopProdutoData[]>) : []
        ),
        fetch(`/api/batauto/charts?${params}&type=top-clientes`).then((r) =>
          r.ok ? (r.json() as Promise<ClienteItem[]>) : []
        ),
        fetch(`/api/batauto/charts?${params}&type=top-tecnicos`).then((r) =>
          r.ok ? (r.json() as Promise<VendedorItem[]>) : []
        ),
        fetch(`/api/batauto/charts?${params}&type=status-os`).then((r) =>
          r.ok ? (r.json() as Promise<StatusOsItem[]>) : []
        ),
      ]);

    setKpiLoading(false);
    setChartsLoading(false);

    if (kpisRes.status === "fulfilled") setKpis(kpisRes.value);
    if (mensalRes.status === "fulfilled") setMensal(mensalRes.value as VendasMensalData[]);
    if (servicosRes.status === "fulfilled") setTopServicos(servicosRes.value as TopProdutoData[]);
    if (clientesRes.status === "fulfilled") setTopClientes(clientesRes.value as ClienteItem[]);
    if (tecnicosRes.status === "fulfilled") setTopTecnicos(tecnicosRes.value as VendedorItem[]);
    if (statusRes.status === "fulfilled") setStatusOs(statusRes.value as StatusOsItem[]);
  }, [period, customRange]);

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          label="Faturamento"
          value={kpis ? fmt(kpis.faturamento) : "—"}
          variacao={kpis?.varFaturamento}
          loading={kpiLoading}
        />
        <KpiCard
          label="OS / Vendas"
          value={kpis ? fmtNum(kpis.totalVendas) : "—"}
          variacao={kpis?.varVendas}
          loading={kpiLoading}
        />
        <KpiCard
          label="Ticket Médio"
          value={kpis ? fmt(kpis.ticketMedio) : "—"}
          loading={kpiLoading}
        />
        <KpiCard
          label="Clientes Atendidos"
          value={kpis ? fmtNum(kpis.clientes) : "—"}
          loading={kpiLoading}
        />
        <KpiCard
          label="OS em Aberto"
          value={kpis ? fmtNum(kpis.osAbertas) : "—"}
          sub="no momento"
          loading={kpiLoading}
        />
      </div>

      {/* ── Faturamento Mensal ───────────────────────────────────────────── */}
      <ChartCard title="Faturamento Mensal" subtitle="Últimos 12 meses — OS + Vendas concluídas">
        {chartsLoading ? (
          <ChartSkeleton height={220} />
        ) : (
          <VendasMensalChart data={mensal} />
        )}
      </ChartCard>

      {/* ── Peças / Serviços + Clientes ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Top 10 Peças / Serviços" subtitle="Por faturamento no período">
          {chartsLoading ? (
            <ChartSkeleton height={320} />
          ) : (
            <TopProdutosChart data={topServicos} />
          )}
        </ChartCard>

        <ChartCard title="Top 10 Clientes" subtitle="Por faturamento no período">
          {chartsLoading ? (
            <ChartSkeleton height={320} />
          ) : (
            <TopClientesChart data={topClientes} />
          )}
        </ChartCard>
      </div>

      {/* ── Técnicos + Status OS ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Top Técnicos / Atendentes" subtitle="Por faturamento no período">
          {chartsLoading ? (
            <ChartSkeleton height={280} />
          ) : (
            <TopVendedoresChart data={topTecnicos} />
          )}
        </ChartCard>

        <ChartCard title="Status das OS" subtitle="Abertas no período por tipo de atendimento">
          {chartsLoading ? (
            <ChartSkeleton height={280} />
          ) : statusOs.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
              Nenhuma OS encontrada no período
            </p>
          ) : (
            <div className="flex flex-col gap-2 py-1">
              {statusOs.map((item) => {
                const maxQtd = Math.max(...statusOs.map((s) => s.qtd));
                const pct = maxQtd > 0 ? (item.qtd / maxQtd) * 100 : 0;
                return (
                  <div key={item.status} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span
                        className="text-xs font-medium truncate max-w-[60%]"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {item.status}
                      </span>
                      <div className="flex gap-3 items-center">
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {fmtNum(item.qtd)} OS
                        </span>
                        <span className="text-xs font-semibold" style={{ color: "var(--accent-cyan)" }}>
                          {fmt(item.total)}
                        </span>
                      </div>
                    </div>
                    <div
                      className="rounded-full overflow-hidden"
                      style={{ height: 4, background: "var(--border-subtle)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: "var(--accent-cyan)",
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
