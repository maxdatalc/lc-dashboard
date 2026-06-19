"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useLoja } from "@/lib/contexts/loja-context";
import { ChartCard } from "@/components/ui/ChartCard";
import { FinFaturamentoChart, type FinFaturamentoData } from "@/components/charts/FinFaturamentoChart";
import { FinFluxoCaixaChart, type FinFluxoCaixaData } from "@/components/charts/FinFluxoCaixaChart";
import { FinMargemChart, type FinMargemData } from "@/components/charts/FinMargemChart";
import { FinAgingChart, type FinAgingData } from "@/components/charts/FinAgingChart";
import { FinTopDevedoresChart, type FinTopDevedorData } from "@/components/charts/FinTopDevedoresChart";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface KpiData {
  faturamentoMes: number;
  varFaturamento: number | null;
  qtdVendasMes: number;
  ticketMedioMes: number;
  recebidoMes: number;
  varRecebido: number | null;
  inadimplenciaTotal: number;
  inadimplenciaClientes: number;
  inadimplenciaTitulos: number;
  aVencer30Total: number;
  aVencer30Qtd: number;
  saldoLiquidoMes: number;
  entradasMes: number;
  saidasMes: number;
  margemPctMes: number | null;
  receitaBrutaMes: number;
  custoBrutoMes: number;
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

function fmtR(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}k`;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ─── Shimmer ─────────────────────────────────────────────────────────────────

function ChartSkeleton({ height = 220 }: { height?: number }) {
  return <div className="shimmer rounded-lg w-full" style={{ height }} />;
}

function KpiSkeleton() {
  return <div className="shimmer rounded-xl" style={{ height: 96 }} />;
}

// ─── Sem loja ─────────────────────────────────────────────────────────────────

function SemLoja() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="rounded-2xl p-10 text-center max-w-sm" style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Selecione uma loja na barra lateral para visualizar os dados financeiros.
        </p>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  variation?: number | null;
  icon: React.ReactNode;
  accent: string;
  delay?: number;
  danger?: boolean;
  badge?: string;
}

function KpiCard({ label, value, sub, variation, icon, accent, delay = 0, danger = false, badge }: KpiCardProps) {
  const varColor = danger
    ? (variation !== null && variation !== undefined ? (variation > 0 ? "#ef4444" : "#22c55e") : "var(--text-muted)")
    : (variation !== null && variation !== undefined ? (variation >= 0 ? "#22c55e" : "#ef4444") : "var(--text-muted)");

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 16,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      animation: "fadeInUp 0.4s ease-out both",
      animationDelay: `${delay}ms`,
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        opacity: 0.7,
      }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {label}
        </span>
        <span style={{ color: accent, opacity: 0.85, display: "flex" }}>{icon}</span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <span style={{
          fontSize: 22,
          fontWeight: 800,
          fontFamily: "var(--font-mono, monospace)",
          color: "var(--text-primary)",
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}>
          {value}
        </span>
        {badge && (
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: 20,
            background: `${accent}18`,
            color: accent,
            marginBottom: 1,
            whiteSpace: "nowrap",
          }}>
            {badge}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {variation !== null && variation !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 700, color: varColor, display: "flex", alignItems: "center", gap: 2 }}>
            {variation >= 0 ? "▲" : "▼"} {Math.abs(variation).toFixed(1)}%
          </span>
        )}
        {sub && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</span>
        )}
      </div>
    </div>
  );
}

// ─── Ícones ───────────────────────────────────────────────────────────────────

const IconFat = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
  </svg>
);
const IconRec = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M16 12l-4 4-4-4M12 8v8" />
  </svg>
);
const IconSaldo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
  </svg>
);
const IconInad = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconVencer = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconMargem = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

// ─── Filter Pill ──────────────────────────────────────────────────────────────

function FilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "3px 8px 3px 10px",
      background: "rgba(0,229,255,0.08)",
      border: "1px solid rgba(0,229,255,0.3)",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      color: "var(--accent-cyan)",
    }}>
      {label}
      <button
        onClick={onClear}
        style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1, display: "flex" }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M9.5 2.5l-7 7M2.5 2.5l7 7"/>
        </svg>
      </button>
    </span>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const { selectedLojaId, lojasDisponiveis, lojasSelecionadas } = useLoja();

  const lojaIds =
    lojasSelecionadas.length > 0
      ? lojasSelecionadas
      : lojasDisponiveis.length > 0
      ? lojasDisponiveis.map((l) => l.id)
      : selectedLojaId
      ? [selectedLojaId]
      : [];

  const [selectedMes, setSelectedMes]     = useState<string | null>(null);
  const [selectedAging, setSelectedAging] = useState<string | null>(null);

  const [kpiLoading, setKpiLoading]       = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing]   = useState(false);
  const hasLoadedOnce = useRef(false);

  const [kpis, setKpis]                                     = useState<KpiData | null>(null);
  const [fatRecData, setFatRecData]                         = useState<FinFaturamentoData[]>([]);
  const [fluxoData, setFluxoData]                           = useState<FinFluxoCaixaData[]>([]);
  const [margemData, setMargemData]                         = useState<FinMargemData[]>([]);
  const [agingData, setAgingData]                           = useState<FinAgingData[]>([]);
  const [topDevedoresFiltrado, setTopDevedoresFiltrado]     = useState<FinTopDevedorData[]>([]);

  const lojaKey = lojaIds.join(",");

  const fetchDados = useCallback(async () => {
    if (lojaIds.length === 0) return;
    setIsRefreshing(true);
    if (!hasLoadedOnce.current) {
      setKpiLoading(true);
      setChartsLoading(true);
    }

    const params = new URLSearchParams({ lojaIds: lojaKey });

    const [kpisRes, fatRecRes, fluxoRes, margemRes, agingRes, topRes] = await Promise.allSettled([
      fetch(`/api/dashboard/financeiro/kpis?${params}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/dashboard/financeiro/charts?${params}&type=faturamento-recebimentos`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/dashboard/financeiro/charts?${params}&type=fluxo-caixa`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/dashboard/financeiro/charts?${params}&type=margem`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/dashboard/financeiro/charts?${params}&type=aging`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/dashboard/financeiro/charts?${params}&type=top-devedores`).then((r) => r.ok ? r.json() : []),
    ]);

    setKpiLoading(false);
    setChartsLoading(false);
    setIsRefreshing(false);
    hasLoadedOnce.current = true;

    if (kpisRes.status === "fulfilled" && kpisRes.value)  setKpis(kpisRes.value);
    if (fatRecRes.status === "fulfilled") setFatRecData(fatRecRes.value as FinFaturamentoData[]);
    if (fluxoRes.status  === "fulfilled") setFluxoData(fluxoRes.value   as FinFluxoCaixaData[]);
    if (margemRes.status === "fulfilled") setMargemData(margemRes.value  as FinMargemData[]);
    if (agingRes.status  === "fulfilled") setAgingData(agingRes.value    as FinAgingData[]);
    if (topRes.status    === "fulfilled") setTopDevedoresFiltrado(topRes.value as FinTopDevedorData[]);
  }, [lojaKey]);

  const fetchTopDevedores = useCallback(async (aging: string | null) => {
    if (lojaIds.length === 0) return;
    const params = new URLSearchParams({ lojaIds: lojaKey, type: "top-devedores" });
    if (aging) params.set("aging", aging);
    const res = await fetch(`/api/dashboard/financeiro/charts?${params}`);
    if (res.ok) setTopDevedoresFiltrado(await res.json());
  }, [lojaKey]);

  useEffect(() => { fetchDados(); }, [fetchDados]);
  useEffect(() => { fetchTopDevedores(selectedAging); }, [selectedAging, fetchTopDevedores]);

  if (lojaIds.length === 0) return <SemLoja />;

  const mesesNomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const mesPillLabel = selectedMes ? (() => {
    const [y, m] = selectedMes.split("-");
    return `${mesesNomes[parseInt(m, 10) - 1]}/${y.slice(2)}`;
  })() : null;

  const agingLabels: Record<string, string> = {
    "01-30d": "1–30 dias",
    "31-60d": "31–60 dias",
    "61-90d": "61–90 dias",
    "+90d":   "+90 dias",
  };

  return (
    <div style={{ padding: "20px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Cabeçalho ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.02em" }}>
            Painel Financeiro
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
            Faturamento · Recebimentos · Inadimplência · Fluxo de Caixa · Margem
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {mesPillLabel && (
            <FilterPill label={`Mês: ${mesPillLabel}`} onClear={() => setSelectedMes(null)} />
          )}
          {selectedAging && (
            <FilterPill label={`Aging: ${agingLabels[selectedAging] ?? selectedAging}`} onClear={() => setSelectedAging(null)} />
          )}
          <button
            onClick={fetchDados}
            disabled={isRefreshing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: isRefreshing ? "not-allowed" : "pointer",
              opacity: isRefreshing ? 0.6 : 1,
              transition: "all 0.15s",
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: isRefreshing ? "spin 1s linear infinite" : undefined }}
            >
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Atualizar
          </button>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 12,
      }}>
        {kpiLoading ? (
          [...Array(6)].map((_, i) => <KpiSkeleton key={i} />)
        ) : kpis ? (
          <>
            <KpiCard
              label="Faturamento Mês"
              value={fmtR(kpis.faturamentoMes)}
              variation={kpis.varFaturamento}
              sub="vs mês anterior"
              icon={<IconFat />}
              accent="var(--accent-cyan)"
              badge={`${kpis.qtdVendasMes} vendas`}
              delay={0}
            />
            <KpiCard
              label="Recebido Mês"
              value={fmtR(kpis.recebidoMes)}
              variation={kpis.varRecebido}
              sub="vs mês anterior"
              icon={<IconRec />}
              accent="#22c55e"
              delay={60}
            />
            <KpiCard
              label="Saldo Líquido"
              value={fmtR(kpis.saldoLiquidoMes)}
              sub={`Ent ${fmtR(kpis.entradasMes)} · Saí ${fmtR(kpis.saidasMes)}`}
              icon={<IconSaldo />}
              accent={kpis.saldoLiquidoMes >= 0 ? "#22c55e" : "#ef4444"}
              delay={120}
            />
            <KpiCard
              label="Inadimplência"
              value={fmtR(kpis.inadimplenciaTotal)}
              sub={`${kpis.inadimplenciaClientes} clientes · ${kpis.inadimplenciaTitulos} títulos`}
              icon={<IconInad />}
              accent="#ef4444"
              danger
              delay={180}
            />
            <KpiCard
              label="A Vencer (30d)"
              value={fmtR(kpis.aVencer30Total)}
              sub={`${kpis.aVencer30Qtd} títulos a vencer`}
              icon={<IconVencer />}
              accent="#f59e0b"
              delay={240}
            />
            <KpiCard
              label="Margem Bruta"
              value={kpis.margemPctMes !== null ? `${kpis.margemPctMes.toFixed(1)}%` : "—"}
              sub={kpis.receitaBrutaMes > 0 ? `Receita ${fmtR(kpis.receitaBrutaMes)}` : "Sem dados de custo"}
              icon={<IconMargem />}
              accent="#a855f7"
              delay={300}
            />
          </>
        ) : null}
      </div>

      {/* ── Row 1: Faturamento vs Recebimentos + Margem ──────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <ChartCard
          title="Faturamento vs Recebimentos"
          subtitle={`Últimos 12 meses${mesPillLabel ? ` · filtrando ${mesPillLabel}` : " · clique para filtrar"}`}
          animationDelay={100}
        >
          {chartsLoading ? (
            <ChartSkeleton height={220} />
          ) : (
            <FinFaturamentoChart
              data={fatRecData}
              selectedMes={selectedMes}
              onMesClick={setSelectedMes}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Margem Bruta"
          subtitle="Receita, custo e % de margem — últimos 12 meses"
          animationDelay={150}
        >
          {chartsLoading ? (
            <ChartSkeleton height={220} />
          ) : (
            <FinMargemChart
              data={margemData}
              selectedMes={selectedMes}
              onMesClick={setSelectedMes}
            />
          )}
        </ChartCard>
      </div>

      {/* ── Row 2: Fluxo de Caixa ─────────────────────────────────── */}
      <ChartCard
        title="Fluxo de Caixa"
        subtitle={`Entradas, saídas e saldo líquido — últimos 12 meses${mesPillLabel ? ` · destacando ${mesPillLabel}` : ""}`}
        animationDelay={200}
      >
        {chartsLoading ? (
          <ChartSkeleton height={220} />
        ) : (
          <FinFluxoCaixaChart
            data={fluxoData}
            selectedMes={selectedMes}
            onMesClick={setSelectedMes}
          />
        )}
      </ChartCard>

      {/* ── Row 3: Aging + Top Devedores ─────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16 }}>
        <ChartCard
          title="Aging de Inadimplência"
          subtitle="Clique numa faixa para filtrar os devedores"
          animationDelay={250}
        >
          {chartsLoading ? (
            <ChartSkeleton height={280} />
          ) : (
            <FinAgingChart
              data={agingData}
              selectedAging={selectedAging}
              onAgingClick={setSelectedAging}
            />
          )}
        </ChartCard>

        <ChartCard
          title={selectedAging ? `Top Devedores — ${agingLabels[selectedAging] ?? selectedAging}` : "Top Devedores"}
          subtitle="Maiores valores em aberto e vencidos"
          animationDelay={300}
        >
          {chartsLoading ? (
            <ChartSkeleton height={280} />
          ) : (
            <FinTopDevedoresChart
              data={topDevedoresFiltrado}
              selectedAging={selectedAging}
            />
          )}
        </ChartCard>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .fin-row-2col { grid-template-columns: 1fr !important; }
          .fin-row-aging { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
