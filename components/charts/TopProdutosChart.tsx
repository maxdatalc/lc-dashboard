"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export interface ProdutoItem {
  nome: string;
  valor: number;
  quantidade: number;
  codigo?: string | null;
  grupoNome?: string | null;
  subGrupo?: string | null;
  fabricante?: string | null;
  precoVenda?: number;
  valorCusto?: number | null;
  margem?: number | null;
  estoqueAtual?: number | null;
}

export type TopProdutoData = ProdutoItem;

interface Props {
  data: ProdutoItem[];
}

type SortMode = "valor" | "quantidade";

const RANK_STYLES: Record<number, { color: string; bg: string }> = {
  0: { color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  1: { color: "#cbd5e1", bg: "rgba(203,213,225,0.12)" },
  2: { color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
};

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatNumberBR(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function RankBadge({ rank }: { rank: number }) {
  const style = RANK_STYLES[rank] ?? { color: "#94a3b8", bg: "rgba(148,163,184,0.10)" };

  return (
    <span
      style={{
        width: 30,
        height: 24,
        borderRadius: 6,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: style.bg,
        color: style.color,
        fontSize: 11,
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      #{rank + 1}
    </span>
  );
}

function InfoItem({
  icon,
  children,
  wide,
}: {
  icon: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        minWidth: 0,
        gridColumn: wide ? "1 / -1" : undefined,
      }}
    >
      <span style={{ fontSize: 12, flexShrink: 0 }}>{icon}</span>
      <span
        style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </span>
    </div>
  );
}

function MarginBadge({ margem }: { margem: number }) {
  const style =
    margem > 30
      ? { bg: "rgba(16,185,129,0.15)", color: "#10b981" }
      : margem >= 15
      ? { bg: "rgba(245,158,11,0.15)", color: "#f59e0b" }
      : { bg: "rgba(239,68,68,0.15)", color: "#ef4444" };

  return (
    <span
      style={{
        padding: "1px 6px",
        borderRadius: 4,
        background: style.bg,
        color: style.color,
        fontSize: 11,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {formatNumberBR(margem)}%
    </span>
  );
}

export function TopProdutosChart({ data }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("valor");

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center py-8 text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        Sem dados disponíveis
      </div>
    );
  }

  const sorted = [...data].sort((a, b) =>
    sortMode === "valor" ? b.valor - a.valor : b.quantidade - a.quantidade
  );
  const maxValue = sorted[0] ? (sortMode === "valor" ? sorted[0].valor : sorted[0].quantidade) : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
        {(["valor", "quantidade"] as const).map((mode) => {
          const active = sortMode === mode;

          return (
            <button
              key={mode}
              type="button"
              onClick={() => setSortMode(mode)}
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                border: active ? "1px solid rgba(0,229,255,0.35)" : "1px solid rgba(255,255,255,0.06)",
                background: active ? "rgba(0,229,255,0.14)" : "transparent",
                color: active ? "#00e5ff" : "var(--text-muted)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.15s, color 0.15s, border-color 0.15s",
              }}
            >
              {mode === "valor" ? "Valor" : "Qtd"}
            </button>
          );
        })}
      </div>

      <div className="custom-scroll" style={{ height: 380, overflowY: "auto", paddingRight: 4 }}>
        {sorted.map((produto, index) => {
          const currentValue = sortMode === "valor" ? produto.valor : produto.quantidade;
          const progress = maxValue > 0 ? Math.min((currentValue / maxValue) * 100, 100) : 0;
          const isHovered = hoveredIndex === index;
          const grupoLabel = produto.grupoNome
            ? `Grupo: ${produto.grupoNome}${produto.subGrupo ? ` -> Sub-grupo: ${produto.subGrupo}` : ""}`
            : produto.subGrupo
            ? `Sub-grupo: ${produto.subGrupo}`
            : null;

          return (
            <div
              key={`${produto.codigo ?? produto.nome}-${index}`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                padding: "10px 0",
                paddingLeft: isHovered ? 8 : 0,
                paddingRight: 4,
                borderBottom: "1px solid var(--border-subtle)",
                borderRadius: 8,
                background: isHovered ? "rgba(0,229,255,0.03)" : "transparent",
                cursor: "default",
                transition: "background 0.15s, padding-left 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <RankBadge rank={index} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span
                      title={produto.nome}
                      style={{
                        color: "var(--text-primary)",
                        fontSize: 13,
                        fontWeight: 500,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {produto.nome}
                    </span>
                    {produto.margem != null && <MarginBadge margem={produto.margem} />}
                  </div>

                  <div
                    style={{
                      marginTop: 5,
                      height: 4,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.05)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${progress}%`,
                        height: "100%",
                        borderRadius: 999,
                        background: "linear-gradient(90deg, #00e5ff, rgba(0,229,255,0.18))",
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    color: "var(--text-primary)",
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: "right",
                    minWidth: 96,
                    flexShrink: 0,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {sortMode === "valor"
                    ? formatCurrencyBRL(produto.valor)
                    : `${formatNumberBR(produto.quantidade)} un`}
                </div>
              </div>

              {isHovered && (
                <div
                  style={{
                    marginTop: 10,
                    marginLeft: 40,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: "7px 16px",
                    animation: "fadeInUp 0.15s ease-out",
                  }}
                >
                  {grupoLabel && (
                    <InfoItem icon="📦" wide>
                      {grupoLabel}
                    </InfoItem>
                  )}
                  {produto.codigo && <InfoItem icon="🏷️">Código: {produto.codigo}</InfoItem>}
                  {produto.fabricante && <InfoItem icon="🏭">Fabricante: {produto.fabricante}</InfoItem>}
                  {produto.precoVenda != null && (
                    <InfoItem icon="💵">Preço venda: {formatCurrencyBRL(produto.precoVenda)}</InfoItem>
                  )}
                  {produto.valorCusto != null && (
                    <InfoItem icon="💰">Custo: {formatCurrencyBRL(produto.valorCusto)}</InfoItem>
                  )}
                  {produto.margem != null && (
                    <InfoItem icon="📈">
                      Margem: <MarginBadge margem={produto.margem} />
                    </InfoItem>
                  )}
                  <InfoItem icon="🔢">
                    {formatNumberBR(produto.quantidade)} un vendidas no período
                  </InfoItem>
                  {produto.estoqueAtual != null && (
                    <InfoItem icon="📊">Estoque atual: {formatNumberBR(produto.estoqueAtual)} un</InfoItem>
                  )}
                  <InfoItem icon="💵">Valor vendido: {formatCurrencyBRL(produto.valor)}</InfoItem>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
