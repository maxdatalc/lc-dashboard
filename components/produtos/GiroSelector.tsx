"use client";

import { TrendingUp } from "lucide-react";

const OPCOES = [30, 60, 90] as const;

export function GiroSelector({
  dias, onChange,
}: {
  dias: number;
  onChange: (dias: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
        <TrendingUp style={{ width: 14, height: 14, color: "var(--accent-cyan)" }} />
        Giro de estoque
      </span>

      <div className="inline-flex items-center rounded-lg p-0.5" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", gap: 2 }}>
        {OPCOES.map((d) => {
          const ativo = dias === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onChange(d)}
              className="seg-btn rounded-md"
              style={{
                padding: "4px 14px", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                background: ativo ? "var(--bg-card)" : "transparent",
                color: ativo ? "var(--accent-cyan)" : "var(--text-secondary)",
                boxShadow: ativo ? "0 1px 3px rgba(16,24,40,0.12)" : "none",
              }}
              aria-pressed={ativo}
            >
              {d}d
            </button>
          );
        })}
      </div>

      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
        janela usada na Curva ABC, produtos parados e giro da tabela
      </span>
    </div>
  );
}
