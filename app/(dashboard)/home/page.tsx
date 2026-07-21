"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Landmark,
  Users,
  Package,
} from "lucide-react";
import { useLoja } from "@/lib/contexts/loja-context";
import { useEmpresa } from "@/lib/contexts/empresa-context";
import { usePeriod, computeRange } from "@/lib/contexts/period-context";
import { formatCurrency, formatNumber } from "@/lib/utils/format";
import { ChartCard } from "@/components/ui/ChartCard";
import { TopProgressBar } from "@/components/ui/TopProgressBar";
import { UpgradeModal } from "@/components/home/UpgradeModal";
import { KpiTile } from "@/components/ui/KpiTile";
import { AnalyticalCard, type AnalyticalRow } from "@/components/home/AnalyticalCard";
import { RankingVendedores } from "@/components/home/RankingVendedores";
import { EvolucaoFaturamentoChart, type EvolucaoPoint } from "@/components/home/EvolucaoFaturamentoChart";
import { type HomeSummaryResponse, type StatusLevel } from "@/components/home/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHHMM(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function toLocalStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ w, h = 10 }: { w: string | number; h?: number }) {
  return <div className="skeleton-bar shrink-0" style={{ width: w, height: h, borderRadius: 6 }} />;
}

function SkCard({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      className="rounded-2xl"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", ...style }}
    >
      {children}
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <SkCard style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        <Sk w={160} h={12} />
        <Sk w={240} h={26} />
        <Sk w="60%" h={12} />
      </SkCard>
      <div className="flex gap-3 flex-wrap">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkCard key={i} style={{ flex: 1, minWidth: 150, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <Sk w={90} h={10} />
            <Sk w={120} h={24} />
            <Sk w={80} h={10} />
          </SkCard>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <SkCard style={{ gridColumn: "span 2", padding: 20, height: 260 }} />
        <SkCard style={{ padding: 20, height: 260 }} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkCard key={i} style={{ padding: 20, height: 210 }} />
        ))}
      </div>
    </div>
  );
}

// ─── Sem loja ─────────────────────────────────────────────────────────────────

