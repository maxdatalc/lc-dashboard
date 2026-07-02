"use client";

import { ArrowRight, Download } from "lucide-react";
import type { TransferenciaOportunidade } from "@/lib/db/produtos-estoque";
import { fmtMoeda, fmtInt } from "./utils";

function exportCsv(items: TransferenciaOportunidade[]) {
  const head = ["Produto", "Marca", "Loja Origem", "Estoque Origem", "Loja Destino", "Estoque Destino", "Qtd Sugerida", "Valor Sugerido"];
  const lines = [head.join(";")];
  for (const t of items) {
    lines.push([
      t.nome, t.marca, t.lojaOrigemNome, t.excesso.toFixed(0),
      t.lojaDestinoNome, t.deficit.toFixed(0), t.qtdSugerida.toFixed(0), t.valorSugerido.toFixed(2),
    ].join(";"));
  }
  const csv = "﻿" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "oportunidades-transferencia.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function TransferenciasTable({ items }: { items: TransferenciaOportunidade[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-center px-4" style={{ color: "var(--text-muted)" }}>
        Nenhuma oportunidade de transferência identificada entre as lojas selecionadas.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between flex-shrink-0">
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {fmtInt(items.length)} {items.length === 1 ? "oportunidade" : "oportunidades"}
        </span>
        <button
          type="button"
          onClick={() => exportCsv(items)}
          className="inline-flex items-center gap-1.5 rounded-lg transition-colors"
          style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
        >
          <Download style={{ width: 12, height: 12 }} /> Exportar
        </button>
      </div>

      <div className="custom-scroll flex-1 min-h-0" style={{ overflowY: "auto" }}>
        {items.map((t, i) => (
          <div key={t.proId + "-" + i} className="flex flex-col gap-1.5 rounded-lg"
            style={{ padding: "8px 10px", borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none" }}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate" style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }} title={t.nome}>{t.nome}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent-cyan)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                {fmtMoeda(t.valorSugerido)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap" style={{ fontSize: 11 }}>
              <span style={{ color: "var(--text-secondary)" }}>
                <strong style={{ color: "var(--text-primary)" }}>{t.lojaOrigemNome}</strong> ({fmtInt(t.excesso)} un)
              </span>
              <ArrowRight style={{ width: 12, height: 12, color: "var(--text-muted)", flexShrink: 0 }} />
              <span style={{ color: "var(--text-secondary)" }}>
                <strong style={{ color: "var(--text-primary)" }}>{t.lojaDestinoNome}</strong> ({fmtInt(t.deficit)} un)
              </span>
              <span className="ml-auto" style={{ color: "var(--text-muted)" }}>
                sugerido: <strong style={{ color: "var(--text-secondary)" }}>{fmtInt(t.qtdSugerida)} un</strong>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
