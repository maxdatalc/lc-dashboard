"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Boxes, Building2, RefreshCw, AlertCircle } from "lucide-react";
import { useLoja } from "@/lib/contexts/loja-context";
import { ChartCard } from "@/components/ui/ChartCard";
import { TopProgressBar } from "@/components/ui/TopProgressBar";
import type { ProdutosOverview, StatusEstoque, ClasseAbc } from "@/lib/db/produtos-estoque";
import { KpiCards } from "./KpiCards";
import { RankingDual } from "./RankingBars";
import { RankingToggleCard } from "./RankingToggleCard";
import { SaudeDonut } from "./SaudeDonut";
import { AlertasCriticos } from "./AlertasCriticos";
import { CurvaAbcCard } from "./CurvaAbcCard";
import { ProdutosParadosRanking } from "./ProdutosParadosRanking";
import { GiroSelector } from "./GiroSelector";
import { AcaoTable } from "./AcaoTable";
import { FiltroChips, type ProdutosFilterState } from "./FiltroChips";
import { COR_VENDA } from "./utils";

const EMPTY_FILTERS: ProdutosFilterState = {
  marca: null, grupo: null, categoria: null, status: null, classeAbc: null, parado: false,
};

// Alturas fixas por linha do grid — cards da mesma linha ficam sempre alinhados;
// conteúdo que exceder rola por dentro do próprio card (nunca estica o layout).
const ROW2_HEIGHT = 320; // Top Marcas | Saúde do Estoque | Alertas Críticos
const ROW3_HEIGHT = 320; // Curva ABC & Ranking (unificado) | Produtos Parados
const ROW4_HEIGHT = 380; // Produtos que Exigem Ação