function SemLoja() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div
        className="rounded-2xl p-10 text-center max-w-sm"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Selecione uma loja na barra lateral para ver os dados.
        </p>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function HomePage() {
  const { selectedLojaId, lojasDisponiveis, lojasSelecionadas } = useLoja();
  const { period, customRange } = usePeriod();
  const { hasFeature } = useEmpresa();
  const router = useRouter();
  const podeVerVisaoGeral = hasFeature("dashboard_visao_geral");

  const [data, setData] = useState<HomeSummaryResponse | null>(null);
  const [evolucao, setEvolucao] = useState<EvolucaoPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const hasLoadedOnce = useRef(false);

  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; featureKey: string; title: string }>({
    open: false,
    featureKey: "",
    title: "",
  });

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

    setIsRefreshing(true);
    if (!hasLoadedOnce.current) setLoading(true);

    let start: string, end: string;
    if (period === "custom" && customRange) {
      start = toLocalStr(customRange.start);
      end = toLocalStr(customRange.end);
    } else if (period === "custom") {
      setLoading(false);
      setIsRefreshing(false);
      return;
    } else {
      const range = computeRange(period);
      start = range.start;
      end = range.end;
    }

    const params = new URLSearchParams({ lojaIds: lojaIds.join(","), period, start, end });

    // A Evolução mensal sempre mostra os últimos 12 meses terminando no mês
    // corrente real (hoje), independente do período selecionado no filtro acima
    // (ex.: "Ano anterior" ou um intervalo personalizado não devem deslocar essa
    // janela — só os KPIs e blocos analíticos respeitam o filtro de período).
    const hojeStr = toLocalStr(new Date());
    const evolucaoParams = new URLSearchParams({ lojaIds: lojaIds.join(","), period: "month", start: hojeStr, end: hojeStr });

    const [summaryRes, evolucaoRes] = await Promise.allSettled([
      fetch(`/api/home/summary?${params}`).then((r) => (r.ok ? (r.json() as Promise<HomeSummaryResponse>) : null)),
      fetch(`/api/dashboard/charts?${evolucaoParams}&type=faturamento-mensal`).then((r) =>
        r.ok ? (r.json() as Promise<Array<{ mes: string; vendas: number }>>) : []
      ),
    ]);

    if (summaryRes.status === "fulfilled" && summaryRes.value) {
      setData(summaryRes.value);
      setUpdatedAt(formatHHMM(new Date()));
    }
    if (evolucaoRes.status === "fulfilled" && Array.isArray(evolucaoRes.value)) {
      setEvolucao(evolucaoRes.value.map((d) => ({ mes: d.mes, vendas: Number(d.vendas) || 0 })));
    }

    setLoading(false);
    setIsRefreshing(false);
    hasLoadedOnce.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojaIds.join(","), period, customRange]);

  useEffect(() => {
    if (!podeVerVisaoGeral) return;
    void fetchDados();
  }, [fetchDados, podeVerVisaoGeral]);

  useEffect(() => {
    if (!podeVerVisaoGeral) router.replace("/dashboard");
  }, [podeVerVisaoGeral, router]);

  const openUpgrade = (featureKey: string, title: string) => setUpgradeModal({ open: true, featureKey, title });
  const closeUpgrade = () => setUpgradeModal((prev) => ({ ...prev, open: false }));

  if (!podeVerVisaoGeral) return null;
  if (lojaIds.length === 0) return <SemLoja />;
  if (loading) return <HomeSkeleton />;
  if (!data) return <HomeSkeleton />;

  const { kpis, meta, diasUteis, emAberto, modulos } = data;
  const consumidorFinal = modulos.clientes.consumidorFinal;
  const maiorClienteIdentificado = modulos.clientes.maiorClienteIdentificado;

  // ── KPI: contexto da projeção — Meta/Projeção/Dias úteis sempre usam o mês
  // corrente como referência, independentemente do período escolhido no filtro
  // acima (ver comentário em /api/home/summary/route.ts). Deixamos isso explícito
  // no texto para não parecer que o card ignora o filtro por engano.
  const projecaoContext =
    meta.valor > 0 && meta.projecaoPercentMeta !== null
      ? `${meta.projecaoPercentMeta.toFixed(0)}% da meta do mês atual`
      : `ritmo atual · ${diasUteis.trabalhados} de ${diasUteis.total} dias úteis do mês`;

  // ── Alertas contextuais dos blocos analíticos (mesma régua de severidade do
  // Diagnóstico do período, para não divergir entre os dois lugares) ─────────
  const vendasAlert =
    modulos.vendas.metaPercent !== null && modulos.vendas.metaPercent >= 100
      ? { level: "ok" as StatusLevel, text: "Meta do mês atual superada." }
      : modulos.vendas.metaPercent !== null && modulos.vendas.metaPercent >= 80
      ? { level: "ok" as StatusLevel, text: "No ritmo para atingir a meta do mês." }
      : null;

  const finAlert =
    modulos.financeiro.margemLucro < 0
      ? { level: "crit" as StatusLevel, text: "Resultado bruto negativo: o custo dos produtos superou o faturamento." }
      : modulos.financeiro.custoReceita > 75
      ? { level: "warn" as StatusLevel, text: `Custo em ${modulos.financeiro.custoReceita.toFixed(0)}% do faturamento — pressão sobre a margem.` }
      : null;

  const cliAlert =
    consumidorFinal.percentFaturamento >= 50
      ? { level: "warn" as StatusLevel, text: "Maior parte das vendas sem identificação individual do cliente, o que limita a análise de clientes." }
      : modulos.clientes.taxaRecorrencia > 50
      ? { level: "ok" as StatusLevel, text: "Boa fidelização: a maioria dos clientes já havia comprado antes." }
      : null;

  const topProd = modulos.produtos.topProdutos;
  const top3Soma = topProd.slice(0, 3).reduce((s, p) => s + p.valor, 0);
  const top3Percent = kpis.faturamento > 0 ? (top3Soma / kpis.faturamento) * 100 : 0;
  const prodAlert =
    topProd[0] && topProd[0].percent > 40
      ? { level: "warn" as StatusLevel, text: `Alta concentração: um produto responde por ${topProd[0].percent.toFixed(0)}% do faturamento.` }
      : null;

  // ── Linhas dos blocos analíticos ──────────────────────────────────────────
  const vendasRows: AnalyticalRow[] = [
    {
      label: "Melhor vendedor",
      value: modulos.vendas.melhorVendedor?.nome ?? "—",
      subvalue: modulos.vendas.melhorVendedor ? `${formatCurrency(modulos.vendas.melhorVendedor.valor)} faturados` : undefined,
      highlight: modulos.vendas.melhorVendedor ? "ok" : null,
      wide: true,
    },
    {
      label: "Meta do mês",
      value: meta.valor > 0 ? formatCurrency(meta.valor) : "Não configurada",
      subvalue: meta.valor > 0 && meta.percentAtingido !== null
        ? `${meta.percentAtingido.toFixed(0)}% atingida`
        : "Defina uma meta para acompanhar o atingimento",
    },
    {
      label: "Orçamentos em aberto",
      value: formatNumber(emAberto.qtd),
      subvalue: `${formatCurrency(emAberto.valorTotal)} estimado`,
      hint: "Reflete a situação atual dos orçamentos em aberto, não o período selecionado no filtro.",
    },
  ];

  const finRows: AnalyticalRow[] = [
    {
      label: "Resultado bruto estimado",
      value: formatCurrency(modulos.financeiro.lucroLiquido),
      subvalue: `${modulos.financeiro.margemLucro.toFixed(1)}% de margem`,
      highlight: modulos.financeiro.margemLucro >= 0 ? "ok" : "crit",
      hint: "Faturamento do período menos o custo dos produtos vendidos. Não desconta devoluções, impostos, despesas operacionais ou outras deduções.",
      wide: true,
    },
    {
      label: "Custo sobre o faturamento",
      value: `${modulos.financeiro.custoReceita.toFixed(1)}%`,
      subvalue: modulos.financeiro.custoStatus === "ok" ? "dentro do esperado" : "acima do ideal",
      highlight: modulos.financeiro.custoStatus === "ok" ? "ok" : modulos.financeiro.custoStatus === "alert" ? "warn" : "crit",
    },
    {
      label: "Forma de pagamento principal",
      value: modulos.financeiro.formaPrincipalPagto ?? "—",
      subvalue: modulos.financeiro.formaPrincipalPagto ? `${modulos.financeiro.formaPrincipalPercent.toFixed(0)}% das vendas` : undefined,
    },
  ];

  const cliRows: AnalyticalRow[] = [
    {
      label: "Clientes identificados",
      value: formatNumber(modulos.clientes.identificados),
      subvalue: `${kpis.clientesNovos} novos · ${kpis.clientesRecorrentes} recorrentes`,
      hint: "Clientes com cadastro próprio, excluindo o cadastro genérico de consumidor final.",
    },
    {
      label: "Recorrência",
      value: `${modulos.clientes.taxaRecorrencia.toFixed(0)}%`,
      hint: "Clientes com mais de uma compra registrada em toda a história do cadastro (não apenas dentro deste período) — mesma regra usada no Dashboard de Clientes.",
      highlight: modulos.clientes.taxaRecorrencia > 45 ? "ok" : "warn",
    },
    {
      label: "Perfil dominante",
      value: `${modulos.clientes.perfilDominante} · ${modulos.clientes.perfilPercent.toFixed(0)}%`,
    },
    maiorClienteIdentificado
      ? {
          label: "Maior cliente identificado",
          value: maiorClienteIdentificado.nome,
          subvalue: `${formatCurrency(maiorClienteIdentificado.valor)} no período`,
          highlight: "ok" as StatusLevel,
          wide: true,
        }
      : {
          label: "Maior cliente identificado",
          value: "Nenhum cliente identificado se destacou",
          subvalue: consumidorFinal.valor > 0 ? "todo o volume do período foi para consumidor final" : undefined,
          wide: true,
        },
    ...(consumidorFinal.valor > 0
      ? [
          {
            label: "Vendas para consumidor final",
            value: formatCurrency(consumidorFinal.valor),
            subvalue: `${consumidorFinal.percentFaturamento.toFixed(0)}% do faturamento · vendas rápidas de balcão`,
            highlight: (consumidorFinal.percentFaturamento >= 50 ? "warn" : "info") as StatusLevel,
            hint: "Vendas atribuídas ao cadastro genérico de consumidor final — uma operação comercial válida (ex.: venda rápida com NFC-e), não um erro de cadastro.",
            wide: true,
          },
        ]
      : []),
  ];

  const prodRows: AnalyticalRow[] = [
    {
      label: "Produto com maior participação",
      value: topProd[0]?.nome ?? "—",
      subvalue: topProd[0] ? `${topProd[0].percent.toFixed(1)}% do faturamento · ${formatCurrency(topProd[0].valor)}` : undefined,
      wide: true,
    },
    {
      label: "2º produto",
      value: topProd[1]?.nome ?? "—",
      subvalue: topProd[1] ? formatCurrency(topProd[1].valor) : undefined,
    },
    {
      label: "3º produto",
      value: topProd[2]?.nome ?? "—",
      subvalue: topProd[2] ? formatCurrency(topProd[2].valor) : undefined,
    },
    {
      label: "Top 3 produtos concentram",
      value: formatCurrency(top3Soma),
      subvalue: `${top3Percent.toFixed(0)}% do faturamento do período`,
      wide: true,
    },
  ];

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <TopProgressBar loading={isRefreshing} />

      <UpgradeModal
        isOpen={upgradeModal.open}
        onClose={closeUpgrade}
        featureKey={upgradeModal.featureKey}
        moduleTitle={upgradeModal.title}
      />

      {/* ── Status de sincronização ─────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 -mb-1">
        <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          Visão geral
        </h1>
        {updatedAt && (
          <span className="text-xs inline-flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
            <span
              className={isRefreshing ? "pulse-dot" : ""}
              style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent-green)", display: "inline-block" }}
            />
            {isRefreshing ? "Atualizando…" : `Atualizado às ${updatedAt}`}
          </span>
        )}
      </div>

      <div
        style={{
          opacity: isRefreshing && hasLoadedOnce.current ? 0.6 : 1,
          transition: "opacity 0.2s ease",
          pointerEvents: isRefreshing && hasLoadedOnce.current ? "none" : "auto",
        }}
        className="flex flex-col gap-5"
      >
        {/* ── KPIs executivos ───────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiTile
            label="Faturamento do período"
            value={formatCurrency(kpis.faturamento)}
            tint="ink"
            changePercent={kpis.faturamentoVar}
            context={`${formatNumber(kpis.totalVendas)} vendas e ordens de serviço`}
            hint="Soma das vendas e ordens de serviço finalizadas no período. Não desconta devoluções."
            progress={
              meta.valor > 0 && meta.percentAtingido !== null
                ? { value: meta.percentAtingido, label: `${meta.percentAtingido.toFixed(0)}% da meta do mês atual atingida` }
                : undefined
            }
          />
          <KpiTile
            label="Resultado bruto estimado"
            value={formatCurrency(kpis.lucroLiquido)}
            tint="cyan"
            changePercent={kpis.lucroVar}
            context={`${kpis.margemLucro.toFixed(1)}% de margem`}
            hint="Faturamento do período menos o custo dos produtos vendidos. Não inclui despesas operacionais, impostos ou outras deduções."
          />
          <KpiTile
            label="Ticket médio"
            value={formatCurrency(kpis.ticketMedio)}
            tint="mist"
            changePercent={kpis.ticketMedioVar}
            hint="Faturamento do período dividido pelo número de vendas e ordens de serviço finalizadas."
          />
          <KpiTile
            label="Vendas e ordens de serviço"
            value={formatNumber(kpis.totalVendas)}
            tint="cyan"
            changePercent={kpis.vendasVar}
            context={`${formatNumber(kpis.totalVendasAnt)} no período anterior`}
            hint="Conta documentos de venda de balcão e de ordens de serviço finalizadas, somados."
          />
          <KpiTile
            label="Clientes atendidos"
            value={formatNumber(kpis.totalClientes)}
            tint="mist"
            context={`${kpis.clientesNovos} novos · ${kpis.clientesRecorrentes} recorrentes`}
            hint="Inclui clientes com cadastro identificado e o cadastro genérico de consumidor final (vendas de balcão)."
          />
          <KpiTile
            label="Projeção do mês"
            value={formatCurrency(meta.projecao)}
            tint="rose"
            context={projecaoContext}
            hint="Estimativa de fechamento do mês atual, com base no ritmo diário e nos dias úteis restantes. Sempre se refere ao mês corrente, independentemente do período selecionado no filtro acima."
            progress={{
              value: diasUteis.total > 0 ? (diasUteis.trabalhados / diasUteis.total) * 100 : 0,
              label: `${diasUteis.trabalhados} de ${diasUteis.total} dias úteis do mês decorridos`,
            }}
          />
        </div>

        {/* ── Evolução + Ranking ────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2">
            <ChartCard
              title="Evolução mensal do faturamento"
              subtitle="Últimos 12 meses · mês atual parcial"
              info="Este gráfico sempre mostra os últimos 12 meses corridos, com o mês atual parcial (ainda em andamento) — independente do período selecionado no filtro acima, que afeta apenas os cartões de KPI e os blocos analíticos abaixo."
            >
              <EvolucaoFaturamentoChart data={evolucao} />
            </ChartCard>
          </div>
          <ChartCard title="Ranking de vendedores" subtitle="Por faturamento no período selecionado">
            <RankingVendedores ranking={data.rankingVendedores} />
          </ChartCard>
        </div>

        {/* ── Blocos analíticos ─────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnalyticalCard
            title="Vendas"
            subtitle="Vendedores e metas do período"
            icon={ShoppingCart}
            href="/dashboard"
            isUnlocked={hasFeature("modulo_vendas")}
            featureKey="modulo_vendas"
            onUnlock={openUpgrade}
            rows={vendasRows}
            progress={
              modulos.vendas.metaPercent !== null
                ? { value: modulos.vendas.metaPercent, label: `${modulos.vendas.metaPercent.toFixed(0)}% da meta do mês atual atingida` }
                : undefined
            }
            alert={vendasAlert}
          />

          <AnalyticalCard
            title="Financeiro"
            subtitle="Resumo financeiro do período"
            icon={Landmark}
            href="/dashboard/financeiro"
            isUnlocked={hasFeature("modulo_financeiro")}
            featureKey="modulo_financeiro"
            onUnlock={openUpgrade}
            rows={finRows}
            progress={{
              value: Math.min(modulos.financeiro.custoReceita, 100),
              label: `Custo sobre o faturamento: ${modulos.financeiro.custoReceita.toFixed(1)}%`,
              color:
                modulos.financeiro.custoStatus === "ok"
                  ? "var(--accent-green)"
                  : modulos.financeiro.custoStatus === "alert"
                  ? "var(--accent-yellow)"
                  : "var(--accent-red)",
            }}
            alert={finAlert}
          />

          <AnalyticalCard
            title="Clientes"
            subtitle="Clientes no período"
            icon={Users}
            href="/dashboard/clientes"
            isUnlocked={hasFeature("modulo_clientes")}
            featureKey="modulo_clientes"
            onUnlock={openUpgrade}
            rows={cliRows}
            progress={{ value: modulos.clientes.taxaRecorrencia, label: `${modulos.clientes.taxaRecorrencia.toFixed(0)}% de recorrência` }}
            alert={cliAlert}
          />

          <AnalyticalCard
            title="Produtos"
            subtitle="Produtos com maior participação"
            icon={Package}
            href="/dashboard/produtos"
            isUnlocked={hasFeature("modulo_produtos")}
            featureKey="modulo_produtos"
            onUnlock={openUpgrade}
            rows={prodRows}
            progress={
              topProd[0] ? { value: topProd[0].percent, label: `Produto principal: ${topProd[0].percent.toFixed(1)}% do faturamento` } : undefined
            }
            alert={prodAlert}
          />
        </div>
      </div>
    </div>
  );
}
