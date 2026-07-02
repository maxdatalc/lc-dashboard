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
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1.5" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
        <TrendingUp style={{ width: 13, height: 13 }} />
        Giro de estoque — janela:
      </span>
      <div className="inline-flex items-center rounded-full p-0.5" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
        {OPCOES.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className="rounded-full transition-all"
            style={{
              padding: "4px 12px", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
              background: dias === d ? "var(--accent-cyan)" : "transparent",
              color: dias === d ? "#0d1117" : "var(--text-secondary)",
            }}
          >
            {d}d
          </button>
        ))}
      </div>
    </div>
  );
}
