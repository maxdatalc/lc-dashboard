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
  selectedNome?: string | null;
  onSelect?: (nome: string | null) => void;
}

const CORES = [
  "#3b82f6", "#f59e0b", "#10b981", "#7c3aed",
  "#f97316", "#ef4444", "#06b6d4", "#84cc16",
  "#ec4899", "#6366f1",
];

const KEYWORDS_PRAZO = ["carteira", "credito", "cheque", "boleto", "financ", "crediario", "convenio", "promissoria", "parcel", "prazo", "faturado"];
const KEYWORDS_VISTA = ["dinheiro", "debito", "pix", "deposito", "ted", "doc", "transfer", "especie", "voucher", "vista"];

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function classificar(nome: string): "prazo" | "vista" {
  const n = norm(nome);
  if (KEYWORDS_PRAZO.some(k => n.includes(k))) return "prazo";
  if (KEYWORDS_VISTA.some(k => n.includes(k))) return "vista";
  return "prazo";
}

function fmtPct(p: number) {
  if (p <= 0) return "0%";
  if (p < 1) return "<1%";
  return `${Math.round(p)}%`;
}

function fmtCompact(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}k`;
  return `R$ ${Math.round(v)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActiveSlice(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx} cy={cy}
      innerRadius={innerRadius - 2} outerRadius={outerRadius + 6}
      startAngle={startAngle} endAngle={endAngle}
      fill={fill}
    />
  );
}

