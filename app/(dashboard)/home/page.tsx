"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ShoppingCart,
  Landmark,
  Users,
  Package,
  FileText,
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  Receipt,
} from "lucide-react";
import { useLoja } from "@/lib/contexts/loja-context";
import { useEmpresa } from "@/lib/contexts/empresa-context";
import { usePeriod, computeRange } from "@/lib/contexts/period-context";
import { ModuleCard } from "@/components/home/ModuleCard";
import { UpgradeModal } from "@/components/home/UpgradeModal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatHHMM(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function toLocalStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Tipos da API ─────────────────────────────────────────────────────────────

interface HomeSummaryResponse {
  periodo: { start: string; end: string; label: string };
  kpis: {
    faturamento: number;
    faturamentoVar: number | null;
    lucroLiquido: number;
    lucroVar: number | null;
    margemLucro: number;
    ticketMedio: number;
    ticketMedioVar: number | null;
    totalClientes: number;
    clientesNovos: number;
    clientesRecorrentes: number;
    totalVendas: number;
    vendasVar: number | null;
  };
  emAberto: { qtd: number; valorTotal: number; qtdOs: number; qtdVendas: number };
  meta: {
    valor: number;
    percentAtingido: number | null;
    projecao: number;
    projecaoPercentMeta: number | null;
  };
  diasUteis: { trabalhados: number; restantes: number; total: number; percentual: number };
  modulos: {
    vendas: {
      faturamento: number;
      ticketMedio: number;
      melhorVendedor: { nome: string; valor: number } | null;
      metaPercent: number | null;
      insight: string | null;
    };
    financeiro: {
      lucroLiquido: number;
      margemLucro: number;
      custoReceita: number;
      custoStatus: "ok" | "alert" | "danger";
      formaPrincipalPagto: string | null;
      formaPrincipalPercent: number;
      insight: string | null;
    };
    clientes: {
      total: number;
      taxaRecorrencia: number;
      perfilDominante: "PJ" | "PF";
      perfilPercent: number;
      maiorCliente: { nome: string; valor: number } | null;
      insight: string | null;
    };
    produtos: {
      topProdutos: Array<{ nome: string; valor: number; qtde: number; percent: number }>;
      insight: string | null;
    };
  };
  rankingVendedores: Array<{ nome: string; valor: number; percent: number }>;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ w, h = 10 }: { w: string | number; h?: number }) {
  return (
    <div
      className="skeleton-bar shrink-0"
      style={{ width: w, height: h, borderRadius: 6 }}
    />
  );
}

function SkCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      className="rounded-xl"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", ...style }}
    >
      {children}
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkCard key={i} style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Sk w={80} h={10} />
              <Sk w={30} h={30} />
            </div>
            <Sk w={130} h={26} />
            <Sk w={90} h={10} />
          </SkCard>
        ))}
      </div>
      <div className="flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkCard key={i} style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sk w={28} h={28} />
              <Sk w={90} h={10} />
            </div>
            <Sk w={110} h={20} />
            <Sk w="100%" h={5} />
            <Sk w={80} h={10} />
          </SkCard>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkCard key={i} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Sk w={36} h={36} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <Sk w={80} h={14} />
                  <Sk w={110} h={10} />
                </div>
              </div>
              <Sk w={96} h={30} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <Sk w={65} h={10} />
                  <Sk w={95} h={14} />
                  <Sk w={60} h={10} />
                </div>
              ))}
            </div>
            <Sk w="100%" h={6} />
          </SkCard>
        ))}
      </div>
      <SkCard style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <Sk w={170} h={16} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Sk w={24} h={14} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Sk w={130} h={13} />
                <Sk w={85} h={13} />
              </div>
              <Sk w="100%" h={5} />
            </div>
          </div>
        ))}
      </SkCard>
    </div>
  );
}

// ─── Sem loja ─────────────────────────────────────────────────────────────────

