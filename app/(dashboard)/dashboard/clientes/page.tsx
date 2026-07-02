"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Users, UserMinus, UserPlus, Sparkles, RefreshCw, CreditCard } from "lucide-react";
import { useLoja } from "@/lib/contexts/loja-context";
import { usePeriod, computeRange, type Period } from "@/lib/contexts/period-context";
import { ChartCard } from "@/components/ui/ChartCard";
import { TopProgressBar } from "@/components/ui/TopProgressBar";
import { CliReceitaTipoChart } from "@/components/charts/CliReceitaTipoChart";
import { CliConversaoChart } from "@/components/charts/CliConversaoChart";
import { cidadeKey, SEM_CIDADE } from "@/components/charts/CliGeoRanking";
import { MapaClientesCard } from "@/components/charts/MapaClientesCard";
import { normNome } from "@/lib/utils/ibge-malhas";
import { CliLimitesRanking } from "@/components/charts/CliLimitesRanking";

// ─── Tipos da resposta do endpoint /overview ───────────────────────────────────

interface Filial { empId: number; nome: string; }
interface BaseRow { cidade: string; uf: string; cliTipo: number; ativo: boolean; qtde: number; limite: number; comLimite: number; }
interface MesCidadeRow { mes: string; cidade: string; qtde: number; }
interface ReceitaRow { mes: string; tipo: "R" | "N"; cidade: string; receita: number; }
interface CompradorRow { mes: string; tipo: "R" | "N"; cidade: string; qtde: number; }
interface VendasCidadeRow { mes: string; cidade: string; qtde: number; }
interface VendaClienteRow { cliId: number; nome: string; cidade: string; uf: string; mes: string; receita: number; vendas: number; }
interface LimiteRow { cliId: number; nome: string; valor: number; cidade: string; uf: string; }

interface Overview {
  filiais: Filial[];
  meses: string[];
  periodo: { start: string; end: string; prevStart: string; prevEnd: string };
  base: BaseRow[];
  semCompra90: number;
  cadastros: MesCidadeRow[];
  cadastrosKpi: { atual: number; anterior: number };
  primeira: MesCidadeRow[];
  primeiraKpi: { atual: number; anterior: number };
  receita: ReceitaRow[];
  compradores: CompradorRow[];
  vendasPorCidade: VendasCidadeRow[];
  vendasPorCliente: VendaClienteRow[];
  recorrenciaKpi: { totalComp: number; recorrentes: number; totalPrev: number; recorrentesPrev: number };
  limites: LimiteRow[];
}

// ─── Utilitários ────────────────────────────────────────────────────────────────

