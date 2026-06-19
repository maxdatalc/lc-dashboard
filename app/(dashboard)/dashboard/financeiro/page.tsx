"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useLoja } from "@/lib/contexts/loja-context";
import { usePeriod, computeRange, type Period } from "@/lib/contexts/period-context";
import { ChartCard } from "@/components/ui/ChartCard";
import { TopProgressBar } from "@/components/ui/TopProgressBar";
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

function periodLabel(period: Period, customRange: { start: Date; end: Date } | null): string {
  const fmtD = (d: Date) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
  switch (period) {
    case "today":     return "Hoje";
    case "7d":        return "7 dias";
    case "month":     return "Mês atual";
    case "3m":        return "3 meses";
    case "year":      return "Ano atual";
    case "prev-year": return "Ano anterior";
    case "custom":
      if (!customRange) return "Período personalizado";
      return `${fmtD(customRange.start)} – ${fmtD(customRange.end)}`;
  }
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

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
  info?: string;
}

function KpiCard({ label, value, sub, variation, icon, accent, delay = 0, danger = false, badge, info }: KpiCardProps) {
  const [showInfo, setShowInfo] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showInfo) return;
    function handleOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowInfo(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showInfo]);

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
      overflow: "visible",
    }}>
      {/* Linha de cor no topo */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        borderRadius: "16px 16px 0 0",
        background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        opacity: 0.7,
      }} />

      {/* Header: label + botão info + ícone */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {info && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowInfo((v) => !v); }}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 2,
                color: showInfo ? accent : "var(--text-muted)",
                display: "flex", alignItems: "center", borderRadius: 4,
                transition: "color 0.15s",
              }}
              title="Como analisar este indicador"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </button>
          )}
          <span style={{ color: accent, opacity: 0.85, display: "flex" }}>{icon}</span>
        </div>
      </div>

      {/* Valor + badge */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <span style={{
          fontSize: 22, fontWeight: 800, fontFamily: "var(--font-mono, monospace)",
          color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1,
        }}>
          {value}
        </span>
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 20,
            background: `${accent}18`, color: accent, marginBottom: 1, whiteSpace: "nowrap",
          }}>
            {badge}
          </span>
        )}
      </div>

      {/* Variação + sub */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {variation !== null && variation !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 700, color: varColor, display: "flex", alignItems: "center", gap: 2 }}>
            {variation >= 0 ? "▲" : "▼"} {Math.abs(variation).toFixed(1)}%
          </span>
        )}
        {sub && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</span>}
      </div>

      {/* Popup de informação */}
      {showInfo && info && (
        <div
          ref={popupRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 200,
            width: 272,
            background: "var(--bg-card)",
            border: `1px solid ${accent}45`,
            borderRadius: 12,
            padding: "14px 16px",
            boxShadow: "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: accent }}>
              Como analisar
            </span>
            <button
              onClick={() => setShowInfo(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9.5 2.5l-7 7M2.5 2.5l7 7"/>
              </svg>
            </button>
          </div>
          <p style={{ fontSize: 12, lineHeight: 1.7, color: "var(--text-secondary)", margin: 0 }}>
            {info}
          </p>
        </div>
      )}
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
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 8px 3px 10px",
      background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.3)",
      borderRadius: 20, fontSize: 11, fontWeight: 600, color: "var(--accent-cyan)",
    }}>
      {label}
      <button onClick={onClear} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1, display: "flex" }}>
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
  const { period, customRange } = usePeriod();

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

  const [kpis, setKpis]                                 = useState<KpiData | null>(null);
  const [fatRecData, setFatRecData]                     = useState<FinFaturamentoData[]>([]);
  const [fluxoData, setFluxoData]                       = useState<FinFluxoCaixaData[]>([]);
  const [margemData, setMargemData]                     = useState<FinMargemData[]>([]);
  const [agingData, setAgingData]                       = useState<FinAgingData[]>([]);
  const [topDevedoresFiltrado, setTopDevedoresFiltrado] = useState<FinTopDevedorData[]>([]);

  const lojaKey = lojaIds.join(",");

  // Calcula start/end a partir do período selecionado no header
  function getRange(): { start: string; end: string } {
    if (period === "custom" && customRange) {
      return {
        start: customRange.start.toISOString().split("T")[0],
        end:   customRange.end.toISOString().split("T")[0],
      };
    }
    if (period === "custom") return computeRange("month");
    return computeRange(period);
  }

  const fetchDados = useCallback(async () => {
    if (lojaIds.length === 0) return;
    setIsRefreshing(true);
    if (!hasLoadedOnce.current) {
      setKpiLoading(true);
      setChartsLoading(true);
    }

    const { start, end } = getRange();
    const params = new URLSearchParams({ lojaIds: lojaKey, start, end });

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

    if (kpisRes.status  === "fulfilled" && kpisRes.value)  setKpis(kpisRes.value);
    if (fatRecRes.status === "fulfilled") setFatRecData(fatRecRes.value as FinFaturamentoData[]);
    if (fluxoRes.status  === "fulfilled") setFluxoData(fluxoRes.value   as FinFluxoCaixaData[]);
    if (margemRes.status === "fulfilled") setMargemData(margemRes.value  as FinMargemData[]);
    if (agingRes.status  === "fulfilled") setAgingData(agingRes.value    as FinAgingData[]);
    if (topRes.status    === "fulfilled") setTopDevedoresFiltrado(topRes.value as FinTopDevedorData[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojaKey, period, customRange]);

  const fetchTopDevedores = useCallback(async (aging: string | null) => {
    if (lojaIds.length === 0) return;
    const { start, end } = getRange();
    const params = new URLSearchParams({ lojaIds: lojaKey, start, end, type: "top-devedores" });
    if (aging) params.set("aging", aging);
    const res = await fetch(`/api/dashboard/financeiro/charts?${params}`);
    if (res.ok) setTopDevedoresFiltrado(await res.json());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojaKey, period, customRange]);

  useEffect(() => { void fetchDados(); }, [fetchDados]);
  useEffect(() => { void fetchTopDevedores(selectedAging); }, [selectedAging, fetchTopDevedores]);

  if (lojaIds.length === 0) return <SemLoja />;

  const pLabel = periodLabel(period, customRange);

  const agingLabels: Record<string, string> = {
    "01-30d": "1–30 dias", "31-60d": "31–60 dias", "61-90d": "61–90 dias", "+90d": "+90 dias",
  };

  return (
    <div className="px-3 py-3 sm:px-4 md:px-5 md:py-3 flex flex-col gap-3">
      <TopProgressBar loading={isRefreshing} />

      <div
        className="flex flex-col gap-3"
        style={{
          opacity: isRefreshing && hasLoadedOnce.current ? 0.55 : 1,
          transition: "opacity 0.2s ease",
          pointerEvents: isRefreshing && hasLoadedOnce.current ? "none" : "auto",
        }}
      >

        {/* ── Filtros ativos + Atualizar ───────────────────────────────── */}
        {(selectedMes ?? selectedAging) ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {selectedMes && (
              <FilterPill label={`Mês: ${selectedMes}`} onClear={() => setSelectedMes(null)} />
            )}
            {selectedAging && (
              <FilterPill label={`Aging: ${agingLabels[selectedAging] ?? selectedAging}`} onClear={() => setSelectedAging(null)} />
            )}
          </div>
        ) : null}

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
          {kpiLoading ? (
            [...Array(6)].map((_, i) => <KpiSkeleton key={i} />)
          ) : kpis ? (
            <>
              <KpiCard
                label="Faturamento"
                value={fmtR(kpis.faturamentoMes)}
                variation={kpis.varFaturamento}
                sub="vs período anterior"
                icon={<IconFat />}
                accent="var(--accent-cyan)"
                badge={`${kpis.qtdVendasMes} vendas`}
                delay={0}
                info="Total gerado em vendas e ordens de serviço no período. A seta compara com o período imediatamente anterior de mesma duração. Se o valor cresceu mas o número de vendas caiu, o ticket médio subiu — geralmente um sinal positivo. Se caiu, verifique se houve queda de volume ou redução de preços."
              />
              <KpiCard
                label="Recebido"
                value={fmtR(kpis.recebidoMes)}
                variation={kpis.varRecebido}
                sub="vs período anterior"
                icon={<IconRec />}
                accent="#22c55e"
                delay={60}
                info="Dinheiro que efetivamente entrou no caixa no período — apenas o que foi pago pelos clientes. Compare com o Faturamento: se o Recebido for bem menor, há valores vendidos mas ainda não recebidos. No gráfico abaixo, a linha amarela mostra exatamente essa proporção mês a mês."
              />
              <KpiCard
                label="Saldo Líquido"
                value={fmtR(kpis.saldoLiquidoMes)}
                sub={`Ent ${fmtR(kpis.entradasMes)} · Saí ${fmtR(kpis.saidasMes)}`}
                icon={<IconSaldo />}
                accent={kpis.saldoLiquidoMes >= 0 ? "#22c55e" : "#ef4444"}
                delay={120}
                info="Resultado real do caixa no período: entradas menos saídas registradas no financeiro. Verde significa que entrou mais do que saiu. Vermelho significa que a empresa gastou mais do que recebeu — atenção redobrada. Esse número reflete o movimento de caixa, não o lucro contábil."
              />
              <KpiCard
                label="Inadimplência"
                value={fmtR(kpis.inadimplenciaTotal)}
                sub={`${kpis.inadimplenciaClientes} clientes · ${kpis.inadimplenciaTitulos} títulos`}
                icon={<IconInad />}
                accent="#ef4444"
                danger
                delay={180}
                info="Total de cobranças vencidas e não pagas até hoje — independente do período selecionado no filtro. Quanto maior, maior o risco para o caixa. Priorize clientes com maior valor em aberto e títulos mais antigos. O gráfico de Aging logo abaixo mostra quanto está vencido há 30, 60, 90 ou mais dias."
              />
              <KpiCard
                label="A Vencer (30d)"
                value={fmtR(kpis.aVencer30Total)}
                sub={`${kpis.aVencer30Qtd} títulos a vencer`}
                icon={<IconVencer />}
                accent="#f59e0b"
                delay={240}
                info="Cobranças que ainda estão dentro do prazo, mas vencem nos próximos 30 dias. Representam a receita esperada de curto prazo. Se o valor for alto, o caixa deve melhorar em breve — mas lembre-se: nem tudo que vence é pago no prazo. Use esse número para planejar compromissos futuros."
              />
              <KpiCard
                label="Margem Bruta"
                value={kpis.margemPctMes !== null ? `${kpis.margemPctMes.toFixed(1)}%` : "—"}
                sub={kpis.receitaBrutaMes > 0 ? `Receita ${fmtR(kpis.receitaBrutaMes)}` : "Sem dados de custo"}
                icon={<IconMargem />}
                accent="#a855f7"
                delay={300}
                info="Percentual que sobra da receita depois de descontar o custo dos produtos e serviços vendidos. Exemplo: 40% de margem significa que de cada R$ 100 faturados, R$ 40 sobram para cobrir despesas e gerar lucro. Se a margem cair, pode indicar que os custos subiram, que está vendendo com desconto excessivo, ou uma mistura dos dois."
              />
            </>
          ) : null}
        </div>

        {/* ── Row 1: Faturamento vs Recebimentos + Margem ──────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ChartCard
            title="Faturamento vs Recebimentos"
            subtitle={`12 meses · ${pLabel} · linha amarela = taxa de recebimento (recebido ÷ faturado)`}
            animationDelay={100}
          >
            {chartsLoading ? (
              <ChartSkeleton height={230} />
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
            subtitle={`12 meses · ${pLabel} · receita, custo e % de margem`}
            animationDelay={150}
          >
            {chartsLoading ? (
              <ChartSkeleton height={230} />
            ) : (
              <FinMargemChart
                data={margemData}
                selectedMes={selectedMes}
                onMesClick={setSelectedMes}
              />
            )}
          </ChartCard>
        </div>

        {/* ── Row 2: Fluxo de Caixa ──────────────────────────────────────── */}
        <ChartCard
          title="Fluxo de Caixa"
          subtitle={`12 meses · ${pLabel} · entradas, saídas e saldo líquido mensal`}
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

        {/* ── Row 3: Aging + Top Devedores ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ChartCard
            title="Aging de Inadimplência"
            subtitle="Estado atual · clique numa faixa para filtrar os devedores"
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
            subtitle="Estado atual · maiores valores em aberto e vencidos"
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

      </div>{/* fim do wrapper de dimming */}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
