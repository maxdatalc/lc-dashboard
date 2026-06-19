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
  qtdRecebimentosMes: number;
  saldoLiquidoMes: number;
  varSaldoLiquido: number | null;
  entradasMes: number;
  saidasMes: number;
  contasReceberTotal: number;
  contasReceberQtd: number;
  contasPagarTotal: number;
  contasPagarQtd: number;
  inadimplenciaTotal: number;
  inadimplenciaQtd: number;
  aVencer7Total: number;
  aVencer7Qtd: number;
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

// ─── Cards executivos ─────────────────────────────────────────────────────────

const cardBase: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 16,
  padding: "18px 22px",
  height: "100%",
  position: "relative",
  overflow: "hidden",
  animation: "fadeInUp 0.4s ease-out both",
};

function AccentLine({ color }: { color: string }) {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 2,
      background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
    }} />
  );
}

function VarBadge({ v, invert = false }: { v: number | null; invert?: boolean }) {
  if (v === null) return null;
  const positive = invert ? v <= 0 : v >= 0;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: positive ? "#22c55e" : "#ef4444", whiteSpace: "nowrap" }}>
      {v >= 0 ? "▲" : "▼"} {Math.abs(v).toFixed(1)}%
    </span>
  );
}

// Card 1 — Resultado do Caixa (principal, mais largo)
function ResultadoCard({ kpis, pLabel }: { kpis: KpiData; pLabel: string }) {
  const positivo = kpis.saldoLiquidoMes >= 0;
  const cor = positivo ? "#22c55e" : "#ef4444";
  return (
    <div style={{ ...cardBase, padding: "20px 24px", animationDelay: "0ms" }}>
      <AccentLine color={cor} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Resultado do Caixa <span style={{ fontWeight: 400 }}>· {pLabel}</span>
        </span>
        <VarBadge v={kpis.varSaldoLiquido} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: cor, letterSpacing: "-0.04em", lineHeight: 1, whiteSpace: "nowrap", marginBottom: 4 }}>
          {fmtR(kpis.saldoLiquidoMes)}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {positivo ? "Resultado positivo" : "Resultado negativo"} · vs período anterior
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.12)", borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#22c55e", marginBottom: 5 }}>↑ Entradas</div>
          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "var(--text-primary)", whiteSpace: "nowrap" }}>{fmtR(kpis.entradasMes)}</div>
        </div>
        <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.11)", borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#ef4444", marginBottom: 5 }}>↓ Saídas</div>
          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "var(--text-primary)", whiteSpace: "nowrap" }}>{fmtR(kpis.saidasMes)}</div>
        </div>
      </div>
    </div>
  );
}

// Card 2/3 — Métrica simples (Faturamento, Recebido)
function MetricCard({ label, value, variation, sub, accent, delay = 0 }: {
  label: string; value: string; variation?: number | null;
  sub?: string; accent: string; delay?: number;
}) {
  return (
    <div style={{ ...cardBase, animationDelay: `${delay}ms` }}>
      <AccentLine color={accent} />
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1, whiteSpace: "nowrap" }}>
          {value}
        </span>
        <VarBadge v={variation ?? null} />
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );
}

// Card 4 — Carteira em Aberto (mais largo)
function CarteiraCard({ kpis, pLabel }: { kpis: KpiData; pLabel: string }) {
  const saldoPrevisto = kpis.contasReceberTotal - kpis.contasPagarTotal;
  const saldoCor = saldoPrevisto >= 0 ? "#22c55e" : "#ef4444";
  return (
    <div style={{ ...cardBase, animationDelay: "120ms" }}>
      <AccentLine color="var(--accent-cyan)" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Carteira em Aberto
        </span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>vencimento no {pLabel.toLowerCase()}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent-cyan)", marginBottom: 4 }}>A receber</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: "var(--text-primary)", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{fmtR(kpis.contasReceberTotal)}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{kpis.contasReceberQtd} título{kpis.contasReceberQtd !== 1 ? "s" : ""}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#ef4444", marginBottom: 4 }}>A pagar</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: "var(--text-primary)", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{fmtR(kpis.contasPagarTotal)}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{kpis.contasPagarQtd} lançamento{kpis.contasPagarQtd !== 1 ? "s" : ""}</div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Saldo previsto do período</span>
        <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: saldoCor, whiteSpace: "nowrap" }}>{fmtR(saldoPrevisto)}</span>
      </div>
    </div>
  );
}

