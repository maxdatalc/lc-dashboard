"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils/format";
import { Clock, Zap } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PieAny = Pie as any;

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
  "#2563eb", "#f59e0b", "#10b981", "#7c3aed",
  "#f97316", "#ef4444", "#06b6d4", "#84cc16",
  "#ec4899", "#6366f1",
];

const KEYWORDS_PRAZO = ["carteira", "credito", "cheque", "boleto", "financ", "crediario", "convenio", "promissoria", "parcel", "prazo", "faturado"];
const KEYWORDS_VISTA = ["dinheiro", "debito", "pix", "deposito", "ted", "doc", "transfer", "especie", "voucher", "vista", "espécie"];

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function classificar(nome: string): "prazo" | "vista" {
  const n = norm(nome);
  if (KEYWORDS_PRAZO.some((k) => n.includes(k))) return "prazo";
  if (KEYWORDS_VISTA.some((k) => n.includes(k))) return "vista";
  return "prazo";
}

function fmtPct(p: number): string {
  if (p <= 0) return "0%";
  if (p < 1) return "<1%";
  return `${Math.round(p)}%`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActiveSlice(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius - 2}
      outerRadius={outerRadius + 7}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  );
}

export function FormasPagamentoChart({ data }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const top10 = data.slice(0, 10);

  if (!top10.length) {
    return (
      <div className="flex items-center justify-center text-xs" style={{ height: 220, color: "var(--text-muted)" }}>
        Sem dados disponíveis
      </div>
    );
  }

  // atribui índice global para manter cor consistente donut ↔ lista
  const withIdx = top10.map((d, i) => ({ ...d, idx: i }));
  const prazo   = withIdx.filter((d) => classificar(d.nome) === "prazo");
  const vista   = withIdx.filter((d) => classificar(d.nome) === "vista");
  const grupos  = [
    { key: "prazo", label: "A prazo",  Icon: Clock, items: prazo },
    { key: "vista", label: "À vista",  Icon: Zap,   items: vista },
  ].filter((g) => g.items.length > 0);

  const displayed      = activeIndex !== undefined ? top10[activeIndex] : top10[0];
  const displayedColor = activeIndex !== undefined ? CORES[activeIndex % CORES.length] : CORES[0];

  return (
    <div className="flex gap-4 items-start">

      {/* ── Donut ────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 relative" style={{ width: 160, height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <PieAny
              data={top10}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={73}
              paddingAngle={2}
              dataKey="valor"
              strokeWidth={0}
              activeIndex={activeIndex}
              activeShape={ActiveSlice}
              onMouseEnter={(_: unknown, index: number) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              {top10.map((_, i) => (
                <Cell
                  key={i}
                  fill={CORES[i % CORES.length]}
                  opacity={activeIndex !== undefined && activeIndex !== i ? 0.25 : 1}
                />
              ))}
            </PieAny>
          </PieChart>
        </ResponsiveContainer>

        {/* Centro */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            style={{
              fontSize: "1.4rem", fontWeight: 700, lineHeight: 1,
              color: displayedColor, fontVariantNumeric: "tabular-nums",
              fontFamily: "var(--font-numeric)",
              transition: "color 0.15s",
            }}
          >
            {fmtPct(displayed?.percentual ?? 0)}
          </span>
          <span
            style={{
              fontSize: 10, color: "var(--text-muted)", marginTop: 4,
              maxWidth: 76, textAlign: "center",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {displayed?.nome ?? ""}
          </span>
        </div>
      </div>

      {/* ── Grupos A prazo / À vista ─────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 gap-2">
        {grupos.map((grupo, gi) => {
          const GIcon = grupo.Icon;
          return (
            <div key={grupo.key}>
              {gi > 0 && (
                <div style={{ height: 1, background: "var(--border-subtle)", margin: "6px 0" }} />
              )}

              {/* Cabeçalho do grupo */}
              <div className="flex items-center gap-1.5 mb-2">
                <div
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 20, height: 20, borderRadius: 6,
                    background: "var(--card-header-bg)",
                    border: "1px solid var(--card-header-border)",
                    flexShrink: 0,
                  }}
                >
                  <GIcon style={{ width: 11, height: 11, color: "var(--accent-cyan)" }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.01em" }}>
                  {grupo.label}
                </span>
              </div>

              {/* Linhas de pagamento */}
              {grupo.items.map((d) => {
                const cor     = CORES[d.idx % CORES.length];
                const isActive = activeIndex === d.idx;
                return (
                  <div
                    key={d.nome}
                    style={{
                      opacity: activeIndex !== undefined && !isActive ? 0.35 : 1,
                      transition: "opacity 0.15s",
                      cursor: "default",
                      marginBottom: 6,
                    }}
                    onMouseEnter={() => setActiveIndex(d.idx)}
                    onMouseLeave={() => setActiveIndex(undefined)}
                  >
                    {/* Linha 1: dot + nome + % */}
                    <div className="flex items-center gap-1.5">
                      <div style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: cor, flexShrink: 0,
                      }} />
                      <span style={{
                        fontSize: 11, color: "var(--text-secondary)",
                        flex: 1, minWidth: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {d.nome}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: cor,
                        fontVariantNumeric: "tabular-nums", flexShrink: 0,
                      }}>
                        {fmtPct(d.percentual)}
                      </span>
                    </div>

                    {/* Linha 2: valor + vendas */}
                    <div
                      className="flex items-center justify-between"
                      style={{ paddingLeft: 14, marginTop: 1 }}
                    >
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: "var(--text-primary)",
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {formatCurrency(d.valor)}
                      </span>
                      {d.qtdVendas != null && (
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                          {d.qtdVendas.toLocaleString("pt-BR")} {d.qtdVendas === 1 ? "venda" : "vendas"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