function SemLoja() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div
        className="rounded-2xl p-10 text-center max-w-sm"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Selecione uma loja para ver os dados.
        </p>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  subvalue?: string;
  subvalue2?: string;
  changePercent?: number | null;
  icon: React.ElementType;
  accentColor?: string;
}

function KpiCard({ label, value, subvalue, subvalue2, changePercent, icon: Icon, accentColor = "#22c55e" }: KpiCardProps) {
  const isPositive = changePercent !== null && changePercent !== undefined && changePercent >= 0;
  const hasChange  = changePercent !== null && changePercent !== undefined;

  return (
    <div
      className="flex-1 min-w-0 p-5 flex flex-col gap-2 rounded-xl"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide font-medium" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        <div
          className="flex items-center justify-center rounded-lg"
          style={{ background: `${accentColor}20`, width: 30, height: 30 }}
        >
          <Icon size={14} style={{ color: accentColor }} />
        </div>
      </div>
      <p className="text-2xl font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
      <div className="flex flex-col gap-0.5">
        {hasChange && (
          <p
            className="text-xs font-medium flex items-center gap-1"
            style={{ color: isPositive ? "#22c55e" : "#ef4444" }}
          >
            {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {isPositive ? "+" : ""}{changePercent!.toFixed(1)}% vs período ant.
          </p>
        )}
        {subvalue && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {subvalue}
          </p>
        )}
        {subvalue2 && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {subvalue2}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Info Card (com barra de progresso) ───────────────────────────────────────

interface InfoCardProps {
  label: string;
  value: string;
  subvalue?: string;
  subvalue2?: string;
  progress: number;
  progressColor?: string;
  icon: React.ElementType;
  accentColor?: string;
}

function InfoCard({ label, value, subvalue, subvalue2, progress, progressColor = "#22c55e", icon: Icon, accentColor = "#22c55e" }: InfoCardProps) {
  return (
    <div
      className="flex-1 min-w-0 p-4 flex flex-col gap-2 rounded-xl"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center rounded-lg shrink-0"
          style={{ background: `${accentColor}20`, width: 28, height: 28 }}
        >
          <Icon size={13} style={{ color: accentColor }} />
        </div>
        <p className="text-xs uppercase tracking-wide font-medium" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
      </div>
      <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: 5, background: "var(--border-color)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(progress, 100)}%`, background: progressColor }}
        />
      </div>
      {subvalue && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {subvalue}
        </p>
      )}
      {subvalue2 && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {subvalue2}
        </p>
      )}
    </div>
  );
}

// ─── Ranking Card ─────────────────────────────────────────────────────────────

const RANKING_COLORS = ["#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b", "#f59e0b"];
const RANKING_MEDALS = ["🥇", "🥈", "🥉", "4°", "5°"];

function RankingCard({ ranking }: { ranking: Array<{ nome: string; valor: number }> }) {
  const top = ranking[0]?.valor ?? 1;

  return (
    <div
      className="w-full p-5 rounded-xl flex flex-col gap-4"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
    >
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        🏆 Ranking de Faturamento
      </p>
      <div className="flex flex-col gap-3">
        {ranking.slice(0, 5).map((vendedor, i) => {
          const pct   = top > 0 ? (vendedor.valor / top) * 100 : 0;
          const color = RANKING_COLORS[i] ?? "#f59e0b";
          return (
            <div key={i} className="flex items-center gap-3">
              <span
                className="text-sm font-bold shrink-0 w-6 text-center"
                style={{ color: i < 3 ? color : "var(--text-muted)" }}
              >
                {RANKING_MEDALS[i]}
              </span>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {vendedor.nome}
                  </p>
                  <p className="text-sm font-semibold shrink-0" style={{ color }}>
                    {formatCurrency(vendedor.valor)}
                  </p>
                </div>
                <div
                  className="w-full rounded-full overflow-hidden"
                  style={{ height: 5, background: "var(--border-color)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
              </div>
            </div>
          );
        })}
        {ranking.length === 0 && (
          <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
            Nenhum dado disponível
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function HomePage() {
  const { selectedLojaId, lojasDisponiveis, lojasSelecionadas } = useLoja();
  const { period, customRange } = usePeriod();
  const { hasFeature } = useEmpresa();

  const [data, setData] = useState<HomeSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const hasLoadedOnce = useRef(false);

  const [upgradeModal, setUpgradeModal] = useState<{
    open: boolean;
    featureKey: string;
    title: string;
  }>({ open: false, featureKey: "", title: "" });

  // Mesma lógica de lojaIds do dashboard
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

    if (!hasLoadedOnce.current) setLoading(true);

    let start: string, end: string;
    if (period === "custom" && customRange) {
      start = toLocalStr(customRange.start);
      end   = toLocalStr(customRange.end);
    } else if (period === "custom") {
      return;
    } else {
      const range = computeRange(period);
      start = range.start;
      end   = range.end;
    }

    const params = new URLSearchParams({
      lojaIds: lojaIds.join(","),
      period,
      start,
      end,
    });

    try {
      const res = await fetch(`/api/home/summary?${params}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setUpdatedAt(formatHHMM(new Date()));
      }
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojaIds.join(","), period, customRange]);

  useEffect(() => {
    void fetchDados();
  }, [fetchDados]);

  const openUpgrade  = (featureKey: string, title: string) => setUpgradeModal({ open: true, featureKey, title });
  const closeUpgrade = () => setUpgradeModal((prev) => ({ ...prev, open: false }));

  if (lojaIds.length === 0) return <SemLoja />;
  if (loading) return <HomeSkeleton />;

  return (
    <div className="flex flex-col gap-6 p-6">
      <UpgradeModal
        isOpen={upgradeModal.open}
        onClose={closeUpgrade}
        featureKey={upgradeModal.featureKey}
        moduleTitle={upgradeModal.title}
      />

      {/* Linha de status — atualização */}
      {updatedAt && (
        <p className="text-xs flex items-center gap-1.5 -mb-3" style={{ color: "var(--text-muted)" }}>
          <span
            className="inline-block rounded-full"
            style={{ width: 7, height: 7, background: "#22c55e" }}
          />
          Atualizado às {updatedAt}
        </p>
      )}

      {/* KPI Bar */}
      {data && (
        <div className="flex gap-4 flex-wrap">
          <KpiCard
            label="Faturamento Total"
            value={formatCurrency(data.kpis.faturamento)}
            changePercent={data.kpis.faturamentoVar}
            subvalue={`${data.kpis.totalVendas} vendas`}
            icon={TrendingUp}
            accentColor="#22c55e"
          />
          <KpiCard
            label="Lucro Líquido"
            value={formatCurrency(data.kpis.lucroLiquido)}
            changePercent={data.kpis.lucroVar}
            subvalue={`${data.kpis.margemLucro.toFixed(1)}% margem`}
            icon={Landmark}
            accentColor={data.kpis.margemLucro >= 0 ? "#22c55e" : "#ef4444"}
          />
          <KpiCard
            label="Ticket Médio"
            value={formatCurrency(data.kpis.ticketMedio)}
            changePercent={data.kpis.ticketMedioVar}
            icon={Receipt}
            accentColor="#3b82f6"
          />
          <KpiCard
            label="Clientes"
            value={String(data.kpis.totalClientes)}
            subvalue={`${data.kpis.clientesNovos} novos`}
            subvalue2={`${data.kpis.clientesRecorrentes} recorr.`}
            icon={Users}
            accentColor="#8b5cf6"
          />
          <KpiCard
            label="Vendas"
            value={String(data.kpis.totalVendas)}
            changePercent={data.kpis.vendasVar}
            subvalue={`${formatCurrency(data.emAberto.valorTotal)} em aberto`}
            icon={ShoppingCart}
            accentColor="#f59e0b"
          />
        </div>
      )}

      {/* Info Row */}
      {data && (
        <div className="flex gap-4 flex-wrap">
          <InfoCard
            label="Meta do Mês"
            value={formatCurrency(data.meta.valor)}
            subvalue={data.meta.percentAtingido !== null ? `${data.meta.percentAtingido.toFixed(0)}% atingida` : "Meta não definida"}
            subvalue2={data.meta.valor > 0 ? `${formatCurrency(Math.max(0, data.meta.valor - data.kpis.faturamento))} restante` : undefined}
            progress={data.meta.percentAtingido ?? 0}
            progressColor="#22c55e"
            icon={Target}
            accentColor="#22c55e"
          />
          <InfoCard
            label="Projeção de Fechamento"
            value={formatCurrency(data.meta.projecao)}
            subvalue={data.meta.projecaoPercentMeta !== null ? `${data.meta.projecaoPercentMeta.toFixed(0)}% da meta` : "baseado no ritmo atual"}
            subvalue2="baseado no ritmo atual"
            progress={data.meta.projecaoPercentMeta ?? 0}
            progressColor="#3b82f6"
            icon={TrendingUp}
            accentColor="#3b82f6"
          />
          <InfoCard
            label="Dias Úteis"
            value={`${data.diasUteis.trabalhados} trabalhados`}
            subvalue={`${data.diasUteis.restantes} dias restantes`}
            progress={data.diasUteis.percentual}
            progressColor="#6b7280"
            icon={Calendar}
            accentColor="#6b7280"
          />
          <InfoCard
            label="Orçamentos em Aberto"
            value={String(data.emAberto.qtd)}
            subvalue={`${data.emAberto.qtdOs} OS | ${data.emAberto.qtdVendas} Vendas`}
            subvalue2={formatCurrency(data.emAberto.valorTotal) + " estimado"}
            progress={0}
            progressColor="#f59e0b"
            icon={FileText}
            accentColor="#f59e0b"
          />
        </div>
      )}

      {/* Module Grid 2x2 */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModuleCard
            title="Vendas"
            subtitle="desempenho do período"
            icon={ShoppingCart}
            accentColor="#22c55e"
            featureKey="modulo_vendas"
            isUnlocked={hasFeature("modulo_vendas")}
            moduleHref="/dashboard"
            onUnlock={openUpgrade}
            progressValue={data.modulos.vendas.metaPercent ?? undefined}
            progressLabel={data.modulos.vendas.metaPercent !== null ? `${data.modulos.vendas.metaPercent?.toFixed(0)}% atingida` : undefined}
            insight={data.modulos.vendas.insight}
            rows={[
              { label: "Faturamento", value: formatCurrency(data.modulos.vendas.faturamento) },
              { label: "Ticket médio", value: formatCurrency(data.modulos.vendas.ticketMedio) },
              {
                label: "Melhor vendedor",
                value: data.modulos.vendas.melhorVendedor?.nome ?? "—",
                subvalue: data.modulos.vendas.melhorVendedor
                  ? formatCurrency(data.modulos.vendas.melhorVendedor.valor) + " faturados"
                  : undefined,
              },
              { label: "Tempo médio venda", value: "—", locked: true },
            ]}
          />

          <ModuleCard
            title="Financeiro"
            subtitle="saúde financeira do período"
            icon={Landmark}
            accentColor="#3b82f6"
            featureKey="modulo_financeiro"
            isUnlocked={hasFeature("modulo_financeiro")}
            moduleHref="/dashboard/financeiro"
            onUnlock={openUpgrade}
            progressValue={data.modulos.financeiro.custoReceita}
            progressLabel={`Custo sobre receita ${data.modulos.financeiro.custoReceita.toFixed(1)}%`}
            insight={data.modulos.financeiro.insight}
            rows={[
              {
                label: "Lucro líquido",
                value: formatCurrency(data.modulos.financeiro.lucroLiquido),
                subvalue: data.modulos.financeiro.margemLucro.toFixed(1) + "% de margem",
                highlight: data.modulos.financeiro.margemLucro > 0 ? "green" : "red",
              },
              {
                label: "Custo / Receita",
                value: data.modulos.financeiro.custoReceita.toFixed(1) + "%",
                highlight: data.modulos.financeiro.custoStatus === "ok" ? "green" : "red",
              },
              {
                label: "Forma princ. pagto",
                value: data.modulos.financeiro.formaPrincipalPagto ?? "—",
                subvalue: data.modulos.financeiro.formaPrincipalPercent.toFixed(0) + "% das vendas",
              },
              { label: "Inadimplência", value: "—", locked: true },
            ]}
          />

          <ModuleCard
            title="Clientes"
            subtitle="base e fidelização"
            icon={Users}
            accentColor="#8b5cf6"
            featureKey="modulo_clientes"
            isUnlocked={hasFeature("modulo_clientes")}
            moduleHref="/dashboard/clientes"
            onUnlock={openUpgrade}
            progressValue={data.modulos.clientes.taxaRecorrencia}
            progressLabel={`${data.modulos.clientes.taxaRecorrencia.toFixed(0)}% fidelizados`}
            insight={data.modulos.clientes.insight}
            rows={[
              {
                label: "Total no período",
                value: String(data.modulos.clientes.total) + " clientes",
                subvalue: "+" + data.kpis.clientesNovos + " novos",
                highlight: "green",
              },
              {
                label: "Taxa de recorrência",
                value: data.modulos.clientes.taxaRecorrencia.toFixed(0) + "%",
                highlight: data.modulos.clientes.taxaRecorrencia > 45 ? "green" : "amber",
              },
              {
                label: "Perfil dominante",
                value: data.modulos.clientes.perfilDominante + " · " + data.modulos.clientes.perfilPercent.toFixed(0) + "%",
              },
              {
                label: "Maior cliente",
                value: data.modulos.clientes.maiorCliente?.nome ?? "—",
                subvalue: data.modulos.clientes.maiorCliente
                  ? formatCurrency(data.modulos.clientes.maiorCliente.valor) + " no período"
                  : undefined,
                highlight: data.modulos.clientes.maiorCliente ? "green" : undefined,
              },
            ]}
          />

          <ModuleCard
            title="Produtos"
            subtitle="mix e desempenho"
            icon={Package}
            accentColor="#f59e0b"
            featureKey="modulo_produtos"
            isUnlocked={hasFeature("modulo_produtos")}
            moduleHref="/dashboard/produtos"
            onUnlock={openUpgrade}
            progressValue={data.modulos.produtos.topProdutos[0]?.percent}
            progressLabel={
              data.modulos.produtos.topProdutos[0]
                ? `${data.modulos.produtos.topProdutos[0].percent.toFixed(1)}% do faturamento — produto principal`
                : undefined
            }
            insight={data.modulos.produtos.insight}
            rows={[
              {
                label: "Top produto",
                value: data.modulos.produtos.topProdutos[0]?.nome ?? "—",
                subvalue: data.modulos.produtos.topProdutos[0]
                  ? formatCurrency(data.modulos.produtos.topProdutos[0].valor) + " · " + data.modulos.produtos.topProdutos[0].qtde + " un."
                  : undefined,
              },
              {
                label: "2° produto",
                value: data.modulos.produtos.topProdutos[1]?.nome ?? "—",
                subvalue: data.modulos.produtos.topProdutos[1]
                  ? formatCurrency(data.modulos.produtos.topProdutos[1].valor)
                  : undefined,
              },
              {
                label: "3° produto",
                value: data.modulos.produtos.topProdutos[2]?.nome ?? "—",
                subvalue: data.modulos.produtos.topProdutos[2]
                  ? formatCurrency(data.modulos.produtos.topProdutos[2].valor)
                  : undefined,
              },
              { label: "Estoque crítico", value: "—", locked: true },
            ]}
          />
        </div>
      )}

      {data && <RankingCard ranking={data.rankingVendedores} />}
    </div>
  );
}
