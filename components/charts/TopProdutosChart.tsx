"use client";

import { useState } from "react";

export interface TopProdutoData {
  nome: string;
  valor: number;
  quantidade: number;
}

interface Props {
  data: TopProdutoData[];
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000)
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
  if (value >= 1_000)
    return `R$ ${(value / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function truncate(s: string, max = 22): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export function TopProdutosChart({ data }: Props) {
  const [modo, setModo] = useState<"valor" | "quantidade">("valor");

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
    modo === "valor" ? b.valor - a.valor : b.quantidade - a.quantidade
  );
  const max = sorted[0]
    ? modo === "valor"
      ? sorted[0].valor
      : sorted[0].quantidade
    : 1;

  return (
    <div className="flex flex-col gap-3">
      {/* Toggle valor / qtd */}
      <div className="flex gap-1">
        {(["valor", "quantidade"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setModo(m)}
            className="px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors"
            style={
              modo === m
                ? {
                    backgroundColor: "var(--accent-cyan)",
                    color: "#0d1117",
                  }
                : {
                    backgroundColor: "var(--bg-primary)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-subtle)",
                  }
            }
          >
            {m === "valor" ? "Valor" : "Qtd"}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-2">
        {sorted.slice(0, 8).map((produto, i) => {
          const current = modo === "valor" ? produto.valor : produto.quantidade;
          const pct = max > 0 ? (current / max) * 100 : 0;

          return (
            <div key={i} className="flex items-center gap-2">
              {/* Nome */}
              <span
                className="text-xs w-[150px] flex-shrink-0 truncate"
                style={{ color: "var(--text-secondary)" }}
                title={produto.nome}
              >
                {truncate(produto.nome)}
              </span>

              {/* Barra */}
              <div
                className="flex-1 rounded-full overflow-hidden"
                style={{
                  height: "6px",
                  backgroundColor: "var(--border-subtle)",
                }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: "var(--accent-cyan)",
                  }}
                />
              </div>

              {/* Valor */}
              <span
                className="text-xs font-medium tabular-nums text-right flex-shrink-0 w-[72px]"
                style={{ color: "var(--text-primary)" }}
              >
                {modo === "valor"
                  ? formatCurrency(produto.valor)
                  : `${produto.quantidade.toLocaleString("pt-BR")} un`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
