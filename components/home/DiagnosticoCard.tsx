"use client";

import Link from "next/link";
import { ArrowUpRight, ShieldCheck, AlertTriangle, OctagonAlert, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import { type HomeSummaryResponse, type StatusLevel, STATUS_TOKENS } from "./types";

// ─── Motor de diagnóstico ──────────────────────────────────────────────────────
// Interpreta a resposta da API em uma leitura executiva. Regras simples e
// auditáveis, derivadas apenas de dados já disponíveis — nada é inventado.
//
// Classificação (alinhada à revisão de fidelidade ao ERP):
// - crit: resultado bruto negativo, queda muito forte de faturamento.
// - warn: custo elevado sobre a receita, queda moderada, concentração alta em um
//         produto ou vendedor, meta não configurada, participação muito alta (≥50%)
//         de vendas sem cliente identificado (aqui sim atrapalha a análise de clientes).
// - info: contexto neutro que não é bom nem ruim — ex.: parte das vendas atribuída ao
//         cadastro genérico de consumidor final. Não conta para o veredito geral.

export interface Finding {
  level: StatusLevel;
  title: string;
  detail: string;
  href: string;
  area: string;
}

const SEVERITY_ORDER: Record<"crit" | "warn", number> = { crit: 2, warn: 1 };

export function buildDiagnostico(data: HomeSummaryResponse): {
  status: StatusLevel;
  problems: Finding[];
  context: Finding[];
} {
  const problems: Finding[] = [];
  const context: Finding[] = [];
  const { kpis, modulos, meta, rankingVendedores } = data;

  // 1. Resultado bruto / margem
  if (kpis.margemLucro < 0) {
    problems.push({
      level: "crit",
      title: "Resultado bruto negativo",
      detail: "O custo dos produtos superou o faturamento do período.",
      href: "/dashboard/financeiro",
      area: "Financeiro",
    });
  } else if (modulos.financeiro.custoReceita > 75) {
    problems.push({
      level: "warn",
      title: "Custo elevado sobre a receita",
      detail: `O custo dos produtos representa ${modulos.financeiro.custoReceita.toFixed(0)}% do faturamento.`,
      href: "/dashboard/financeiro",
      area: "Financeiro",
    });
  }

  // 2. Tendência de faturamento
  if (kpis.faturamentoVar !== null) {
    if (kpis.faturamentoVar <= -30) {
      problems.push({
        level: "crit",
        title: "Queda forte de faturamento",
        detail: `${kpis.faturamentoVar.toFixed(0)}% em relação ao período anterior.`,
        href: "/dashboard",
        area: "Vendas",
      });
    } else if (kpis.faturamentoVar <= -10) {
      problems.push({
        level: "warn",
        title: "Faturamento em queda",
        detail: `${kpis.faturamentoVar.toFixed(0)}% em relação ao período anterior.`,
        href: "/dashboard",
        area: "Vendas",
      });
    }
  }

  // 3. Concentração de produto
  const topProd = modulos.produtos.topProdutos[0];
  if (topProd && topProd.percent > 40) {
    problems.push({
      level: "warn",
      title: "Receita concentrada em um produto",
      detail: `${topProd.nome} responde por ${topProd.percent.toFixed(0)}% do faturamento.`,
      href: "/dashboard/produtos",
      area: "Produtos",
    });
  }

  // 4. Dependência de um vendedor
  const liderVendedor = rankingVendedores[0];
  if (liderVendedor && liderVendedor.percent > 50) {
    problems.push({
      level: "warn",
      title: "Faturamento concentrado em um vendedor",
      detail: `${liderVendedor.nome} responde por ${liderVendedor.percent.toFixed(0)}% do faturamento do período.`,
      href: "/dashboard",
      area: "Vendas",
    });
  }

  // 5. Consumidor final — operação válida, não um problema de cadastro. Só vira
  // "atenção" quando a participação é alta o bastante para atrapalhar de fato a
  // leitura da base de clientes; abaixo disso é só contexto informativo.
  const { valor: valorConsumidorFinal, percentFaturamento } = modulos.clientes.consumidorFinal;
  if (valorConsumidorFinal > 0) {
    if (percentFaturamento >= 50) {
      problems.push({
        level: "warn",
        title: "Maior parte das vendas sem cliente identificado",
        detail: `${formatCurrency(valorConsumidorFinal)} (${percentFaturamento.toFixed(0)}%) em vendas para consumidor final, o que limita a análise de clientes.`,
        href: "/dashboard/clientes",
        area: "Clientes",
      });
    } else if (percentFaturamento >= 15) {
      context.push({
        level: "info",
        title: "Vendas para consumidor final",
        detail: `${formatCurrency(valorConsumidorFinal)} (${percentFaturamento.toFixed(0)}%) em vendas rápidas de balcão, sem identificação individual do cliente.`,
        href: "/dashboard/clientes",
        area: "Clientes",
      });
    }
  }

  // 6. Meta não configurada — pendência de configuração, não problema de saúde.
  if (meta.valor === 0) {
    context.push({
      level: "info",
      title: "Meta do mês não configurada",
      detail: "Defina uma meta para acompanhar o percentual atingido e a projeção.",
      href: "/dashboard",
      area: "Vendas",
    });
  }

  const worst = problems.reduce<StatusLevel>(
    (acc, f) => {
      const level = f.level as "crit" | "warn";
      return SEVERITY_ORDER[level] > (acc === "ok" ? 0 : SEVERITY_ORDER[acc as "crit" | "warn"]) ? level : acc;
    },
    "ok"
  );

  problems.sort((a, b) => SEVERITY_ORDER[b.level as "crit" | "warn"] - SEVERITY_ORDER[a.level as "crit" | "warn"]);

  return { status: worst, problems, context };
}

// ─── Cópia do veredito ──────────────────────────────────────────────────────────

function verdictCopy(status: StatusLevel, count: number): { title: string; sub: string } {
  if (status === "crit") {
    return {
      title: "Requer ação imediata",
      sub: count === 1
        ? "1 ponto crítico foi identificado no período."
        : `${count} pontos exigem atenção no período.`,
    };
  }
  if (status === "warn") {
    return {
      title: "Atenção recomendada",
      sub: count === 1
        ? "1 ponto merece acompanhamento."
        : `${count} pontos merecem acompanhamento.`,
    };
  }
  return {
    title: "Desempenho saudável",
    sub: "Nenhum ponto crítico identificado no período.",
  };
}

const STATUS_ICON = {
  ok: ShieldCheck,
  warn: AlertTriangle,
  crit: OctagonAlert,
  info: Info,
} as const;

// ─── Componente ───────────────────────────────────────────────────────────────

export function DiagnosticoCard({ data }: { data: HomeSummaryResponse }) {
  const { status, problems, context } = buildDiagnostico(data);
  const token = STATUS_TOKENS[status];
  const Icon = STATUS_ICON[status];
  const copy = verdictCopy(status, problems.length);
  const primary = problems[0];

  return (
    <section
      className="rounded-2xl overflow-hidden animate-fade-in-up"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
    >
      <div className="flex flex-col lg:flex-row">
        {/* ── Veredito (spine colorida) ─────────────────────────────── */}
        <div
          className="flex flex-col gap-3 p-5 lg:p-6 lg:w-[340px] lg:shrink-0"
          style={{
            borderLeft: `3px solid ${token.color}`,
            background: `linear-gradient(180deg, ${token.soft} 0%, transparent 70%)`,
          }}
        >
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--text-muted)" }}
          >
            Diagnóstico do período
          </span>

          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-xl shrink-0"
              style={{ background: token.soft, width: 44, height: 44 }}
            >
              <Icon size={22} style={{ color: token.color }} />
            </div>
            <div className="min-w-0">
              <p
                className="text-[13px] font-semibold uppercase tracking-wide leading-none mb-1.5"
                style={{ color: token.color }}
              >
                {token.label}
              </p>
              <h2 className="text-xl font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                {copy.title}
              </h2>
            </div>
          </div>

          <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {copy.sub}
          </p>

          {primary && (
            <Link
              href={primary.href}
              className="inline-flex items-center gap-1.5 mt-1 text-[13px] font-semibold transition-opacity hover:opacity-80"
              style={{ color: "var(--accent-cyan)" }}
            >
              {`Investigar ${primary.area.toLowerCase()}`}
              <ArrowUpRight size={15} />
            </Link>
          )}
        </div>

        {/* ── Achados ────────────────────────────────────────────────── */}
        <div
          className="flex-1 p-4 lg:p-5 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          {/* Pontos de atenção (crítico/atenção) */}
          <div className="flex flex-col gap-1">
            {problems.length === 0 ? (
              <div className="flex items-center gap-3 px-2 py-3">
                <ShieldCheck size={18} style={{ color: STATUS_TOKENS.ok.color }} />
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Todos os indicadores monitorados estão dentro do esperado.
                </p>
              </div>
            ) : (
              <>
                <span
                  className="text-[11px] font-semibold uppercase tracking-wide px-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Pontos de atenção
                </span>
                {problems.map((f, i) => (
                  <Link
                    key={i}
                    href={f.href}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
                    style={{ color: "var(--text-primary)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span
                      className="mt-0.5 shrink-0 rounded-full"
                      style={{
                        width: 8,
                        height: 8,
                        background: STATUS_TOKENS[f.level].color,
                        boxShadow: `0 0 0 4px ${STATUS_TOKENS[f.level].soft}`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
                        {f.title}
                      </p>
                      <p className="text-xs leading-snug mt-0.5" style={{ color: "var(--text-secondary)" }}>
                        {f.detail}
                      </p>
                    </div>
                    <span
                      className="flex items-center gap-1 text-[11px] font-medium shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {f.area}
                      <ArrowUpRight size={13} />
                    </span>
                  </Link>
                ))}
              </>
            )}
          </div>

          {/* Contexto do período (informativo — não é problema) */}
          {context.length > 0 && (
            <div
              className="flex flex-col gap-1 pt-3"
              style={{ borderTop: "1px dashed var(--border-subtle)" }}
            >
              <span
                className="text-[11px] font-semibold uppercase tracking-wide px-1"
                style={{ color: "var(--text-muted)" }}
              >
                Contexto do período
              </span>
              {context.map((f, i) => (
                <Link
                  key={i}
                  href={f.href}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2 transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Info size={14} className="shrink-0" style={{ color: STATUS_TOKENS.info.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] leading-snug" style={{ color: "var(--text-secondary)" }}>
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {f.title}
                      </span>{" "}
                      — {f.detail}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
