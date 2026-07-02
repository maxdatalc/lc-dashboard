"use client";

import { useEffect, useState } from "react";
import type { RankItem } from "@/lib/db/produtos-estoque";
import { fmtMoeda, fmtInt, fmtPct, COR_CUSTO, COR_VENDA } from "./utils";

interface BaseProps {
  items: RankItem[];
  selected: string | null;
  onSelect: (nome: string) => void;
}

// Larguras fixas das colunas numéricas — cabeçalho e linhas compartilham,
// garantindo alinhamento perfeito.
const COL_VALOR = 86;
const COL_PART = 46;

function RankBadge({ pos }: { pos: number }) {
  const top3 = pos <= 3;
  return (
    <span style={{
      width: 20, height: 20, borderRadius: 6, display: "inline-flex", alignItems: "center",
      justifyContent: "center", fontSize: 10.5, fontWeight: 700, flexShrink: 0,
      fontVariantNumeric: "tabular-nums",
      background: top3 ? "color-mix(in srgb, var(--accent-cyan) 13%, transparent)" : "var(--bg-elevated)",
      color: top3 ? "var(--accent-cyan)" : "var(--text-muted)",
    }}>
      {pos}
    </span>
  );
}

// ── Modo "dual": barra empilhada custo (âmbar) + margem (ciano) + colunas ──────

export function RankingDual({ items, selected, onSelect }: BaseProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 30); return () => clearTimeout(t); }, []);

  if (items.length === 0) return <EmptyRanking />;

  const maxVenda = Math.max(...items.map((i) => i.venda), 1);
  const totalCusto = items.reduce((s, i) => s + i.custo, 0);
  const hasSel = selected !== null;

  const hdr: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
    color: "var(--text-muted)", textAlign: "right", flexShrink: 0,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Cabeçalho: legenda à esquerda, títulos de coluna alinhados com os valores */}
      <div className="flex items-center gap-2 pb-2 mb-1 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)", paddingLeft: 6, paddingRight: 6 }}>
        <span style={{ width: 20, flexShrink: 0 }} />
        <div className="flex-1 flex items-center gap-3 min-w-0" style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Dot color={COR_CUSTO} /> Custo</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Dot color={COR_VENDA} /> Venda</span>
        </div>
        <span style={{ ...hdr, width: COL_VALOR }}>Custo</span>
        <span style={{ ...hdr, width: COL_VALOR }}>Venda</span>
        <span style={{ ...hdr, width: COL_PART }}>Part.</span>
      </div>

      {/* Lista com scroll interno — preenche a altura definida pela linha do grid */}
      <div className="custom-scroll flex flex-col flex-1" style={{ overflowY: "auto" }}>
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
              className="prod-row flex items-center gap-2 rounded-lg text-left w-full"
              style={{
                padding: "7px 6px",
                opacity: dim ? 0.38 : 1,
                background: isSel ? "color-mix(in srgb, var(--accent-cyan) 7%, transparent)" : undefined,
                cursor: "pointer",
              }}
              title={`Filtrar por ${it.nome}`}
            >
              <RankBadge pos={i + 1} />

              <div className="flex-1 min-w-0">
                <div className="truncate" style={{ fontSize: 12.5, fontWeight: 600, color: isSel ? "var(--accent-cyan)" : "var(--text-primary)", marginBottom: 4 }}>
                  {it.nome}
                </div>
                {/* Barra: comprimento ∝ venda; segmento âmbar ∝ custo, ciano = margem */}
                <div className="relative rounded-full overflow-hidden" style={{ height: 6, background: "var(--chart-track-bg)" }}>
                  <div className="absolute inset-y-0 left-0 flex rounded-full overflow-hidden" style={{ width: `${wVenda}%`, transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)" }}>
                    <div style={{ width: `${custoFrac * 100}%`, background: COR_CUSTO }} />
                    <div style={{ flex: 1, background: COR_VENDA }} />
                  </div>
                </div>
              </div>

              <span style={{ width: COL_VALOR, textAlign: "right", fontSize: 11, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmtMoeda(it.custo)}</span>
              <span style={{ width: COL_VALOR, textAlign: "right", fontSize: 11, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmtMoeda(it.venda)}</span>
              <span style={{ width: COL_PART, textAlign: "right", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmtPct(part)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Modo "qtd": barra simples + valor, com destaque para o primeiro colocado ───

export function RankingQtd({ items, selected, onSelect, color = COR_VENDA }: BaseProps & { color?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 30); return () => clearTimeout(t); }, []);

  if (items.length === 0) return <EmptyRanking />;

  const maxQtd = Math.max(...items.map((i) => i.qtd), 1);
  const hasSel = selected !== null;

  return (
    <div className="custom-scroll flex flex-col gap-0.5 h-full" style={{ overflowY: "auto" }}>
      {items.map((it, i) => {
        const isSel = selected === it.nome;
        const dim = hasSel && !isSel;
        const w = mounted ? (it.qtd / maxQtd) * 100 : 0;
        const lider = i === 0;
        return (
          <button
            type="button"
            key={it.nome + i}
            onClick={() => onSelect(it.nome)}
            className="prod-row flex items-center gap-2 rounded-lg text-left w-full"
            style={{
              padding: "6px 6px",
              opacity: dim ? 0.38 : 1,
              background: isSel ? "color-mix(in srgb, var(--accent-cyan) 7%, transparent)" : undefined,
              cursor: "pointer",
            }}
            title={`Filtrar por ${it.nome}`}
          >
            <span className="truncate" style={{ width: 100, fontSize: 11.5, fontWeight: lider ? 700 : 600, color: isSel ? color : lider ? "var(--text-primary)" : "var(--text-secondary)", flexShrink: 0 }}>
              {it.nome}
            </span>
            <div className="relative flex-1 rounded-full overflow-hidden" style={{ height: 12, background: "var(--chart-track-bg)" }}>
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${w}%`, background: color, opacity: isSel || lider ? 1 : 0.75, transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)" }} />
            </div>
            <span style={{ width: 64, textAlign: "right", fontSize: 11.5, fontWeight: lider ? 700 : 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
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
    <div className="flex items-center justify-center h-full py-8 text-xs" style={{ color: "var(--text-muted)" }}>
      Sem dados para os filtros atuais
    </div>
  );
}
