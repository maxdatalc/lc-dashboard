"use client";

import { formatCurrency } from "@/lib/utils/format";

export interface FormasPagamentoData {
  nome: string;
  valor: number;
  percentual: number;
  qtdVendas?: number;
}

interface Props {
  data: FormasPagamentoData[];
}

const CORES = [
  "#00e5ff",
  "#f59e0b",
  "#10b981",
  "#7c3aed",
  "#f97316",
  "#ef4444",
];

function fmtCompact(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}k`;
  return formatCurrency(v);
}

export function FormasPagamentoChart({ data }: Props) {
  const top6 = data.slice(0, 6);
  const total = data.reduce((acc, d) => acc + d.valor, 0);
  const maxVal = Math.max(...top6.map((d) => d.valor), 1);

  if (!top6.length) {
    return (
      <div
        className="flex items-center justify-center text-xs"
        style={{ height: 80, color: "var(--text-muted)" }}
      >
        Sem dados disponíveis
      </div>
    );
  }

  return (
    <div>
      {/* Cabeçalho com total */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "8px",
          marginBottom: "14px",
          paddingBottom: "12px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <span
          style={{
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--text-primary)",
            fontFamily: "var(--font-numeric)",
            letterSpacing: "-0.02em",
          }}
        >
          {fmtCompact(total)}
        </span>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          total recebido no período
        </span>
      </div>

      {/* Linhas */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {top6.map((d, i) => {
          const barWidth = maxVal > 0 ? (d.valor / maxVal) * 100 : 0;
          const cor = CORES[i % CORES.length];

          return (
            <div
              key={d.nome}
              style={{ display: "flex", alignItems: "center", gap: "10px" }}
            >
              {/* Indicador de cor */}
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: cor,
                  flexShrink: 0,
                }}
              />

              {/* Nome */}
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  minWidth: "72px",
                  maxWidth: "90px",
                  flexShrink: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={d.nome}
              >
                {d.nome}
              </span>

              {/* Barra de progresso */}
              <div
                style={{
                  flex: 1,
                  height: "4px",
                  background: "var(--chart-track-bg)",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${barWidth}%`,
                    height: "100%",
                    background: cor,
                    borderRadius: "2px",
                    transition: "width 0.6s ease",
                    opacity: barWidth === 0 ? 0.25 : 1,
                  }}
                />
              </div>

              {/* Percentual — destaque principal */}
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: barWidth > 0 ? "var(--text-primary)" : "var(--text-muted)",
                  fontFamily: "var(--font-numeric)",
                  minWidth: "36px",
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {d.percentual < 1 && d.percentual > 0
                  ? `<1%`
                  : `${Math.round(d.percentual)}%`}
              </span>

              {/* Valor compacto */}
              <span
                style={{
                  fontSize: "11px",
                  color: barWidth > 0 ? "var(--text-secondary)" : "var(--text-muted)",
                  fontFamily: "var(--font-numeric)",
                  minWidth: "60px",
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {fmtCompact(d.valor)}
              </span>

              {/* Qtd. vendas */}
              {d.qtdVendas != null && (
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--text-muted)",
                    minWidth: "46px",
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {d.qtdVendas.toLocaleString("pt-BR")} vd.
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