export function ProdutosDashboard() {
  const { selectedLojaId, lojasDisponiveis, lojasSelecionadas } = useLoja();

  const lojaIds =
    lojasSelecionadas.length > 0 ? lojasSelecionadas
    : lojasDisponiveis.length > 0 ? lojasDisponiveis.map((l) => l.id)
    : selectedLojaId ? [selectedLojaId]
    : [];

  const [filters, setFilters] = useState<ProdutosFilterState>(EMPTY_FILTERS);
  const [dias, setDias] = useState(90);
  const [data, setData] = useState<ProdutosOverview & { filiais: { empId: number; nome: string }[]; dias: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const fetchData = useCallback(async () => {
    if (lojaIds.length === 0) return;
    setRefreshing(true);
    if (!hasLoaded.current) setLoading(true);
    setError(null);

    const params = new URLSearchParams({ lojaIds: lojaIds.join(","), dias: String(dias) });
    if (filters.marca) params.set("marca", filters.marca);
    if (filters.grupo) params.set("grupo", filters.grupo);
    if (filters.categoria) params.set("categoria", filters.categoria);
    if (filters.status) params.set("status", filters.status);
    if (filters.classeAbc) params.set("classeAbc", filters.classeAbc);
    if (filters.parado) params.set("parado", "1");

    try {
      const res = await fetch(`/api/dashboard/produtos/overview?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      setData(await res.json());
      hasLoaded.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar os dados");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojaIds.join(","), filters, dias]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // ── Toggles de cross-filter ──────────────────────────────────────────────────
  const toggle = <K extends keyof ProdutosFilterState>(key: K, value: ProdutosFilterState[K]) =>
    setFilters((f) => ({ ...f, [key]: f[key] === value ? null : value }));

  const toggleStatus = (s: StatusEstoque) => toggle("status", s);
  const toggleClasseAbc = (c: ClasseAbc) => toggle("classeAbc", c);
  const toggleParado = () => setFilters((f) => ({ ...f, parado: !f.parado }));
  const removeFilter = (key: keyof ProdutosFilterState) =>
    setFilters((f) => ({ ...f, [key]: key === "parado" ? false : null }));
  const clearFilters = () => setFilters(EMPTY_FILTERS);

  if (lojaIds.length === 0) return <SemLoja />;

  const multi = (data?.filiais.length ?? 0) > 1;

  return (
    <div className="px-3 py-3 sm:px-4 md:px-5 md:py-3 flex flex-col gap-3">
      <TopProgressBar loading={refreshing} />

      {/* Indicador de consolidação multiloja — só aparece quando relevante */}
      {multi && (
        <div className="flex justify-end">
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1"
            style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)" }}>
            <Building2 style={{ width: 12, height: 12, color: COR_VENDA }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>
              Consolidado · {data?.filiais.length} lojas
            </span>
          </div>
        </div>
      )}

      {/* Erro */}
      {error && !loading && (
        <div className="flex items-center gap-3 rounded-xl p-4" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <AlertCircle style={{ width: 18, height: 18, color: "#ef4444", flexShrink: 0 }} />
          <div className="flex-1">
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Não foi possível carregar os produtos</p>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{error}</p>
          </div>
          <button type="button" onClick={() => fetchData()} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", cursor: "pointer" }}>
            <RefreshCw style={{ width: 13, height: 13 }} /> Tentar novamente
          </button>
        </div>
      )}

      {loading ? (
        <Skeleton />
      ) : data ? (
        <div className="flex flex-col gap-3" style={{ opacity: refreshing ? 0.6 : 1, transition: "opacity 0.2s ease", pointerEvents: refreshing ? "none" : "auto" }}>

          <FiltroChips filters={filters} onRemove={removeFilter} onClear={clearFilters} />

          {/* KPIs */}
          <KpiCards
            kpis={data.kpis} activeStatus={filters.status} onStatusClick={toggleStatus}
            paradoAtivo={filters.parado} onParadoClick={toggleParado}
          />

          {/* Linha 2 — diagnóstico (altura uniforme, scroll interno quando precisar) */}
          <div className="grid gap-3 grid-cols-1 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5">
              <ChartCard title="Top Marcas por Valor em Estoque" subtitle="custo × venda · participação" animationDelay={60}
                bodyStyle={{ height: ROW2_HEIGHT, overflowY: "auto" }} bodyClassName="custom-scroll">
                <RankingDual items={data.topMarcasValor} selected={filters.marca} onSelect={(n) => toggle("marca", n)} />
              </ChartCard>
            </div>
            <div className="lg:col-span-4">
              <ChartCard title="Saúde do Estoque / Cadastro" subtitle="distribuição do cadastro por status" animationDelay={100}
                info="A rosca mostra a proporção de posições por status de estoque. Um volume alto de 'mínimo não informado' significa que a maior parte do catálogo não tem parâmetro de reposição — priorize cadastrar mínimos para habilitar a análise de cobertura."
                bodyStyle={{ height: ROW2_HEIGHT, overflowY: "auto" }} bodyClassName="custom-scroll">
                <SaudeDonut kpis={data.kpis} activeStatus={filters.status} onStatusClick={toggleStatus} />
              </ChartCard>
            </div>
            <div className="lg:col-span-3">
              <ChartCard title="Alertas Críticos" subtitle="situações que exigem atenção" animationDelay={140}
                bodyStyle={{ height: ROW2_HEIGHT, overflowY: "auto" }} bodyClassName="custom-scroll">
                <AlertasCriticos
                  kpis={data.kpis} activeStatus={filters.status} onStatusClick={toggleStatus}
                  paradoAtivo={filters.parado} onParadoClick={toggleParado}
                />
              </ChartCard>
            </div>
          </div>

          {/* Seletor de janela de giro — afeta só os cards baseados em venda abaixo */}
          <GiroSelector dias={dias} onChange={setDias} />

          {/* Linha 3 — Curva ABC unificada com o ranking + Produtos Parados */}
          <div className="grid gap-3 grid-cols-1 lg:grid-cols-12 items-start">
            <div className="lg:col-span-8">
              <ChartCard title="Curva ABC & Ranking por Volume" subtitle={`por faturamento — últimos ${dias} dias · clique numa classe para detalhar o ranking ao lado`} animationDelay={60}
                info="Classifica os produtos pela participação no faturamento: A = até 80% acumulado, B = até 95%, C = o restante; 'Sem giro' são produtos ativos sem nenhuma venda na janela. Clique numa classe para filtrar todo o painel — o ranking ao lado passa a mostrar apenas marcas, categorias e grupos daquela classe."
                bodyStyle={{ height: ROW3_HEIGHT }} bodyClassName="abc-unified-body">
                <div className="flex flex-col lg:flex-row gap-4 h-full min-h-0">
                  <div className="custom-scroll flex-1 min-w-0" style={{ overflowY: "auto" }}>
                    <CurvaAbcCard resumo={data.curvaAbc} selected={filters.classeAbc} onSelect={toggleClasseAbc} />
                  </div>
                  <div className="hidden lg:block w-px self-stretch flex-shrink-0" style={{ background: "var(--border-subtle)" }} />
                  <div className="flex-1 min-w-0 min-h-0">
                    <RankingToggleCard
                      porMarcaQtd={data.porMarcaQtd} selectedMarca={filters.marca} onSelectMarca={(n) => toggle("marca", n)}
                      topCategoriasValor={data.topCategoriasValor} selectedCategoria={filters.categoria} onSelectCategoria={(n) => toggle("categoria", n)}
                      porGrupoQtd={data.porGrupoQtd} selectedGrupo={filters.grupo} onSelectGrupo={(n) => toggle("grupo", n)}
                    />
                  </div>
                </div>
              </ChartCard>
            </div>
            <div className="lg:col-span-4">
              <ChartCard title="Produtos Parados" subtitle={`capital sem giro — últimos ${dias} dias`} animationDelay={100}
                bodyStyle={{ height: ROW3_HEIGHT, overflowY: "auto" }} bodyClassName="custom-scroll">
                <ProdutosParadosRanking items={data.produtosParados} />
              </ChartCard>
            </div>
          </div>

          {/* Linha 4 — ação (a tabela rola por dentro, cabeçalho fixo) */}
          <ChartCard title="Produtos que Exigem Ação" subtitle="itens críticos ou fora do parâmetro — clique para detalhes" animationDelay={60}
            bodyStyle={{ height: ROW4_HEIGHT, overflow: "hidden" }}>
            <AcaoTable items={data.exigeAcao} filiais={data.filiais} />
          </ChartCard>

        </div>
      ) : null}
    </div>
  );
}

// ── Estados ──────────────────────────────────────────────────────────────────

function SemLoja() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="rounded-2xl p-10 text-center max-w-sm" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
        <Boxes style={{ width: 32, height: 32, color: "var(--text-muted)", margin: "0 auto 12px" }} />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Selecione uma loja na barra superior para visualizar o estoque.</p>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton-bar rounded-2xl" style={{ height: 104 }} />)}
      </div>
      <div className="grid gap-3 grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-5 skeleton-bar rounded-2xl" style={{ height: 300 }} />
        <div className="lg:col-span-4 skeleton-bar rounded-2xl" style={{ height: 300 }} />
        <div className="lg:col-span-3 skeleton-bar rounded-2xl" style={{ height: 300 }} />
      </div>
      <div className="grid gap-3 grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-8 skeleton-bar rounded-2xl" style={{ height: 320 }} />
        <div className="lg:col-span-4 skeleton-bar rounded-2xl" style={{ height: 320 }} />
      </div>
      <div className="skeleton-bar rounded-2xl" style={{ height: 380 }} />
    </div>
  );
}
