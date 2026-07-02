"use client";

import type { ProblemaMargem, ProblemaNegativo } from "@/lib/db/produtos-estoque";
import { fmtInt, fmtPct } from "./utils";

function Empty({ msg }: { msg: string }) {
  return <div className="flex items-center justify-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>{msg}</div>;
}

export function MargemNegativaList({ items }: { items: ProblemaMargem[] }) {
  if (items.length === 0) return <Empty msg="Nenhum produto com margem negativa" />;
  return (
    <div className="flex flex-col">
      {items.map((p, i) => (
        <div key={p.proId + "-" + i} className="flex items-center gap-2 py-2"
          style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none" }}>
          <span className="truncate flex-1" style={{ fontSize: 12, color: "var(--text-secondary)" }} title={p.nome}>
            {p.nome}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#f43f5e", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
            {fmtPct(p.margemPct)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function EstoqueNegativoList({ items }: { items: ProblemaNegativo[] }) {
  if (items.length === 0) return <Empty msg="Nenhum produto com estoque negativo" />;
  return (
    <div className="flex flex-col">
      {items.map((p, i) => (
        <div key={p.proId + "-" + i} className="flex items-center gap-2 py-2"
          style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none" }}>
          <div className="flex-1 min-w-0">
            <p className="truncate" style={{ fontSize: 12, color: "var(--text-secondary)" }} title={p.nome}>{p.nome}</p>
            {p.marca && p.marca !== "Sem marca" && (
              <p className="truncate" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{p.marca}</p>
            )}
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#f43f5e", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
            {fmtInt(p.saldo)}
          </span>
        </div>
      ))}
    </div>
  );
}
