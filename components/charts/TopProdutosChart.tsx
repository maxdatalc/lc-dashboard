"use client";

import { useState } from "react";
import {
  Package, Tag, Factory, Banknote, Wallet, TrendingUp, Hash, ChevronDown,
} from "lucide-react";

export interface ProdutoItem {
  nome: string;
  valor: number;
  quantidade: number;
  externalId?: number | null;
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

function InfoLinha({
  icon: Icon,
  texto,
}: {
  icon: React.ElementType;
  texto: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
      <Icon
        style={{
          width: 13,
          height: 13,
          flexShrink: 0,
          marginTop: 1,
          color: "var(--text-muted)",
        }}
      />
      <span
        style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4" }}
      >
        {texto}
      </span>
    </div>
  );
}

export function TopProdutosChart({ data }: { data: ProdutoItem[] }) {
  const [modo, setModo] = useState<"valor" | "qtd">("valor");
  const [expandido, setExpandido] = useState<number | null>(null);

  const formatMoeda = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

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

  const lista = [...data].sort((a, b) =>
    modo === "valor" ? b.valor - a.valor : b.quantidade - a.quantidade
  );

  const maxValor = lista[0]?.valor ?? 1;
  const maxQtd = lista[0]?.quantidade ?? 1;

  const corMargem = (m: number) => {
    if (m > 30) return { bg: "rgba(16,185,129,0.15)", text: "#10b981" };
    if (m > 15) return { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" };
    return { bg: "rgba(239,68,68,0.15)", text: "#ef4444" };
  };

  const corRanking = (i: number) => {
    if (i === 0) return "#f59e0b";
    if (i === 1) return "#94a3b8";
    if (i === 2) return "#a78bfa";
    return "var(--text-muted)";
  };

  return (
    <div>
      {/* Toggle Valor/Qtd */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
        {(["valor", "qtd"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModo(m)}
            style={{
              padding: "3px 12px",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: 500,
              border: "1px solid",
              cursor: "pointer",
              background: modo === m ? "var(--accent-cyan)" : "transparent",
              borderColor: modo === m ? "var(--accent-cyan)" : "var(--toggle-inactive-border)",
              color: modo === m ? "#0a0f1e" : "var(--toggle-inactive-color)",
              transition: "all 0.15s",
            }}
          >
            {m === "valor" ? "Valor" : "Qtd"}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div
        className="custom-scroll"
        style={{ height: "210px", overflowY: "auto", paddingRight: "4px" }}
      >
        {lista.map((produto, i) => {
          const isExpanded = expandido === i;
          const barraWidth =
            modo === "valor"
              ? (produto.valor / maxValor) * 100
              : (produto.quantidade / maxQtd) * 100;

          return (
            <div
              key={i}
              onClick={() => setExpandido(expandido === i ? null : i)}
              style={{
                borderBottom: "1px solid var(--chart-item-border)",
                paddingBottom: "5px",
                marginBottom: "4px",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    minWidth: "24px",
                    flexShrink: 0,
                    color: corRanking(i),
                    fontFamily: "var(--font-numeric)",
                  }}
                >
                  {i + 1}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ marginBottom: "4px" }}>
                    <span
                      title={produto.nome}
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "block",
                        maxWidth: "clamp(100px, 35vw, 200px)",
                      }}
                    >
                      {produto.nome}
                    </span>
                  </div>
                  <div
                    style={{
                      height: "3px",
                      background: "var(--chart-track-bg)",
                      borderRadius: "2px",
                    }}
                  >
                    <div
                      style={{
                        width: `${barraWidth}%`,
                        height: "100%",
                        borderRadius: "2px",
                        background: "linear-gradient(90deg, var(--accent-cyan) 0%, rgba(0,229,255,0.25) 100%)",
                        transition: "width 0.8s ease",
                      }}
                    />
                  </div>
                </div>

                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    flexShrink: 0,
                    fontFamily: "var(--font-numeric)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {modo === "valor"
                    ? formatMoeda(produto.valor)
                    : `${produto.quantidade.toFixed(0)} un`}
                </span>

                <ChevronDown
                  style={{
                    width: 12,
                    height: 12,
                    color: "var(--text-muted)",
                    flexShrink: 0,
                    transition: "transform 0.2s ease",
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              </div>

              {/* Painel expandido */}
              {isExpanded && (
                <div
                  style={{
                    marginTop: "8px",
                    marginLeft: "34px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    borderLeft: "2px solid var(--accent-cyan)",
                    background: "rgba(0,229,255,0.04)",
                    animation: "fadeInUp 0.15s ease-out",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {produto.grupoNome && (
                      <InfoLinha
                        icon={Package}
                        texto={
                          produto.subGrupo
                            ? `${produto.grupoNome.trim()} › ${produto.subGrupo.trim()}`
                            : produto.grupoNome.trim()
                        }
                      />
                    )}
                    {produto.externalId != null && (
                      <InfoLinha icon={Tag} texto={`Cód: ${produto.externalId}`} />
                    )}
                    {produto.fabricante && (
                      <InfoLinha icon={Factory} texto={produto.fabricante} />
                    )}
                    {produto.precoVenda != null && produto.precoVenda > 0 && (
                      <InfoLinha
                        icon={Banknote}
                        texto={`Preço venda: ${formatMoeda(produto.precoVenda)}`}
                      />
                    )}
                    {produto.valorCusto != null && produto.valorCusto > 0 && (
                      <InfoLinha
                        icon={Wallet}
                        texto={`Custo unitário: ${formatMoeda(produto.valorCusto)}`}
                      />
                    )}
                    {produto.margem != null && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <TrendingUp
                          style={{ width: 13, height: 13, flexShrink: 0, color: "var(--text-muted)" }}
                        />
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                          Margem:{" "}
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontWeight: 600,
                              fontSize: "11px",
                              background: corMargem(produto.margem).bg,
                              color: corMargem(produto.margem).text,
                            }}
                          >
                            {produto.margem.toFixed(1)}%
                          </span>
                        </span>
                      </div>
                    )}
                    <InfoLinha
                      icon={Hash}
                      texto={`${produto.quantidade.toFixed(0)} un. vendidas no período`}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
