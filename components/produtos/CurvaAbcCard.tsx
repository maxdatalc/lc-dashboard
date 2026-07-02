"use client";

import type { AbcResumo, ClasseAbc } from "@/lib/db/produtos-estoque";
import { ABC_META, fmtInt, fmtPct, fmtMoeda } from "./utils";

export function CurvaAbcCard({
  resumo, selected, onSelect,
}: {
  resumo: AbcResumo[];
  selected: ClasseAbc | null;
  onSelect: (classe: ClasseAbc) => void;
}) {
  if (resumo.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-center px-4" style={{ color: "var(--text-muted)" }}>
        Sem vendas na janela selecionada para calcular a curva ABC.
      </div>
    );
  }

  const maxFat = Math.max(...resumo.map((r) => r.faturamento), 1);
  const hasSel = selected !== null;

  return (
    <div className="flex flex-col gap-2 h-full justify-center">
      {resumo.map((r) => {
        const meta = ABC_META[r.classe];
        const isSel = selected === r.classe;
        const w = r.classe === "semGiro" ? 0 : (r.faturamento / maxFat) * 100;

        return (
          <button
            type="button"
            key={r.classe}
            onClick={() => onSelect(r.classe)}
            className="flex flex-col gap-1 rounded-lg transition-all text-left"
            style={{
              padding: "8px 10px",
              opacity: hasSel && !isSel ? 0.45 : 1,
              background: isSel ? `${meta.color}12` : "var(--bg-elevated)",
              border: `1px solid ${isSel ? meta.color : "var(--border-subtle)"}`,
              cursor: "pointer",
            }}
            title={`Filtrar por ${meta.label.toLowerCase()}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5">
                <span style={{ width: 8, height: 8, borderRadius: 3, background: meta.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: meta.color }}>{meta.label}</span>
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {fmtInt(r.qtdProdutos)} {r.qtdProdutos === 1 ? "produto" : "produtos"}
              </span>
            </div>

            {r.classe !== "semGiro" ? (
              <>
                <div className="relative rounded-full overflow-hidden" style={{ height: 6, background: "var(--chart-track-bg)" }}>
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${w}%`, background: meta.color, transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)" }} />
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{fmtMoeda(r.faturamento)}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: meta.color }}>{fmtPct(r.pctFaturamento)} do faturamento</span>
                </div>
              </>
            ) : (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Nenhuma venda na janela selecionada</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
