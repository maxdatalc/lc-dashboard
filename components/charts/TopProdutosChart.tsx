"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils/format";

export interface TopProdutoData {
  nome: string;
  valor: number;
  quantidade: number;
}

interface Props {
  data: TopProdutoData[];
}


// Cor e label do pódio
const RANK_STYLES: Record<number, { color: string; bg: string }> = {
  0: { color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },   // ouro
  1: { color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },  // prata
  2: { color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },  // bronze/roxo
};

function RankBadge({ rank }: { rank: number }) {
  const style = RANK_STYLES[rank] ?? { color: "#475569", bg: "rgba(71,85,105,0.12)" };
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center rounded-md text-[10px] font-bold tabular-nums"
      style={{
        width: 22,
        height: 22,
        backgroundColor: style.bg,
        color: style.color,
      }}
    >
      {rank + 1}
    </div>
  );
}

// Cores de gradiente para as barras por rank
const BAR_GRADIENTS: Record<number, [string, string]> = {
  0: ["#f59e0b", "#f59e0b33"],
  1: ["#94a3b8", "#94a3b833"],
  2: ["#a78bfa", "#a78bfa33"],
};
const DEFAULT_GRADIENT: [string, string] = ["#00e5ff", "#00e5ff22"];

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
  const maxVal = sorted[0]
    ? modo === "valor"
      ? sorted[0].valor
      : sorted[0].quantidade
    : 1;

  return (
    <div className="flex flex-col gap-3">
      {/* Toggle */}
      <div className="flex gap-1.5">
        {(["valor", "quantidade"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setModo(m)}
            className="px-3 py-0.5 rounded-full text-xs font-medium transition-all duration-150"
            style={
              modo === m
                ? { backgroundColor: "rgba(0,229,255,0.15)", color: "#00e5ff", border: "1px solid rgba(0,229,255,0.3)" }
                : { backgroundColor: "transparent", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.06)" }
            }
          >
            {m === "valor" ? "Valor" : "Qtd"}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-2.5">
        {sorted.slice(0, 8).map((produto, i) => {
          const current = modo === "valor" ? produto.valor : produto.quantidade;
          const pct = maxVal > 0 ? (current / maxVal) * 100 : 0;
          const [barFrom, barTo] = BAR_GRADIENTS[i] ?? DEFAULT_GRADIENT;
          const gradId = `grad-p-${i}`;

          return (
            <div
              key={i}
              className="flex items-center gap-2.5"
              style={{
                animation: "fadeInUp 0.3s ease-out both",
                animationDelay: `${i * 40}ms`,
              }}
            >
              <RankBadge rank={i} />

              {/* Nome + barra */}
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <span
                  className="text-xs truncate"
                  style={{ color: "var(--text-secondary)" }}
                  title={produto.nome}
                >
                  {produto.nome}
                </span>

                {/* Barra gradiente */}
                <div
                  className="relative rounded-full overflow-hidden"
                  style={{ height: 5, backgroundColor: "rgba(255,255,255,0.05)" }}
                >
                  <svg
                    className="absolute inset-0"
                    width="100%"
                    height="100%"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={barFrom} />
                        <stop offset="100%" stopColor={barTo} />
                      </linearGradient>
                    </defs>
                    <rect
                      x="0"
                      y="0"
                      width={`${pct}%`}
                      height="100%"
                      fill={`url(#${gradId})`}
                      rx="9999"
                      style={{ transition: "width 0.5s ease" }}
                    />
                  </svg>
                </div>
              </div>

              {/* Valor */}
              <span
                className="text-xs font-semibold tabular-nums text-right flex-shrink-0"
                style={{ color: "var(--text-primary)", minWidth: 68 }}
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