export function FormasPagamentoChart({ data, selectedNome, onSelect }: Props) {
  const [hoverNome, setHoverNome] = useState<string | null>(null);

  const top10 = data.slice(0, 10);

  if (!top10.length) {
    return (
      <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--text-muted)" }}>
        Sem dados disponíveis
      </div>
    );
  }

  const colorMap = new Map(top10.map((d, i) => [d.nome, CORES[i % CORES.length]]));
  const vista    = top10.filter(d => classificar(d.nome) === "vista");
  const prazo    = top10.filter(d => classificar(d.nome) === "prazo");
  const totalVista  = vista.reduce((s, d) => s + d.valor, 0);
  const totalPrazo  = prazo.reduce((s, d) => s + d.valor, 0);
  const totalGeral  = totalVista + totalPrazo;
  const pctVista    = totalGeral > 0 ? (totalVista / totalGeral) * 100 : 0;
  const pctPrazo    = totalGeral > 0 ? (totalPrazo / totalGeral) * 100 : 0;
  const totalVendas = top10.reduce((s, d) => s + (d.qtdVendas ?? 0), 0);

  const activeNome  = hoverNome ?? selectedNome ?? null;
  const activeIndex = activeNome ? top10.findIndex(d => d.nome === activeNome) : -1;
  const centerItem  = activeNome ? top10.find(d => d.nome === activeNome) : null;

  function handleClick(nome: string) {
    if (!onSelect) return;
    onSelect(selectedNome === nome ? null : nome);
  }

  function renderMethod(d: FormasPagamentoData) {
    const cor        = colorMap.get(d.nome) ?? "#6366f1";
    const isActive   = activeNome === d.nome;
    const isSelected = selectedNome === d.nome;
    const dimmed     = activeNome !== null && !isActive;
    // bar width = absolute % of total (matches visual weight from image)
    const barW = Math.min(d.percentual, 100);

    return (
      <div
        key={d.nome}
        style={{
          opacity: dimmed ? 0.28 : 1,
          transition: "opacity 0.15s",
          cursor: onSelect ? "pointer" : "default",
          marginBottom: 8,
          padding: "4px 6px",
          borderRadius: 5,
          background: isSelected ? `${cor}12` : "transparent",
          border: `1px solid ${isSelected ? cor + "40" : "transparent"}`,
        }}
        onClick={() => handleClick(d.nome)}
        onMouseEnter={() => setHoverNome(d.nome)}
        onMouseLeave={() => setHoverNome(null)}
      >
        {/* Row: dot · name · % · value */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: cor, flexShrink: 0 }} />
          <span style={{
            fontSize: 11, color: "var(--text-secondary)", flex: 1,
            minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {d.nome}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: cor, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
            {fmtPct(d.percentual)}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", flexShrink: 0, marginLeft: 6 }}>
            {formatCurrency(d.valor)}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: "var(--border-subtle)", borderRadius: 2, marginTop: 5 }}>
          <div style={{ height: "100%", width: `${barW}%`, background: cor, borderRadius: 2, transition: "width 0.5s ease" }} />
        </div>

        {/* Vendas count */}
        {d.qtdVendas != null && (
          <div style={{ textAlign: "right", fontSize: 9.5, color: "var(--text-muted)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
            {d.qtdVendas.toLocaleString("pt-BR")} {d.qtdVendas === 1 ? "venda" : "vendas"}
          </div>
        )}
      </div>
    );
  }

  function renderSectionHeader(label: string, total: number, Icon: typeof Zap, color: string) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 6, marginBottom: 6,
        padding: "4px 6px", borderRadius: 5, background: `${color}10`,
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: 5, background: `${color}1e`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon style={{ width: 11, height: 11, color }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", flex: 1, letterSpacing: "0.03em" }}>
          {label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-numeric)" }}>
          {formatCurrency(total)}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

      {/* ── Left: Donut + summary pills ─────────────────────────────── */}
      <div style={{ flexShrink: 0, width: 170 }}>
        <div style={{ position: "relative", width: 160, height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <PieAny
                data={top10}
                cx="50%" cy="50%"
                innerRadius={52} outerRadius={74}
                paddingAngle={2}
                dataKey="valor"
                strokeWidth={0}
                activeIndex={activeIndex >= 0 ? activeIndex : undefined}
                activeShape={ActiveSlice}
                onMouseEnter={(_: unknown, idx: number) => setHoverNome(top10[idx]?.nome ?? null)}
                onMouseLeave={() => setHoverNome(null)}
                onClick={(_: unknown, idx: number) => { if (top10[idx]) handleClick(top10[idx].nome); }}
              >
                {top10.map((d, i) => (
                  <Cell
                    key={d.nome}
                    fill={colorMap.get(d.nome) ?? CORES[i]}
                    opacity={activeNome !== null && activeNome !== d.nome ? 0.22 : 1}
                    style={{ cursor: onSelect ? "pointer" : "default" }}
                  />
                ))}
              </PieAny>
            </PieChart>
          </ResponsiveContainer>

          {/* Center label */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            {centerItem ? (
              <>
                <span style={{
                  fontSize: "1.25rem", fontWeight: 700, lineHeight: 1,
                  color: colorMap.get(centerItem.nome) ?? "var(--text-primary)",
                  fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-numeric)",
                  transition: "color 0.15s",
                }}>
                  {fmtPct(centerItem.percentual)}
                </span>
                <span style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 3, maxWidth: 76, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {centerItem.nome}
                </span>
              </>
            ) : (
              <>
                <span style={{
                  fontSize: "1.25rem", fontWeight: 700, lineHeight: 1,
                  color: "var(--text-primary)",
                  fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-numeric)",
                }}>
                  {fmtCompact(totalGeral)}
                </span>
                <span style={{ fontSize: 9.5, color: "var(--text-muted)", marginTop: 3 }}>
                  {totalVendas.toLocaleString("pt-BR")} vendas
                </span>
              </>
            )}
          </div>
        </div>

        {/* À VISTA / A PRAZO pills */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {pctVista > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "rgba(245,158,11,0.14)", color: "#f59e0b", whiteSpace: "nowrap" }}>
              À VISTA {Math.round(pctVista)}%
            </span>
          )}
          {pctPrazo > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "rgba(59,130,246,0.14)", color: "#3b82f6", whiteSpace: "nowrap" }}>
              A PRAZO {Math.round(pctPrazo)}%
            </span>
          )}
        </div>
      </div>

      {/* ── Right: method breakdown by section ──────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {vista.length > 0 && (
          <div>
            {renderSectionHeader("À VISTA", totalVista, Zap, "#f59e0b")}
            {vista.map(d => renderMethod(d))}
          </div>
        )}

        {vista.length > 0 && prazo.length > 0 && (
          <div style={{ height: 1, background: "var(--border-subtle)", margin: "10px 0" }} />
        )}

        {prazo.length > 0 && (
          <div>
            {renderSectionHeader("A PRAZO", totalPrazo, Clock, "#3b82f6")}
            {prazo.map(d => renderMethod(d))}
          </div>
        )}
      </div>
    </div>
  );
}
