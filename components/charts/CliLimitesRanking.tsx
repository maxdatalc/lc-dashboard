"use client";

import { CreditCard, X } from "lucide-react";

export interface CliLimiteItem {
  cliId: number;
  nome: string;
  valor: number;
  cidade: string;
  uf: string;
}

interface Props {
  data: CliLimiteItem[];
  selectedCliId?: number | null;
  onSelect?: (cliId: number | null) => void;
  onVerTodos?: () => void;
}

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function getRankColor(i: number) {
  if (i === 0) return "#f59e0b";
  if (i === 1) return "#94a3b8";
  if (i === 2) return "#a78bfa";
  return "var(--text-muted)";
}

export function CliLimitesRanking({ data, selectedCliId, onSelect, onVerTodos }: Props) {
  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <CreditCard size={28} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Nenhum limite de crédito definido</p>
        <p className="text-[11px]" style={{ color: "var(--text-muted)", opacity: 0.7, maxWidth: 240 }}>
          Assim que os clientes tiverem limite cadastrado no ERP, o ranking aparece aqui.
        </p>
      </div>
    );
  }

  const ordenado = [...data].sort((a, b) => b.valor - a.valor);
  const top = ordenado.slice(0, 8);
  const max = top[0]?.valor ?? 1;
  const totalGeral = ordenado.reduce((s, c) => s + c.valor, 0);
  const top10 = ordenado.slice(0, 10).reduce((s, c) => s + c.valor, 0);
  const concentracao = totalGeral > 0 ? (top10 / totalGeral) * 100 : 0;

  return (
    <div className="flex flex-col gap-3">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--accent-cyan)", padding: "3px 8px", borderRadius: 20, background: "color-mix(in srgb, var(--accent-cyan) 12%, transparent)" }}>
          Top 10 concentram {concentracao.toFixed(1)}% do limite
        </span>
        {onVerTodos && (
          <button onClick={onVerTodos} style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", background: "none", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "3px 10px", cursor: "pointer" }}>
            Ver todos
          </button>
        )}
      </div>

      <div className="custom-scroll" style={{ maxHeight: 280, overflowY: "auto", paddingRight: 4, display: "flex", flexDirection: "column", gap: 2 }}>
        {top.map((c, i) => {
          const isSel = selectedCliId === c.cliId;
          const barPct = max > 0 ? Math.min((c.valor / max) * 100, 100) : 0;
          return (
            <button
              key={c.cliId}
              onClick={() => onSelect?.(isSel ? null : c.cliId)}
              style={{
                position: "relative", textAlign: "left", width: "100%", cursor: onSelect ? "pointer" : "default",
                padding: "7px 9px", borderRadius: 8,
                background: isSel ? "color-mix(in srgb, var(--accent-cyan) 8%, transparent)" : "transparent",
                border: isSel ? "1px solid color-mix(in srgb, var(--accent-cyan) 30%, transparent)" : "1px solid transparent",
                borderBottom: isSel ? undefined : "1px solid var(--border-subtle)",
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, minWidth: 16, color: getRankColor(i), fontFamily: "var(--font-numeric, monospace)" }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                    <span title={c.nome} style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "clamp(90px, 30vw, 200px)" }}>
                      {c.nome}
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-primary)", flexShrink: 0, fontFamily: "var(--font-numeric, monospace)" }}>
                      {moeda(c.valor)}
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--chart-track-bg, rgba(127,127,127,0.12))" }}>
                    <div style={{ width: `${barPct}%`, height: "100%", borderRadius: 2, background: "linear-gradient(90deg, var(--accent-cyan) 0%, color-mix(in srgb, var(--accent-cyan) 25%, transparent) 100%)", transition: "width 0.8s ease" }} />
                  </div>
                </div>
                {isSel && onSelect && (
                  <span style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(239,68,68,0.18)", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <X size={10} />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