function abbr(v: number): string {
  const s = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${s}R$ ${(a / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  if (a >= 1_000)     return `${s}R$ ${(a / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} mil`;
  return `${s}R$ ${a.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}
function num(v: number) { return v.toLocaleString("pt-BR"); }
function pct(v: number, casas = 1) { return `${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`; }
/** Chave estável de município: nome normalizado (sem acento/caixa) + UF, para não
 *  fragmentar a mesma cidade por grafia divergente (ex.: "Marabá" vs "MARABA") nem
 *  colidir cidades homônimas de estados diferentes. */
function muniKey(cidade: string, uf: string) {
  return cidade ? `${normNome(cidade)}|${(uf || "").toUpperCase()}` : SEM_CIDADE;
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
          Selecione uma loja na barra superior para visualizar o painel de clientes.
        </p>
      </div>
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

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

function KpiCard({ label, icon, color, value, footer, footerColor, delay = 0 }: {
  label: string; icon: React.ReactNode; color: string; value: string;
  footer: React.ReactNode; footerColor?: string; delay?: number;
}) {
  return (
    <div style={{ ...cardBase, animationDelay: `${delay}ms` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>{label}</span>
        <IconBadge color={color}>{icon}</IconBadge>
      </div>
      <div style={{ fontSize: 27, fontWeight: 800, fontFamily: "var(--font-mono, monospace)", color, letterSpacing: "-0.03em", lineHeight: 1, whiteSpace: "nowrap", marginBottom: 8 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: footerColor ?? "var(--text-muted)", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>{footer}</div>
    </div>
  );
}

function Delta({ atual, anterior }: { atual: number; anterior: number }) {
  if (anterior <= 0) return <span>Sem base de comparação</span>;
  const v = ((atual - anterior) / anterior) * 100;
  const up = v >= 0;
  return <><span style={{ color: up ? "var(--accent-green)" : "#ef4444", fontWeight: 700 }}>{up ? "↑" : "↓"} {pct(Math.abs(v))}</span> vs período anterior</>;
}

// ─── Chip de filtro ativo ─────────────────────────────────────────────────────

function FilterChip({ label, color, onClear }: { label: string; color: string; onClear: () => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 11px", background: `color-mix(in srgb, ${color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`, borderRadius: 20, fontSize: 11.5, fontWeight: 600, color, animation: "fadeInUp 0.25s ease-out both" }}>
      {label}
      <button onClick={onClear} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1, display: "flex" }} aria-label="Remover filtro">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9.5 2.5l-7 7M2.5 2.5l7 7"/></svg>
      </button>
    </span>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ClientesPage() {
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

  // Cross-filter local (compõe com os filtros globais do header — nunca os sobrescreve)
  const [fMes, setFMes] = useState<string | null>(null);
  const [fCidade, setFCidade] = useState<string | null>(null);
  const [fCliente, setFCliente] = useState<number | null>(null);

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
      const res = await fetch(`/api/dashboard/clientes/overview?${params}`);
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
  useEffect(() => { setFMes(null); setFCidade(null); setFCliente(null); }, [lojaKey, period, customRange]);

  // ── Derivações (cross-filter client-side) ─────────────────────────────────
  const derived = useMemo(() => {
    if (!data) return null;

    const cidadeOk = (c: string) => !fCidade || cidadeKey(c) === fCidade;
    const startMonth = data.periodo.start.slice(0, 7);
    const endMonth = data.periodo.end.slice(0, 7);
    const periodMonths = data.meses.filter((m) => m >= startMonth && m <= endMonth);
    const inPeriodo = (m: string) => (fMes ? m === fMes : periodMonths.includes(m));
    const noFiltro = fMes == null && fCidade == null;

    // — Base de clientes (responde a cidade; é um retrato, não tem dimensão de mês)
    const baseF = data.base.filter((r) => cidadeOk(r.cidade));
    let ativos = 0, inativos = 0, limiteTotal = 0, comLimite = 0;
    for (const r of baseF) {
      if (r.ativo) { ativos += r.qtde; limiteTotal += r.limite; comLimite += r.comLimite; }
      else inativos += r.qtde;
    }
    const totalBase = ativos + inativos;

    // Geo (base ativa por cidade) — sempre visível; a seleção só destaca.
    // Agrupa por muniKey (nome normalizado + UF) para não fragmentar a mesma
    // cidade por grafia divergente; exibe a grafia mais frequente do grupo.
    const geoMap = new Map<string, { cidade: string; uf: string; qtde: number; dom: number }>();
    let totalBaseAtivos = 0;
    for (const r of data.base) {
      if (!r.ativo) continue;
      totalBaseAtivos += r.qtde;
      const k = muniKey(r.cidade, r.uf);
      const e = geoMap.get(k);
      if (e) {
        e.qtde += r.qtde;
        if (r.qtde > e.dom) { e.cidade = r.cidade; e.uf = r.uf; e.dom = r.qtde; }
      } else {
        geoMap.set(k, { cidade: r.cidade, uf: r.uf, qtde: r.qtde, dom: r.qtde });
      }
    }
    const geo = [...geoMap.values()].map(({ cidade, uf, qtde }) => ({ cidade, uf, qtde }));

    // — Séries mensais (respeitam cidade; mês só destaca, não remove)
    const sumBy = (rows: { mes: string; qtde: number }[], m: string) =>
      rows.filter((r) => r.mes === m && cidadeOk((r as MesCidadeRow).cidade)).reduce((s, r) => s + r.qtde, 0);

    const receitaChart = data.meses.map((mes) => {
      let rec = 0, nao = 0;
      for (const r of data.receita) {
        if (r.mes !== mes || !cidadeOk(r.cidade)) continue;
        if (r.tipo === "R") rec += r.receita; else nao += r.receita;
      }
      return { mes, recorrentes: rec, naoRecorrentes: nao, vendaLiquida: rec + nao };
    });

    const conversaoChart = data.meses.map((mes) => {
      const cad = sumBy(data.cadastros, mes);
      const pc = sumBy(data.primeira, mes);
      return { mes, cadastros: cad, primeiraCompra: pc, conversao: cad > 0 ? (pc / cad) * 100 : null };
    });

    // — KPIs de período (usam escalar quando não há cross-filter; senão recalculam da série)
    const cadastrosVal = noFiltro
      ? data.cadastrosKpi.atual
      : data.cadastros.filter((r) => inPeriodo(r.mes) && cidadeOk(r.cidade)).reduce((s, r) => s + r.qtde, 0);

    const primeiraVal = noFiltro
      ? data.primeiraKpi.atual
      : data.primeira.filter((r) => inPeriodo(r.mes) && cidadeOk(r.cidade)).reduce((s, r) => s + r.qtde, 0);

    let recTotal: number, recRecorrentes: number;
    if (noFiltro) {
      recTotal = data.recorrenciaKpi.totalComp;
      recRecorrentes = data.recorrenciaKpi.recorrentes;
    } else {
      recTotal = 0; recRecorrentes = 0;
      for (const r of data.compradores) {
        if (!inPeriodo(r.mes) || !cidadeOk(r.cidade)) continue;
        recTotal += r.qtde;
        if (r.tipo === "R") recRecorrentes += r.qtde;
      }
    }
    const taxaRecorrencia = recTotal > 0 ? (recRecorrentes / recTotal) * 100 : 0;
    const taxaRecorrenciaPrev = data.recorrenciaKpi.totalPrev > 0 ? (data.recorrenciaKpi.recorrentesPrev / data.recorrenciaKpi.totalPrev) * 100 : 0;

    // — Badges de insight (sobre o período)
    let recPeriodo = 0, receitaPeriodo = 0;
    for (const r of data.receita) {
      if (!inPeriodo(r.mes) || !cidadeOk(r.cidade)) continue;
      receitaPeriodo += r.receita;
      if (r.tipo === "R") recPeriodo += r.receita;
    }
    const pctReceitaRecorrente = receitaPeriodo > 0 ? (recPeriodo / receitaPeriodo) * 100 : null;

    let cadPeriodo = 0, pcPeriodo = 0;
    for (const r of conversaoChart) { if (inPeriodo(r.mes)) { cadPeriodo += r.cadastros; pcPeriodo += r.primeiraCompra; } }
    const conversaoMedia = cadPeriodo > 0 ? (pcPeriodo / cadPeriodo) * 100 : null;

    // — Limites (ranking respeita cidade)
    const limitesF = data.limites.filter((l) => cidadeOk(l.cidade));

    // — Vendas por cliente no período (respeita fMes, mas NÃO fCidade) — alimenta
    // o Top 10 Clientes do mapa (por estado e por município) e os totais de
    // vendas/faturamento por nível geográfico.
    const clienteMap = new Map<number, { cliId: number; nome: string; cidade: string; uf: string; receita: number; vendas: number }>();
    for (const r of (data.vendasPorCliente ?? [])) {
      if (!inPeriodo(r.mes)) continue;
      let e = clienteMap.get(r.cliId);
      if (!e) {
        e = { cliId: r.cliId, nome: r.nome, cidade: r.cidade, uf: r.uf, receita: 0, vendas: 0 };
        clienteMap.set(r.cliId, e);
      }
      e.receita += r.receita;
      e.vendas += r.vendas;
    }
    const clientesAgg = [...clienteMap.values()];

    return {
      ativos, inativos, totalBase, limiteTotal, comLimite,
      geo, totalBaseAtivos, clientesAgg,
      receitaChart, conversaoChart,
      cadastrosVal, primeiraVal, taxaRecorrencia, taxaRecorrenciaPrev,
      pctReceitaRecorrente, conversaoMedia,
      limitesF, noFiltro,
    };
  }, [data, fMes, fCidade]);

  if (lojaIds.length === 0) return <SemLoja />;

  const pLabel = periodLabel(period, customRange);
  const temFiltro = fMes != null || fCidade != null;
  const cidadeChipLabel = fCidade === SEM_CIDADE ? "Sem cidade" : fCidade;

  return (
    <div className="px-3 py-3 sm:px-4 md:px-5 md:py-3 flex flex-col gap-3">
      <TopProgressBar loading={isRefreshing} />

      <div className="flex flex-col gap-3" style={{ opacity: isRefreshing && hasLoadedOnce.current ? 0.55 : 1, transition: "opacity 0.2s ease", pointerEvents: isRefreshing && hasLoadedOnce.current ? "none" : "auto" }}>

        {/* Chips de filtro ativo */}
        {temFiltro && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Filtros ativos:</span>
            {fMes && <FilterChip label={`Mês: ${mesLabel(fMes)}`} color="var(--accent-cyan)" onClear={() => setFMes(null)} />}
            {fCidade && <FilterChip label={`Cidade: ${cidadeChipLabel}`} color="var(--accent-purple)" onClear={() => setFCidade(null)} />}
            <button onClick={() => { setFMes(null); setFCidade(null); }} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              Limpar filtros
            </button>
          </div>
        )}

        {/* ── Linha 1: KPIs ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {loading || !derived ? (
            Array.from({ length: 6 }).map((_, i) => <div key={i} className="shimmer rounded-2xl" style={{ height: 138 }} />)
          ) : (
            <>
              <KpiCard
                label="Clientes Ativos" icon={<Users size={18} />} color="var(--accent-cyan)"
                value={num(derived.ativos)}
                footer={<>
                  <span>{derived.totalBase > 0 ? pct((derived.ativos / derived.totalBase) * 100) : "0%"} da base{fCidade ? "" : " total"}</span>
                  {derived.cadastrosVal > 0 && <span style={{ color: "var(--accent-green)", fontWeight: 700 }}>+{num(derived.cadastrosVal)} novos</span>}
                </>}
                delay={0}
              />
              <KpiCard
                label="Clientes Inativos" icon={<UserMinus size={18} />} color="var(--accent-yellow)"
                value={num(derived.inativos)}
                footer={<>
                  <span>{derived.totalBase > 0 ? pct((derived.inativos / derived.totalBase) * 100) : "0%"} da base</span>
                  {!fCidade && data && data.semCompra90 > 0 && <span style={{ color: "var(--text-muted)" }}>· {num(data.semCompra90)} sem compra há 90 dias</span>}
                </>}
                delay={40}
              />
              <KpiCard
                label="Novos Cadastros" icon={<UserPlus size={18} />} color="var(--accent-green)"
                value={num(derived.cadastrosVal)}
                footer={derived.noFiltro && data ? <Delta atual={data.cadastrosKpi.atual} anterior={data.cadastrosKpi.anterior} /> : <span>no período filtrado</span>}
                delay={80}
              />
              <KpiCard
                label="Primeira Compra" icon={<Sparkles size={18} />} color="var(--accent-cyan)"
                value={num(derived.primeiraVal)}
                footer={<span>compraram pela 1ª vez no período</span>}
                delay={120}
              />
              <KpiCard
                label="Taxa de Recorrência" icon={<RefreshCw size={18} />} color="var(--accent-purple)"
                value={pct(derived.taxaRecorrencia)}
                footer={derived.noFiltro
                  ? (derived.taxaRecorrenciaPrev > 0
                      ? <Delta atual={derived.taxaRecorrencia} anterior={derived.taxaRecorrenciaPrev} />
                      : <span>clientes com mais de 1 compra</span>)
                  : <span>no período filtrado</span>}
                delay={160}
              />
              <KpiCard
                label="Limite de Crédito" icon={<CreditCard size={18} />} color="var(--accent-cyan)"
                value={derived.limiteTotal > 0 ? abbr(derived.limiteTotal) : "R$ 0"}
                footer={derived.limiteTotal > 0
                  ? <span>{num(derived.comLimite)} cliente{derived.comLimite !== 1 ? "s" : ""} com limite</span>
                  : <span>Sem limites definidos · preparado</span>}
                delay={200}
              />
            </>
          )}
        </div>

        {/* ── Linha 2: Receita por Tipo + Conversão ──────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ChartCard
            title="Receita por Tipo de Cliente"
            subtitle={`recorrentes × não recorrentes · venda líquida mensal · ${pLabel}`}
            animationDelay={100}
            info="Barras empilhadas com a receita líquida mensal separada entre clientes recorrentes (azul) e não recorrentes (âmbar); a linha verde é a venda líquida total do mês. Recorrente = cliente com mais de uma compra finalizada. Clique numa barra para filtrar todo o painel por aquele mês."
          >
            {loading || !derived ? <div className="shimmer rounded-lg w-full" style={{ height: 330 }} /> : (
              <>
                {derived.pctReceitaRecorrente != null && (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--accent-cyan)", padding: "3px 10px", borderRadius: 20, background: "color-mix(in srgb, var(--accent-cyan) 12%, transparent)" }}>
                      Recorrentes representam {pct(derived.pctReceitaRecorrente, 0)} da receita
                    </span>
                  </div>
                )}
                <CliReceitaTipoChart data={derived.receitaChart} selectedMes={fMes} onMesClick={setFMes} />
              </>
            )}
          </ChartCard>

          <ChartCard
            title="Conversão de Novos Clientes"
            subtitle="cadastros × clientes que compraram pela primeira vez"
            animationDelay={150}
            info="Compara os novos cadastros de cada mês (barras) com quantos clientes fizeram a primeira compra (linha). A primeira compra pode incluir clientes cadastrados antes do período, então em alguns meses ela pode superar os cadastros daquele mês. Clique num mês para filtrar o painel."
          >
            {loading || !derived ? <div className="shimmer rounded-lg w-full" style={{ height: 330 }} /> : (
              <>
                {derived.conversaoMedia != null && (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--accent-green)", padding: "3px 10px", borderRadius: 20, background: "color-mix(in srgb, var(--accent-green) 12%, transparent)" }}>
                      Conversão média: {pct(derived.conversaoMedia, 0)}
                    </span>
                  </div>
                )}
                <CliConversaoChart data={derived.conversaoChart} selectedMes={fMes} onMesClick={setFMes} />
              </>
            )}
          </ChartCard>
        </div>

        {/* ── Linha 3: Mapa Geográfico + Maiores Limites ─────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-3">
            <ChartCard
              title="Distribuição Geográfica da Base"
              subtitle="clientes ativos por estado e município · clique para explorar"
              animationDelay={200}
              info="Mapa do Brasil com divisas oficiais (IBGE) colorido pela concentração de clientes. Clique num estado para ver o resumo, o Top 10 clientes e as divisas dos municípios; clique num município para ver clientes, faturamento, vendas/OS e o Top 10 clientes locais — isso filtra todo o painel. O ranking completo fica no colapsável abaixo do mapa."
            >
              {loading || !derived ? <div className="shimmer rounded-lg w-full" style={{ height: 430 }} /> : (
                <MapaClientesCard data={derived.geo} totalBase={derived.totalBaseAtivos} selectedCidade={fCidade} onSelect={setFCidade} clientesAgg={derived.clientesAgg} />
              )}
            </ChartCard>
          </div>

          <div className="lg:col-span-2">
            <ChartCard
              title="Maiores Limites de Crédito"
              subtitle="top clientes e concentração de risco"
              animationDelay={250}
              info="Ranking dos clientes com maior limite de crédito concedido e o quanto o Top 10 concentra do limite total. Clique num cliente para destacá-lo. O limite vem do cadastro do cliente no ERP — quando não há limites definidos, o card fica preparado para quando passarem a ser usados."
            >
              {loading || !derived ? <div className="shimmer rounded-lg w-full" style={{ height: 320 }} /> : (
                <CliLimitesRanking data={derived.limitesF} selectedCliId={fCliente} onSelect={setFCliente} />
              )}
            </ChartCard>
          </div>
        </div>

      </div>
    </div>
  );
}
