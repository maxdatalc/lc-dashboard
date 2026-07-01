"use client";

import { MapPin, AlertTriangle, X } from "lucide-react";

export interface CliGeoItem {
  cidade: string;   // "" = sem cidade
  uf: string;
  qtde: number;
}

interface Props {
  data: CliGeoItem[];
  totalBase: number;               // total de clientes ativos no escopo (para o %)
  selectedCidade?: string | null;  // chave da cidade selecionada (usa "__SEM__" p/ sem cidade)
  onSelect?: (cidade: string | null) => void;
}

export const SEM_CIDADE = "__SEM__";
export function cidadeKey(cidade: string) { return cidade ? cidade : SEM_CIDADE; }

function num(v: number) { return v.toLocaleString("pt-BR"); }

/**
 * Ranking de clientes ativos por cidade. Componentizado de propósito: será
 * substituído/evoluído pelo mapa interativo com heat mais à frente. Itens sem
 * cidade aparecem em âmbar (alerta de cadastro incompleto).
 */
export function CliGeoRanking({ data, totalBase, selectedCidade, onSelect }: Props) {
  const ordenado = [...data].sort((a, b) => b.qtde - a.qtde).slice(0, 12);
  const max = ordenado[0]?.qtde ?? 1;
  const semCidade = data.filter((d) => !d.cidade).reduce((s, d) => s + d.qtde, 0);

  if (!data.length) {
    return <div className="flex items-center justify-center py-10 text-xs" style={{ color: "var(--text-muted)" }}>Sem dados de localização</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Cabeçalho: cobertura + alerta de cadastro incompleto */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 5 }}>
          <MapPin size={12} /> {ordenado.length} cidades no topo
        </span>
        {semCidade > 0 && (
          <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--accent-yellow)", display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 20, background: "color-mix(in srgb, var(--accent-yellow) 12%, transparent)" }}>
            <AlertTriangle size={11} /> {num(semCidade)} sem cidade
          </span>
        )}
      </div>

      <div className="custom-scroll" style={{ maxHeight: 300, overflowY: "auto", paddingRight: 4, display: "flex", flexDirection: "column", gap: 2 }}>
        {ordenado.map((item, i) => {
          const key = cidadeKey(item.cidade);
          const semCity = !item.cidade;
          const isSel = selectedCidade === key;
          const pct = totalBase > 0 ? (item.qtde / totalBase) * 100 : 0;
          const barPct = max > 0 ? Math.min((item.qtde / max) * 100, 100) : 0;
          const cor = semCity ? "var(--accent-yellow)" : "var(--accent-cyan)";
          const nome = semCity ? "Sem cidade" : `${item.cidade}${item.uf ? ` / ${item.uf}` : ""}`;

          return (
            <button
              key={key + i}
              onClick={() => onSelect?.(isSel ? null : key)}
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
                <span style={{ fontSize: 11, fontWeight: 700, minWidth: 16, color: "var(--text-muted)", fontFamily: "var(--font-numeric, monospace)" }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 500, color: semCity ? "var(--accent-yellow)" : "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {nome}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, fontFamily: "var(--font-numeric, monospace)" }}>
                      {num(item.qtde)} · {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--chart-track-bg, rgba(127,127,127,0.12))" }}>
                    <div style={{ width: `${barPct}%`, height: "100%", borderRadius: 2, background: cor, opacity: 0.85, transition: "width 0.8s ease" }} />
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

      {/* Rodapé: placeholder do mapa inteligente (próxima etapa) */}
      <div style={{ fontSize: 10.5, color: "var(--text-muted)", textAlign: "center", paddingTop: 2, borderTop: "1px dashed var(--border-subtle)" }}>
        Mapa inteligente com heat chega na próxima etapa
      </div>
    </div>
  );
}
