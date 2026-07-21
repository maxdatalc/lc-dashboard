"use client";

import { TrendingUp } from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const OPCOES = ["30", "60", "90"] as const;
type Opcao = (typeof OPCOES)[number];

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

      <SegmentedControl<Opcao>
        options={OPCOES.map((d) => ({ value: d, label: `${d}d` }))}
        value={String(dias) as Opcao}
        onChange={(v) => onChange(Number(v))}
        ariaLabel="Janela de giro de estoque"
      />

      <span className="hidden sm:inline" style={{ fontSize: 11, color: "var(--text-muted)" }}>
        janela usada na Curva ABC, produtos parados e giro da tabela
      </span>
    </div>
  );
}
