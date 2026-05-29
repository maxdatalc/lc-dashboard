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
  precoVenda?: number | null;
  valorCusto?: number | null;
  margem?: number | null;
  estoqueAtual?: number | null;
}

export type TopProdutoData = ProdutoItem;

type Ordenacao = "valor" | "quantidade";

function formatMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function formatNumero(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(valor);
}

function getRankColor(index: number): string {
  if (index === 0) return "#f59e0b";
  if (index === 1) return "#94a3b8";
  if (index === 2) return "#a78bfa";
  return "#475569";
}

function getMargemStyle(margem: number): { background: string; color: string } {
  if (margem > 30) return { background: "rgba(16,185,129,0.15)", color: "#10b981" };
  if (margem >= 15) return { background: "rgba(245,158,11,0.15)", color: "#f59e0b" };
  return { background: "rgba(239,68,68,0.15)", color: "#ef4444" };
}

function MargemBadge({ margem }: { margem: number }) {
  const style = getMargemStyle(margem);

  return (
    <span
      style={{
        padding: "1px 6px",
        borderRadius: "4px",
        fontWeight: 600,
        background: style.background,
        color: style.color,
      }}
    >
      {margem.toFixed(1)}%
    </span>
  );
}

export function TopProdutosChart({ data }: { data: ProdutoItem[] }) {
  const [expandido, setExpandido] = useState<number | null>(null);
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("valor");

  if (!data.length) {
    return (
      <div className="flex items-center justify-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>
        Sem dados disponíveis
      </div>
    );
  }

  const produtos = [...data].sort((a, b) =>
    ordenacao === "valor" ? b.valor - a.valor : b.quantidade - a.quantidade
  );
  const maxValor = produtos[0] ? (ordenacao === "valor" ? produtos[0].valor : produtos[0].quantidade) : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
        {(["valor", "quantidade"] as const).map((modo) => {
          const ativo = ordenacao === modo;

          return (
            <button
              key={modo}
              type="button"
              onClick={() => setOrdenacao(modo)}
              style={{
                padding: "4px 12px",
                borderRadius: "999px",
                border: ativo ? "1px solid rgba(0,229,255,0.35)" : "1px solid rgba(255,255,255,0.06)",
                background: ativo ? "rgba(0,229,255,0.14)" : "transparent",
                color: ativo ? "#00e5ff" : "var(--text-muted)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
              }}
            >
              {modo === "valor" ? "Valor" : "Qtd"}
            </button>
          );
        })}
      </div>

      <div className="custom-scroll" style={{ height: "400px", overflowY: "auto", paddingRight: "4px" }}>
        {produtos.map((produto, i) => {
          const isExpanded = expandido === i;
          const valorBase = ordenacao === "valor" ? produto.valor : produto.quantidade;
          const progresso = maxValor > 0 ? Math.min((valorBase / maxValor) * 100, 100) : 0;
          const grupo = produto.grupoNome
            ? `Grupo: ${produto.grupoNome}${produto.subGrupo ? ` › ${produto.subGrupo}` : ""}`
            : produto.subGrupo
            ? `Grupo: ${produto.subGrupo}`
            : "";

          return (
            <div
              key={`${produto.codigo ?? produto.nome}-${i}`}
              onMouseEnter={() => setExpandido(i)}
              onMouseLeave={() => setExpandido(null)}
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                paddingBottom: "8px",
                marginBottom: "8px",
                cursor: "default",
              }}
            >
              {/* Linha principal do ranking */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    minWidth: "30px",
                    color: getRankColor(i),
                  }}
                >
                  #{i + 1}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <span
                      title={produto.nome}
                      style={{
                        fontSize: "12px",
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {produto.nome}
                    </span>
                    {produto.margem != null && <MargemBadge margem={produto.margem} />}
                  </div>

                  <div style={{ height: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "1px" }}>
                    <div
                      style={{
                        width: `${progresso}%`,
                        height: "100%",
                        borderRadius: "1px",
                        background: "linear-gradient(90deg, #00e5ff 0%, rgba(0,229,255,0.2) 100%)",
                        transition: "width 0.8s ease",
                      }}
                    />
                  </div>
                </div>

                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    flexShrink: 0,
                    fontFamily: "DM Serif Display, serif",
                    whiteSpace: "nowrap",
                  }}
                >
                  {ordenacao === "valor" ? formatMoeda(produto.valor) : `${formatNumero(produto.quantidade)} un.`}
                </span>
              </div>

              <div
                style={{
                  maxHeight: isExpanded ? "260px" : "0px",
                  opacity: isExpanded ? 1 : 0,
                  overflow: "hidden",
                  transition: "max-height 0.2s ease-out, opacity 0.2s ease-out",
                }}
              >
                <div
                  style={{
                    marginTop: "8px",
                    marginLeft: "40px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    borderLeft: "2px solid var(--accent-cyan)",
                    background: "rgba(0,229,255,0.04)",
                  }}
                >
                  {/* Lista vertical do hover */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {grupo && <InfoLinha icon="📦" texto={grupo} />}
                    {produto.codigo && <InfoLinha icon="🏷️" texto={`Cód: ${produto.codigo}`} />}
                    {produto.fabricante && <InfoLinha icon="🏭" texto={`Fabricante: ${produto.fabricante}`} />}
                    {produto.precoVenda != null && produto.precoVenda > 0 && (
                      <InfoLinha icon="💵" texto={`Preço venda: ${formatMoeda(produto.precoVenda)}`} />
                    )}
                    {produto.valorCusto != null && (
                      <InfoLinha icon="💰" texto={`Custo: ${formatMoeda(produto.valorCusto)}`} />
                    )}
                    {produto.margem != null && (
                      <InfoLinha
                        icon="📈"
                        texto=""
                        custom={
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                            Margem: <MargemBadge margem={produto.margem} />
                          </span>
                        }
                      />
                    )}
                    <InfoLinha icon="🔢" texto={`${produto.quantidade.toFixed(1)} un. vendidas no período`} />
                    {produto.estoqueAtual != null && (
                      <InfoLinha icon="📊" texto={`Estoque atual: ${formatNumero(produto.estoqueAtual)} un.`} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoLinha({ icon, texto, custom }: { icon: string; texto: string; custom?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
      <span style={{ fontSize: "16px", lineHeight: "1.4", flexShrink: 0 }}>{icon}</span>
      {custom ?? (
        <span
          style={{
            fontSize: "12px",
            color: "var(--text-secondary)",
            lineHeight: "1.4",
            minWidth: 0,
            overflowWrap: "anywhere",
          }}
        >
          {texto}
        </span>
      )}
    </div>
  );
}
