"use client";

import { useEffect, useState } from "react";
import type { RankItem } from "@/lib/db/produtos-estoque";
import { fmtMoeda, fmtInt, fmtPct, COR_CUSTO, COR_VENDA } from "./utils";

interface BaseProps {
  items: RankItem[];
  selected: string | null;
  onSelect: (nome: string) => void;
}

// ── Modo "dual": barra empilhada custo (âmbar) + margem (ciano) + colunas ──────

export function RankingDual({ items, selected, onSelect }: BaseProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 30); return () => clearTimeout(t); }, []);

  if (items.length === 0) return <EmptyRanking />;

  const maxVenda = Math.max(...items.map((i) => i.venda), 1);
  const totalCusto = items.reduce((s, i) => s + i.custo, 0);
  const hasSel = selected !== null;

  return (
    <div className="flex flex-col">
      {/* Cabeçalho de colunas (fixo) */}
      <div className="flex items-center gap-2 px-1 pb-2" style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Dot color={COR_CUSTO} /> Custo
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Dot color={COR_VENDA} /> Venda
        </span>
        <span className="ml-auto" style={{ width: 78, textAlign: "right" }}>Custo</span>
        <span style={{ width: 78, textAlign: "right" }}>Venda</span>
        <span style={{ width: 44, textAlign: "right" }}>Part.</span>
      </div>

      {/* Lista com scroll interno — evita que o card cresça indefinidamente */}
      <div className="custom-scroll flex flex-col" style={{ maxHeight: 272, overflowY: "auto" }}>
      {items.map((it, i) => {
        const isSel = selected === it.nome;
        const dim = hasSel && !isSel;
        const wVenda = mounted ? (it.venda / maxVenda) * 100 : 0;
        const custoFrac = it.venda > 0 ? Math.min(1, it.custo / it.venda) : 1;
        const part = totalCusto > 0 ? (it.custo / totalCusto) * 100 : 0;

        return (
          <button
            type="button"
            key={it.nome + i}
            onClick={() => onSelect(it.nome)}
            className="flex items-center gap-2 rounded-lg transition-all text-left"
            style={{
              padding: "5px 6px",
              opacity: dim ? 0.4 : 1,
              background: isSel ? "rgba(34,211,238,0.06)" : "transparent",
              cursor: "pointer",
            }}
            title={`Filtrar por ${it.nome}`}
          >
            <span style={{ width: 16, fontSize: 11, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{i + 1}</span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="truncate" style={{ fontSize: 12, fontWeight: 600, color: isSel ? COR_VENDA : "var(--text-primary)", maxWidth: 150 }}>
                  {it.nome}
                </span>
              </div>
              {/* Barra: comprimento ∝ venda; segmento âmbar ∝ custo, ciano = margem */}
              <div className="relative rounded-full overflow-hidden" style={{ height: 6, background: "var(--chart-track-bg)" }}>
                <div className="absolute inset-y-0 left-0 flex rounded-full overflow-hidden" style={{ width: `${wVenda}%`, transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)" }}>
                  <div style={{ width: `${custoFrac * 100}%`, background: COR_CUSTO }} />
                  <div style={{ flex: 1, background: COR_VENDA }} />
                </div>
              </div>
            </div>

            <span style={{ width: 78, textAlign: "right", fontSize: 11, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmtMoeda(it.custo)}</span>
            <span style={{ width: 78, textAlign: "right", fontSize: 11, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmtMoeda(it.venda)}</span>
            <span style={{ width: 44, textAlign: "right", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmtPct(part)}</span>
          </button>
        );
      })}
      </div>
    </div>
  );
}

// ── Modo "qtd": barra simples ciano + valor ────────────────────────────────────

export function RankingQtd({ items, selected, onSelect, color = COR_VENDA }: BaseProps & { color?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 30); return () => clearTimeout(t); }, []);

  if (items.length === 0) return <EmptyRanking />;

  const maxQtd = Math.max(...items.map((i) => i.qtd), 1);
  const hasSel = selected !== null;

  return (
    <div className="custom-scroll flex flex-col gap-0.5" style={{ maxHeight: 300, overflowY: "auto" }}>
      {items.map((it, i) => {
        const isSel = selected === it.nome;
        const dim = hasSel && !isSel;
        const w = mounted ? (it.qtd / maxQtd) * 100 : 0;
        return (
          <button
            type="button"
            key={it.nome + i}
            onClick={() => onSelect(it.nome)}
            className="flex items-center gap-2 rounded-lg transition-all text-left"
            style={{ padding: "4px 6px", opacity: dim ? 0.4 : 1, background: isSel ? "rgba(34,211,238,0.06)" : "transparent", cursor: "pointer" }}
            title={`Filtrar por ${it.nome}`}
          >
            <span className="truncate" style={{ width: 96, fontSize: 11.5, fontWeight: 600, color: isSel ? color : "var(--text-secondary)", flexShrink: 0 }}>
              {it.nome}
            </span>
            <div className="relative flex-1 rounded-full overflow-hidden" style={{ height: 14, background: "var(--chart-track-bg)" }}>
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${w}%`, background: color, opacity: isSel ? 1 : 0.85, transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)" }} />
            </div>
            <span style={{ width: 58, textAlign: "right", fontSize: 11.5, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
              {fmtInt(it.qtd)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block" }} />;
}

function EmptyRanking() {
  return (
    <div className="flex items-center justify-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>
      Sem dados para os filtros atuais
    </div>
  );
}
