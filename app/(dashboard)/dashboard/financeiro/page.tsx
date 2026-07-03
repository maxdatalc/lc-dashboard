"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  ArrowDownCircle, ArrowUpCircle, TrendingUp, HandCoins, ReceiptText,
} from "lucide-react";
import { useLoja } from "@/lib/contexts/loja-context";
import { usePeriod, computeRange, type Period } from "@/lib/contexts/period-context";
import { ChartCard } from "@/components/ui/ChartCard";
import { TopProgressBar } from "@/components/ui/TopProgressBar";
import { FinFluxoMensalChart } from "@/components/charts/FinFluxoMensalChart";
import { FinContasAbertoChart } from "@/components/charts/FinContasAbertoChart";
import { FinAnaliseTable, type AnaliseRow } from "@/components/charts/FinAnaliseTable";

// ─── Tipos da resposta do endpoint /overview ───────────────────────────────────

interface Filial { empId: number; nome: string; }
interface FlowKpi { empId: number; recebimentos: number; pagamentos: number; recebimentosPrev: number; pagamentosPrev: number; }
interface FluxoRow { mes: string; empId: number; recebimentos: number; pagamentos: number; }
interface AbertoRow { mes: string; empId: number; tipo: "R" | "P"; valor: number; vencido: number; aVencer: number; }
interface AnaliseApiRow { empId: number; plcId: number | null; plcDesc: string; tipo: "R" | "P"; valor: number; vencido: number; aVencer: number; }
interface PagPlanoRow { empId: number; plcId: number | null; plcDesc: string; valor: number; }

interface Overview {
  filiais: Filial[];
  meses: string[];
  periodo: { start: string; end: string; prevStart: string; prevEnd: string };
  flowKpis: FlowKpi[];
  fluxo: FluxoRow[];
  abertos: AbertoRow[];
  analise: AnaliseApiRow[];
  pagamentosPlano: PagPlanoRow[];
}

// ─── Utilitários ────────────────────────────────────────────────────────────────

// Valor completo, sem abreviação: R$ 3.680.297,90
function fmtFull(v: number): string {
  return `${v < 0 ? "-" : ""}R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function mesLabel(mes: string) {
  const [y, m] = mes.split("-");
  const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return `${meses[parseInt(m, 10) - 1]}/${y}`;
}
function periodLabel(period: Period, customRange: { start: Date; end: Date } | null): string {
  const fmtD = (d: Date) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
  switch (period) {
    case "today": return "Hoje";
    case "7d": return "7 dias";
    case "month": return "Mês atual";
    case "3m": return "3 meses";
    case "year": return "Ano atual";
    case "prev-year": return "Ano anterior";
    case "custom": return customRange ? `${fmtD(customRange.start)} – ${fmtD(customRange.end)}` : "Personalizado";
  }
}

// ─── Sem loja ─────────────────────────────────────────────────────────────────

function SemLoja() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="rounded-2xl p-10 text-center max-w-sm" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Selecione uma loja na barra lateral para visualizar os dados financeiros.
        </p>
      </div>
    </div>
  );
}

// ─── KPI cards ────────────────────────────────────────────────────────────────

const cardBase: React.CSSProperties = {
  background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16,
  padding: "16px 18px", height: "100%", position: "relative", overflow: "hidden",
  animation: "fadeInUp 0.4s ease-out both",
};

function IconBadge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${color} 14%, transparent)`, color, flexShrink: 0 }}>
      {children}
    </div>
  );
}
function KpiHead({ label, icon, color }: { label: string; icon: React.ReactNode; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>{label}</span>
      <IconBadge color={color}>{icon}</IconBadge>
    </div>
  );
}

