"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Boxes, Building2, RefreshCw, AlertCircle } from "lucide-react";
import { useLoja } from "@/lib/contexts/loja-context";
import { ChartCard } from "@/components/ui/ChartCard";
import { TopProgressBar } from "@/components/ui/TopProgressBar";
import type { ProdutosOverview, StatusEstoque } from "@/lib/db/produtos-estoque";
import { KpiCards } from "./KpiCards";
import { RankingDual, RankingQtd } from "./RankingBars";
import { SaudeDonut } from "./SaudeDonut";
import { AlertasCriticos } from "./AlertasCriticos";
import { MargemNegativaList, EstoqueNegativoList } from "./ProblemaLists";
import { AcaoTable } from "./AcaoTable";
import { FiltroChips, type ProdutosFilterState } from "./FiltroChips";
import { COR_VENDA } from "./utils";

const EMPTY_FILTERS: ProdutosFilterState = { marca: null, grupo: null, categoria: null, status: null };

export function ProdutosDashboard() {
  const { selectedLojaId, lojasDisponiveis, lojasSelecionadas } = useLoja();

  const lojaIds =
    lojasSelecionadas.length > 0 ? lojasSelecionadas
    : lojasDisponiveis.length > 0 ? lojasDisponiveis.map((l) => l.id)
    : selectedLojaId ? [selectedLojaId]
    : [];

  const [filters, setFilters] = useState<ProdutosFilterState>(EMPTY_FILTERS);
  const [data, setData] = useState<ProdutosOverview & { filiais: { empId: number; nome: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const fetchData = useCallback(async () => {
    if (lojaIds.length === 0) return;
    setRefreshing(true);
    if (!hasLoaded.current) setLoading(true);
    setError(null);

    const params = new URLSearchParams({ lojaIds: lojaIds.join(",") });
    if (filters.marca) params.set("marca", filters.marca);
    if (filters.grupo) params.set("grupo", filters.grupo);
    if (filters.categoria) params.set("categoria", filters.categoria);
    if (filters.status) params.set("status", filters.status);

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
  }, [lojaIds.join(","), filters]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // ── Toggles de cross-filter ──────────────────────────────────────────────────
  const toggle = <K extends keyof ProdutosFilterState>(key: K, value: ProdutosFilterState[K]) =>
    setFilters((f) => ({ ...f, [key]: f[key] === value ? null : value }));

  const toggleStatus = (s: StatusEstoque) => toggle("status", s);
  const removeFilter = (key: keyof ProdutosFilterState) => setFilters((f) => ({ ...f, [key]: null }));
  const clearFilters = () => setFilters(EMPTY_FILTERS);

  if (lojaIds.length === 0) return <SemLoja />;

  const multi = (data?.filiais.length ?? 0) > 1;

  return (
    <div className="px-3 py-4 sm:px-4 md:px-5 md:py-4 flex flex-col gap-4">
      <TopProgressBar loading={refreshing} />

      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ width: 38, height: 38, background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.2)" }}>
            <Boxes style={{ width: 20, height: 20, color: COR_VENDA }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.1 }}>Estoque &amp; Capital de Giro</h1>
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 999, background: "rgba(124,58,237,0.14)", color: "var(--accent-purple)", border: "1px solid rgba(124,58,237,0.25)" }}>
                PRO · PRODUTOS
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Diagnóstico de estoque, margem e reposição</p>
          </div>
        </div>

        {multi && (
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1"
            style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)" }}>
            <Building2 style={{ width: 13, height: 13, color: COR_VENDA }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)" }}>
              Consolidado · {data?.filiais.length} lojas
            </span>
          </div>
        )}
      </div>

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
        <div className="flex flex-col gap-4" style={{ opacity: refreshing ? 0.6 : 1, transition: "opacity 0.2s ease", pointerEvents: refreshing ? "none" : "auto" }}>

          <FiltroChips filters={filters} onRemove={removeFilter} onClear={clearFilters} />

          {/* KPIs */}
          <KpiCards kpis={data.kpis} activeStatus={filters.status} onStatusClick={toggleStatus} />

          {/* Linha 2 — diagnóstico */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <ChartCard title="Top Marcas por Valor em Estoque" subtitle="custo × venda · participação" animationDelay={60} className="h-full">
                <RankingDual items={data.topMarcasValor} selected={filters.marca} onSelect={(n) => toggle("marca", n)} />
              </ChartCard>
            </div>
            <div className="lg:col-span-4">
              <ChartCard title="Saúde do Estoque / Cadastro" subtitle="distribuição do cadastro por status" animationDelay={100} className="h-full"
                info="A rosca mostra a proporção de posições por status de estoque. Um volume alto de 'mínimo não informado' significa que a maior parte do catálogo não tem parâmetro de reposição — priorize cadastrar mínimos para habilitar a análise de cobertura.">
                <SaudeDonut kpis={data.kpis} activeStatus={filters.status} onStatusClick={toggleStatus} />
              </ChartCard>
            </div>
            <div className="lg:col-span-3">
              <ChartCard title="Alertas Críticos" subtitle="situações que exigem atenção" animationDelay={140} className="h-full">
                <AlertasCriticos kpis={data.kpis} activeStatus={filters.status} onStatusClick={toggleStatus} />
              </ChartCard>
            </div>
          </div>

          {/* Linha 3 — rankings */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            <ChartCard title="Quantidade em Estoque por Marca" subtitle="ranking por quantidade" animationDelay={60} className="h-full">
              <RankingQtd items={data.porMarcaQtd} selected={filters.marca} onSelect={(n) => toggle("marca", n)} />
            </ChartCard>
            <ChartCard title="Top Categorias por Valor em Estoque" subtitle="custo × venda · participação" animationDelay={100} className="h-full">
              <RankingDual items={data.topCategoriasValor} selected={filters.categoria} onSelect={(n) => toggle("categoria", n)} />
            </ChartCard>
            <ChartCard title="Quantidade em Estoque por Grupo" subtitle="ranking por quantidade" animationDelay={140} className="h-full">
              <RankingQtd items={data.porGrupoQtd} selected={filters.grupo} onSelect={(n) => toggle("grupo", n)} color="#a78bfa" />
            </ChartCard>
          </div>

          {/* Linha 4 — problemas + tabela */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <ChartCard title="Produtos com Margem Negativa" subtitle="ordenado por maior prejuízo" animationDelay={60} className="h-full">
                <MargemNegativaList items={data.margemNegativa} />
              </ChartCard>
            </div>
            <div className="lg:col-span-3">
              <ChartCard title="Produtos com Estoque Negativo" subtitle="saldo abaixo de zero" animationDelay={100} className="h-full">
                <EstoqueNegativoList items={data.estoqueNegativo} />
              </ChartCard>
            </div>
            <div className="lg:col-span-6">
              <ChartCard title="Produtos que Exigem Ação" subtitle="itens críticos ou fora do parâmetro — clique para detalhes" animationDelay={140} className="h-full">
                <AcaoTable items={data.exigeAcao} filiais={data.filiais} />
              </ChartCard>
            </div>
          </div>

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
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => <div key={i} className="skeleton-bar rounded-xl" style={{ height: 104 }} />)}
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-5 skeleton-bar rounded-2xl" style={{ height: 300 }} />
        <div className="lg:col-span-4 skeleton-bar rounded-2xl" style={{ height: 300 }} />
        <div className="lg:col-span-3 skeleton-bar rounded-2xl" style={{ height: 300 }} />
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton-bar rounded-2xl" style={{ height: 240 }} />)}
      </div>
      <div className="skeleton-bar rounded-2xl" style={{ height: 360 }} />
    </div>
  );
}
