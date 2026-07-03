"use client";

import Link from "next/link";
import { ArrowUpRight, ShieldCheck, AlertTriangle, OctagonAlert } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import {
  type HomeSummaryResponse,
  type StatusLevel,
  STATUS_TOKENS,
  isClienteNaoIdentificado,
} from "./types";

// ─── Motor de diagnóstico ──────────────────────────────────────────────────────
// Interpreta a resposta da API em uma leitura executiva. Regras simples e
// auditáveis, derivadas apenas de dados já disponíveis — nada é inventado.

export interface Finding {
  level: StatusLevel;
  title: string;
  detail: string;
  href: string;
  area: string;
}

const SEVERITY_ORDER: Record<StatusLevel, number> = { crit: 3, warn: 2, ok: 1 };

export function buildDiagnostico(data: HomeSummaryResponse): {
  status: StatusLevel;
  findings: Finding[];
} {
  const findings: Finding[] = [];
  const { kpis, modulos, meta } = data;

  // 1. Resultado / margem
  if (kpis.margemLucro < 0) {
    findings.push({
      level: "crit",
      title: "Resultado bruto negativo",
      detail: "O custo dos produtos superou a receita do período.",
      href: "/dashboard/financeiro",
      area: "Financeiro",
    });
  } else if (modulos.financeiro.custoReceita > 75) {
    findings.push({
      level: "warn",
      title: "Custo elevado sobre a receita",
      detail: `Custo representa ${modulos.financeiro.custoReceita.toFixed(0)}% da receita.`,
      href: "/dashboard/financeiro",
      area: "Financeiro",
    });
  }

  // 2. Tendência de faturamento
  if (kpis.faturamentoVar !== null) {
    if (kpis.faturamentoVar <= -30) {
      findings.push({
        level: "crit",
        title: "Queda forte de faturamento",
        detail: `${kpis.faturamentoVar.toFixed(0)}% frente ao período anterior.`,
        href: "/dashboard",
        area: "Vendas",
      });
    } else if (kpis.faturamentoVar <= -10) {
      findings.push({
        level: "warn",
        title: "Faturamento em queda",
        detail: `${kpis.faturamentoVar.toFixed(0)}% frente ao período anterior.`,
        href: "/dashboard",
        area: "Vendas",
      });
    }
  }

  // 3. Concentração de produto
  const topProd = modulos.produtos.topProdutos[0];
  if (topProd && topProd.percent > 40) {
    findings.push({
      level: "warn",
      title: "Receita concentrada em um produto",
      detail: `${topProd.nome} responde por ${topProd.percent.toFixed(0)}% do faturamento.`,
      href: "/dashboard/produtos",
      area: "Produtos",
    });
  }

  // 4. Vendas sem cliente identificado
  const maior = modulos.clientes.maiorCliente;
  if (maior && isClienteNaoIdentificado(maior.nome) && kpis.faturamento > 0) {
    const share = (maior.valor / kpis.faturamento) * 100;
    if (share >= 15) {
      findings.push({
        level: "warn",
        title: "Vendas sem cliente identificado",
        detail: `${formatCurrency(maior.valor)} vinculados a “Consumidor”.`,
        href: "/dashboard/clientes",
        area: "Clientes",
      });
    }
  }

  // 5. Meta não configurada — pendência de configuração, não problema de saúde
  if (meta.valor === 0) {
    findings.push({
      level: "ok",
      title: "Meta do mês não configurada",
      detail: "Defina uma meta para acompanhar o atingimento.",
      href: "/dashboard",
      area: "Vendas",
    });
  }

  const worst = findings.reduce<StatusLevel>(
    (acc, f) => (SEVERITY_ORDER[f.level] > SEVERITY_ORDER[acc] ? f.level : acc),
    "ok"
  );

  // Ordena por severidade (mais grave primeiro)
  findings.sort((a, b) => SEVERITY_ORDER[b.level] - SEVERITY_ORDER[a.level]);

  return { status: worst, findings };
}

// ─── Cópia do veredito ──────────────────────────────────────────────────────────

function verdictCopy(status: StatusLevel, critWarnCount: number): { title: string; sub: string } {
  if (status === "crit") {
    return {
      title: "Requer ação imediata",
      sub: critWarnCount === 1
        ? "1 ponto crítico foi identificado no período."
        : `${critWarnCount} pontos exigem atenção no período.`,
    };
  }
  if (status === "warn") {
    return {
      title: "Atenção recomendada",
      sub: critWarnCount === 1
        ? "1 ponto merece acompanhamento."
        : `${critWarnCount} pontos merecem acompanhamento.`,
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
} as const;

// ─── Componente ───────────────────────────────────────────────────────────────

export function DiagnosticoCard({ data }: { data: HomeSummaryResponse }) {
  const { status, findings } = buildDiagnostico(data);
  const token = STATUS_TOKENS[status];
  const Icon = STATUS_ICON[status];

  // Pontos de real atenção (crit/warn) para a contagem e cópia
  const attention = findings.filter((f) => f.level !== "ok");
  const copy = verdictCopy(status, attention.length);

  // CTA primário → área do achado mais severo (ou Vendas se saudável)
  const primary = findings[0];

  return (
    <section
      className="rounded-2xl overflow-hidden animate-fade-in-up"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.02) inset",
      }}
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
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--text-muted)" }}
            >
              Diagnóstico do período
            </span>
          </div>

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
              <h2
                className="text-xl font-bold leading-tight"
                style={{ color: "var(--text-primary)" }}
              >
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
              {status === "ok" ? "Explorar vendas" : `Investigar ${primary.area.toLowerCase()}`}
              <ArrowUpRight size={15} />
            </Link>
          )}
        </div>

        {/* ── Achados ────────────────────────────────────────────────── */}
        <div
          className="flex-1 p-4 lg:p-5 flex flex-col gap-1 border-t lg:border-t-0 lg:border-l"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          {attention.length === 0 ? (
            <div className="flex items-center gap-3 px-2 py-6">
              <ShieldCheck size={18} style={{ color: STATUS_TOKENS.ok.color }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Todos os indicadores monitorados estão dentro do esperado.
                {findings.some((f) => f.level === "ok") && " Há apenas ajustes de configuração pendentes."}
              </p>
            </div>
          ) : (
            attention.map((f, i) => (
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
            ))
          )}

          {/* Nota de configuração pendente (achados "ok" separados dos alertas) */}
          {attention.length > 0 &&
            findings
              .filter((f) => f.level === "ok")
              .map((f, i) => (
                <div
                  key={`cfg-${i}`}
                  className="flex items-center gap-3 px-3 py-2 mt-1"
                  style={{ borderTop: "1px dashed var(--border-subtle)" }}
                >
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {f.title} — {f.detail}
                  </span>
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