// Card 5 — Risco Financeiro (mais largo)
function RiscoCard({ kpis }: { kpis: KpiData }) {
  const temVencidos = kpis.inadimplenciaTotal > 0;
  const temAVencer  = kpis.aVencer7Total > 0;
  const temRisco    = temVencidos || temAVencer;
  return (
    <div style={{
      ...cardBase,
      border: `1px solid ${temRisco ? "rgba(239,68,68,0.2)" : "var(--border-subtle)"}`,
      animationDelay: "180ms",
    }}>
      <AccentLine color={temRisco ? "#ef4444" : "var(--border-subtle)"} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Risco Financeiro
        </span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>estado atual</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: temVencidos ? "#ef4444" : "var(--text-muted)", marginBottom: 4 }}>Vencidos</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: temVencidos ? "#ef4444" : "var(--text-secondary)", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
            {temVencidos ? fmtR(kpis.inadimplenciaTotal) : "—"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
            {kpis.inadimplenciaQtd > 0 ? `${kpis.inadimplenciaQtd} em atraso` : "Sem títulos vencidos"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: temAVencer ? "#f59e0b" : "var(--text-muted)", marginBottom: 4 }}>A vencer (7 dias)</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color: temAVencer ? "#f59e0b" : "var(--text-secondary)", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
            {temAVencer ? fmtR(kpis.aVencer7Total) : "—"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
            {kpis.aVencer7Qtd > 0 ? `${kpis.aVencer7Qtd} título${kpis.aVencer7Qtd !== 1 ? "s" : ""}` : "Nenhum vencendo"}
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: temRisco ? "#ef4444" : "#22c55e", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: temRisco ? "#ef4444" : "var(--text-muted)" }}>
            {temRisco
              ? [
                  temVencidos && `${kpis.inadimplenciaQtd} título${kpis.inadimplenciaQtd !== 1 ? "s" : ""} vencido${kpis.inadimplenciaQtd !== 1 ? "s" : ""}`,
                  temAVencer && `${kpis.aVencer7Qtd} vencendo em 7 dias`,
                ].filter(Boolean).join(" · ")
              : "Sem alertas de risco no momento"}
          </span>
        </div>
      </div>
    </div>
  );
}

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

    // 2 chamadas HTTP em vez de 6 — charts consolidados em type=bulk
    const [kpisRes, chartsRes] = await Promise.allSettled([
      fetch(`/api/dashboard/financeiro/kpis?${params}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/dashboard/financeiro/charts?${params}&type=bulk`).then((r) => r.ok ? r.json() : {}),
    ]);

    setKpiLoading(false);
    setChartsLoading(false);
    setIsRefreshing(false);
    hasLoadedOnce.current = true;

    if (kpisRes.status === "fulfilled" && kpisRes.value) setKpis(kpisRes.value as KpiData);
    if (chartsRes.status === "fulfilled" && chartsRes.value) {
      const c = chartsRes.value as {
        faturamentoRecebimentos?: FinFaturamentoData[];
        fluxoCaixa?: FinFluxoCaixaData[];
        margem?: FinMargemData[];
        aging?: FinAgingData[];
        topDevedores?: FinTopDevedorData[];
      };
      if (c.faturamentoRecebimentos) setFatRecData(c.faturamentoRecebimentos);
      if (c.fluxoCaixa)               setFluxoData(c.fluxoCaixa);
      if (c.margem)                   setMargemData(c.margem);
      if (c.aging)                    setAgingData(c.aging);
      if (c.topDevedores)             setTopDevedoresFiltrado(c.topDevedores);
    }
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

        {/* ── Executive KPI Grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {kpiLoading ? (
            <>
              <div className="sm:col-span-2 xl:col-span-2 shimmer rounded-2xl" style={{ height: 195 }} />
              <div className="shimmer rounded-2xl" style={{ height: 195 }} />
              <div className="shimmer rounded-2xl" style={{ height: 195 }} />
              <div className="sm:col-span-2 xl:col-span-2 shimmer rounded-2xl" style={{ height: 148 }} />
              <div className="sm:col-span-2 xl:col-span-2 shimmer rounded-2xl" style={{ height: 148 }} />
            </>
          ) : kpis ? (
            <>
              <div className="sm:col-span-2 xl:col-span-2">
                <ResultadoCard kpis={kpis} pLabel={pLabel} />
              </div>
              <MetricCard
                label="Faturamento"
                value={fmtR(kpis.faturamentoMes)}
                variation={kpis.varFaturamento}
                sub={`${kpis.qtdVendasMes} vendas · TM ${fmtR(kpis.ticketMedioMes)}`}
                accent="var(--accent-cyan)"
                delay={60}
              />
              <MetricCard
                label="Recebido no período"
                value={fmtR(kpis.recebidoMes)}
                variation={kpis.varRecebido}
                sub={`${kpis.qtdRecebimentosMes} recebimento${kpis.qtdRecebimentosMes !== 1 ? "s" : ""}`}
                accent="#22c55e"
                delay={90}
              />
              <div className="sm:col-span-2 xl:col-span-2">
                <CarteiraCard kpis={kpis} pLabel={pLabel} />
              </div>
              <div className="sm:col-span-2 xl:col-span-2">
                <RiscoCard kpis={kpis} />
              </div>
            </>
          ) : null}
        </div>

        {/* ── Row 1: Faturamento vs Recebimentos + Margem ──────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ChartCard
            title="Faturamento vs Recebimentos"
            subtitle={`12 meses · ${pLabel} · linha amarela = taxa de recebimento (recebido ÷ faturado)`}
            animationDelay={100}
            info="O azul mostra o que foi faturado (emitido) em cada mês; o verde, o que realmente entrou no caixa. Quando o recebido fica abaixo do faturado, existe dinheiro ainda a receber de clientes. A linha amarela é a taxa de recebimento — idealmente próxima de 100%. Acima de 100% significa que foram recebidos valores de vendas de meses anteriores."
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
            info="A área azul é a receita total dos itens vendidos; a vermelha é o custo. O espaço entre as duas áreas é o lucro bruto de cada mês. A linha roxa mostra em porcentagem quanto sobra após os custos — margem caindo mês a mês indica aumento de custo ou desconto excessivo nos preços."
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
          info="Barras verdes mostram o dinheiro que entrou (recebimentos); barras vermelhas, o que saiu (despesas). A linha azul é o saldo do mês: positiva significa que as entradas superaram as saídas. Meses com linha abaixo de zero indicam que a empresa gastou mais do que recebeu — acompanhe a tendência para evitar consumir reservas."
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
            info="Divide os títulos vencidos e não pagos pelo tempo de atraso: amarelo = até 30 dias, laranja = 31–60 dias, vermelho = 61–90 dias, vermelho escuro = acima de 90 dias. Quanto mais antigo o vencimento, menor a probabilidade de recebimento. Clique numa faixa para ver quais clientes fazem parte daquele grupo no painel ao lado."
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
            info="Lista os clientes com maiores valores em aberto e vencidos. A barra mostra a proporção em relação ao maior devedor. A cor indica há quanto tempo o título está vencido: amarelo = até 30 dias, laranja = 31–60 dias, vermelho = 61–90 dias, vermelho escuro = acima de 90 dias. Priorize a cobrança de quem tem maior valor combinado com mais tempo em atraso."
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