function KpiSimple({ label, icon, color, value, footer, footerColor, delay = 0 }: {
  label: string; icon: React.ReactNode; color: string; value: string;
  footer: React.ReactNode; footerColor?: string; delay?: number;
}) {
  return (
    <div style={{ ...cardBase, animationDelay: `${delay}ms` }}>
      <KpiHead label={label} icon={icon} color={color} />
      <div style={{ fontSize: "clamp(15px, 1.32vw, 21px)", fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color, letterSpacing: "-0.02em", lineHeight: 1.05, whiteSpace: "nowrap", marginBottom: 8 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: footerColor ?? "var(--text-muted)", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>{footer}</div>
    </div>
  );
}

function KpiSplit({ label, icon, color, value, vencido, aVencer, delay = 0 }: {
  label: string; icon: React.ReactNode; color: string; value: string; vencido: string; aVencer: string; delay?: number;
}) {
  return (
    <div style={{ ...cardBase, animationDelay: `${delay}ms` }}>
      <KpiHead label={label} icon={icon} color={color} />
      <div style={{ fontSize: "clamp(15px, 1.3vw, 20px)", fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color, letterSpacing: "-0.02em", lineHeight: 1.05, whiteSpace: "nowrap", marginBottom: 12 }}>{value}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--border-subtle)", paddingTop: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)" }}>Vencido</span>
          <span style={{ fontSize: "clamp(11px, 0.85vw, 13px)", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "#ef4444", whiteSpace: "nowrap" }}>{vencido}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)" }}>A vencer</span>
          <span style={{ fontSize: "clamp(11px, 0.85vw, 13px)", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{aVencer}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Chip de filtro ativo ─────────────────────────────────────────────────────

function FilterChip({ label, color, onClear }: { label: string; color: string; onClear: () => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 11px", background: `color-mix(in srgb, ${color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`, borderRadius: 20, fontSize: 11.5, fontWeight: 600, color }}>
      {label}
      <button onClick={onClear} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1, display: "flex" }} aria-label="Remover filtro">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9.5 2.5l-7 7M2.5 2.5l7 7"/></svg>
      </button>
    </span>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const { selectedLojaId, lojasDisponiveis, lojasSelecionadas } = useLoja();
  const { period, customRange } = usePeriod();

  const lojaIds =
    lojasSelecionadas.length > 0 ? lojasSelecionadas
    : lojasDisponiveis.length > 0 ? lojasDisponiveis.map((l) => l.id)
    : selectedLojaId ? [selectedLojaId] : [];
  const lojaKey = lojaIds.join(",");

  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedOnce = useRef(false);

  // Cross-filter local (compõe com os filtros globais do header)
  const [fMes, setFMes] = useState<string | null>(null);
  const [fFilial, setFFilial] = useState<number | null>(null);

  function getRange(): { start: string; end: string } {
    if (period === "custom" && customRange) {
      return { start: customRange.start.toISOString().split("T")[0], end: customRange.end.toISOString().split("T")[0] };
    }
    if (period === "custom") return computeRange("month");
    return computeRange(period);
  }

  const fetchDados = useCallback(async () => {
    if (lojaIds.length === 0) return;
    setIsRefreshing(true);
    if (!hasLoadedOnce.current) setLoading(true);
    const { start, end } = getRange();
    const params = new URLSearchParams({ lojaIds: lojaKey, start, end });
    try {
      const res = await fetch(`/api/dashboard/financeiro/overview?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      hasLoadedOnce.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojaKey, period, customRange]);

  useEffect(() => { void fetchDados(); }, [fetchDados]);
  // Reseta cross-filter ao trocar loja/período (evita filtro órfão)
  useEffect(() => { setFMes(null); setFFilial(null); }, [lojaKey, period, customRange]);

  // ── Derivações (cross-filter client-side) ─────────────────────────────────
  const derived = useMemo(() => {
    if (!data) return null;
    const byFilial = <T extends { empId: number }>(rows: T[]) => fFilial == null ? rows : rows.filter((r) => r.empId === fFilial);

    // Fluxo mensal agregado (respeitando filial) — 12 meses
    const fluxoMap = new Map<string, { rec: number; pag: number }>();
    for (const m of data.meses) fluxoMap.set(m, { rec: 0, pag: 0 });
    for (const r of byFilial(data.fluxo)) {
      const e = fluxoMap.get(r.mes);
      if (e) { e.rec += r.recebimentos; e.pag += r.pagamentos; }
    }
    const fluxoChart = data.meses.map((mes) => {
      const e = fluxoMap.get(mes)!;
      return { mes, recebimentos: e.rec, pagamentos: e.pag, resultado: e.rec - e.pag };
    });

    // KPIs de fluxo (período) — respeitando filial; se mês selecionado, usa o mês
    let receb = 0, pag = 0, recebPrev = 0;
    for (const k of byFilial(data.flowKpis)) { receb += k.recebimentos; pag += k.pagamentos; recebPrev += k.recebimentosPrev; }
    if (fMes) {
      const cur = fluxoMap.get(fMes) ?? { rec: 0, pag: 0 };
      const idx = data.meses.indexOf(fMes);
      const prev = idx > 0 ? (fluxoMap.get(data.meses[idx - 1]) ?? { rec: 0, pag: 0 }) : { rec: 0, pag: 0 };
      receb = cur.rec; pag = cur.pag; recebPrev = prev.rec;
    }
    const resultado = receb - pag;
    const varReceb = recebPrev > 0 ? ((receb - recebPrev) / recebPrev) * 100 : null;
    const margem = receb > 0 ? (resultado / receb) * 100 : null;

    // Contas em aberto (respeitando filial). Se mês selecionado, KPIs A Receber/A Pagar usam o mês.
    const abertosF = byFilial(data.abertos);
    const somaAberto = (tipo: "R" | "P", mesOnly: boolean) => {
      let valor = 0, vencido = 0, aVencer = 0;
      for (const r of abertosF) {
        if (r.tipo !== tipo) continue;
        if (mesOnly && fMes && r.mes !== fMes) continue;
        valor += r.valor; vencido += r.vencido; aVencer += r.aVencer;
      }
      return { valor, vencido, aVencer };
    };
    const aReceberKpi = somaAberto("R", true);
    const aPagarKpi = somaAberto("P", true);

    // Chart Contas em Aberto: agrega por mês, janela de 8 meses mais próximos de hoje
    const abMap = new Map<string, { rVencido: number; rAVencer: number; pVencido: number; pAVencer: number }>();
    for (const r of abertosF) {
      let e = abMap.get(r.mes);
      if (!e) { e = { rVencido: 0, rAVencer: 0, pVencido: 0, pAVencer: 0 }; abMap.set(r.mes, e); }
      if (r.tipo === "R") { e.rVencido += r.vencido; e.rAVencer += r.aVencer; }
      else { e.pVencido += r.vencido; e.pAVencer += r.aVencer; }
    }
    const nowKey = new Date().toISOString().slice(0, 7);
    const nowIdx = (k: string) => { const [y, m] = k.split("-").map(Number); return y * 12 + (m - 1); };
    const baseIdx = nowIdx(nowKey);
    const contasAbertoChart = [...abMap.entries()]
      .map(([mes, v]) => ({ mes, ...v }))
      .sort((a, b) => Math.abs(nowIdx(a.mes) - baseIdx) - Math.abs(nowIdx(b.mes) - baseIdx))
      .slice(0, 8)
      .sort((a, b) => a.mes.localeCompare(b.mes));

    // Tabela de análise (agrupa por filial dentro do componente)
    const toRow = (r: AnaliseApiRow): AnaliseRow => ({ empId: r.empId, plcId: r.plcId, plcDesc: r.plcDesc, valor: r.valor, vencido: r.vencido, aVencer: r.aVencer });
    const aReceberTbl = data.analise.filter((r) => r.tipo === "R").map(toRow);
    const aPagarTbl = data.analise.filter((r) => r.tipo === "P").map(toRow);
    const pagamentosTbl: AnaliseRow[] = data.pagamentosPlano.map((r) => ({ empId: r.empId, plcId: r.plcId, plcDesc: r.plcDesc, valor: r.valor, vencido: 0, aVencer: 0 }));

    return {
      receb, pag, resultado, varReceb, margem,
      aReceberKpi, aPagarKpi,
      fluxoChart, contasAbertoChart,
      aReceberTbl, aPagarTbl, pagamentosTbl,
    };
  }, [data, fFilial, fMes]);

  if (lojaIds.length === 0) return <SemLoja />;

  const pLabel = periodLabel(period, customRange);
  const filialNome = fFilial != null ? data?.filiais.find((f) => f.empId === fFilial)?.nome ?? null : null;
  const temFiltro = fMes != null || fFilial != null;

  return (
    <div className="px-3 py-3 sm:px-4 md:px-5 md:py-3 flex flex-col gap-3">
      <TopProgressBar loading={isRefreshing} />

      <div className="flex flex-col gap-3" style={{ opacity: isRefreshing && hasLoadedOnce.current ? 0.55 : 1, transition: "opacity 0.2s ease", pointerEvents: isRefreshing && hasLoadedOnce.current ? "none" : "auto" }}>

        {/* Chips de filtro ativo */}
        {temFiltro && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Filtros ativos:</span>
            {fMes && <FilterChip label={`Mês: ${mesLabel(fMes)}`} color="var(--accent-cyan)" onClear={() => setFMes(null)} />}
            {fFilial != null && <FilterChip label={`Filial: ${filialNome}`} color="var(--accent-purple)" onClear={() => setFFilial(null)} />}
            <button onClick={() => { setFMes(null); setFFilial(null); }} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              Limpar tudo
            </button>
          </div>
        )}

        {/* ── Linha 1: KPIs ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {loading || !derived ? (
            Array.from({ length: 5 }).map((_, i) => <div key={i} className="shimmer rounded-2xl" style={{ height: 138 }} />)
          ) : (
            <>
              <KpiSimple
                label="Recebimentos" icon={<ArrowDownCircle size={18} />} color="var(--accent-cyan)"
                value={fmtFull(derived.receb)}
                footer={derived.varReceb != null
                  ? <><span style={{ color: derived.varReceb >= 0 ? "var(--accent-green)" : "#ef4444", fontWeight: 700 }}>{derived.varReceb >= 0 ? "↑" : "↓"} {Math.abs(derived.varReceb).toFixed(1)}%</span> vs período anterior</>
                  : "Sem base de comparação"}
                delay={0}
              />
              <KpiSimple
                label="Pagamentos" icon={<ArrowUpCircle size={18} />} color="#ef4444"
                value={fmtFull(derived.pag)}
                footer={`${derived.receb > 0 ? ((derived.pag / derived.receb) * 100).toFixed(1) : "0"}% dos recebimentos`}
                delay={40}
              />
              <KpiSimple
                label="Resultado Financeiro" icon={<TrendingUp size={18} />} color={derived.resultado >= 0 ? "var(--accent-green)" : "#ef4444"}
                value={fmtFull(derived.resultado)}
                footer={<>
                  <span>Margem: {derived.margem != null ? `${derived.margem.toFixed(1)}%` : "—"}</span>
                  <span style={{ marginLeft: 6, padding: "1px 7px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: derived.resultado >= 0 ? "color-mix(in srgb, var(--accent-green) 15%, transparent)" : "color-mix(in srgb, #ef4444 15%, transparent)", color: derived.resultado >= 0 ? "var(--accent-green)" : "#ef4444" }}>
                    {derived.resultado >= 0 ? "Positivo" : "Negativo"}
                  </span>
                </>}
                delay={80}
              />
              <KpiSplit
                label="A Receber" icon={<HandCoins size={18} />} color="var(--accent-cyan)"
                value={fmtFull(derived.aReceberKpi.valor)} vencido={fmtFull(derived.aReceberKpi.vencido)} aVencer={fmtFull(derived.aReceberKpi.aVencer)}
                delay={120}
              />
              <KpiSplit
                label="A Pagar" icon={<ReceiptText size={18} />} color="var(--accent-yellow)"
                value={fmtFull(derived.aPagarKpi.valor)} vencido={fmtFull(derived.aPagarKpi.vencido)} aVencer={fmtFull(derived.aPagarKpi.aVencer)}
                delay={160}
              />
            </>
          )}
        </div>

        {/* ── Linha 2: (Fluxo + Análise) / (Contas em Aberto + Saldo) ──────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

          {/* Coluna esquerda: Fluxo Mensal + Análise por Filial */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            <ChartCard
              title="Fluxo Financeiro Mensal"
              subtitle={`Últimos 12 meses · ${pLabel} · clique num mês para filtrar o painel`}
              animationDelay={100}
              info="Barras azuis são os recebimentos (dinheiro que entrou no caixa) e vermelhas os pagamentos (dinheiro que saiu), mês a mês. A linha verde é o resultado líquido — quando fica abaixo de zero, as saídas superaram as entradas naquele mês. Clique numa barra para filtrar os KPIs e demais painéis por aquele mês."
            >
              {loading || !derived ? <div className="shimmer rounded-lg w-full" style={{ height: 330 }} /> : (
                <FinFluxoMensalChart data={derived.fluxoChart} selectedMes={fMes} onMesClick={setFMes} />
              )}
            </ChartCard>

            <ChartCard
              title="Análise por Filial e Plano de Contas"
              subtitle="Títulos em aberto e pagamentos, agrupados por filial · clique na filial para filtrar"
              animationDelay={250}
              info="Detalha os valores por filial e plano de contas. Nas abas A Receber e A Pagar, os valores são de títulos em aberto, separados entre vencido e a vencer. Na aba Pagamentos, o valor é o realizado no período. Clique numa filial para filtrar todo o painel; use a seta para expandir os planos de contas."
            >
              {loading || !derived ? <div className="shimmer rounded-lg w-full" style={{ height: 320 }} /> : (
                <FinAnaliseTable
                  aReceber={derived.aReceberTbl}
                  aPagar={derived.aPagarTbl}
                  pagamentos={derived.pagamentosTbl}
                  filiais={data?.filiais ?? []}
                  selectedFilial={fFilial}
                  onFilialClick={setFFilial}
                />
              )}
            </ChartCard>
          </div>

          {/* Coluna direita: Contas em Aberto */}
          <div className="flex flex-col gap-3">
            <ChartCard
              title="Contas em Aberto"
              subtitle="Por mês de vencimento · a receber vs. a pagar"
              animationDelay={150}
              info="Compara, por mês de vencimento, o que a empresa tem a receber (azul) e a pagar (âmbar). O tom cheio de cada barra é a parte já vencida; o tom claro, a que ainda vai vencer. Serve para antecipar a pressão de caixa dos próximos meses."
            >
              {loading || !derived ? <div className="shimmer rounded-lg w-full" style={{ height: 240 }} /> : (
                <FinContasAbertoChart data={derived.contasAbertoChart} selectedMes={fMes} onMesClick={setFMes} />
              )}
            </ChartCard>
          </div>
        </div>

      </div>
    </div>
  );
}
