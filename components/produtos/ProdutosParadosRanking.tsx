"use client";

import type { ProdutoParadoItem } from "@/lib/db/produtos-estoque";
import { fmtMoeda, fmtInt } from "./utils";

const COR_PARADO = "#f43f5e";

export function ProdutosParadosRanking({ items }: { items: ProdutoParadoItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-center px-4" style={{ color: "var(--text-muted)" }}>
        Nenhum produto parado na janela selecionada.
      </div>
    );
  }

  const maxValor = Math.max(...items.map((i) => i.valorParado), 1);

  return (
    <div className="custom-scroll flex flex-col gap-0.5 h-full" style={{ overflowY: "auto" }}>
      {items.map((it, i) => {
        const w = (it.valorParado / maxValor) * 100;
        return (
          <div key={it.proId + "-" + i} className="flex flex-col gap-1 rounded-lg" style={{ padding: "5px 6px" }}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate" style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }} title={it.nome}>
                {it.nome}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: COR_PARADO, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                {fmtMoeda(it.valorParado)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 rounded-full overflow-hidden" style={{ height: 5, background: "var(--chart-track-bg)" }}>
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${w}%`, background: COR_PARADO, opacity: 0.85, transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)" }} />
              </div>
              <span style={{ fontSize: 10.5, color: "var(--text-muted)", flexShrink: 0 }}>
                {fmtInt(it.estoqueAtual)} un · {it.marca}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
