"use client";

import { useState } from "react";
import type { RankItem } from "@/lib/db/produtos-estoque";
import { RankingDual, RankingQtd } from "./RankingBars";

type Aba = "marca" | "categoria" | "grupo";

const ABAS: { key: Aba; label: string }[] = [
  { key: "marca", label: "Marca" },
  { key: "categoria", label: "Categoria" },
  { key: "grupo", label: "Grupo" },
];

export function RankingToggleCard({
  porMarcaQtd, selectedMarca, onSelectMarca,
  topCategoriasValor, selectedCategoria, onSelectCategoria,
  porGrupoQtd, selectedGrupo, onSelectGrupo,
}: {
  porMarcaQtd: RankItem[]; selectedMarca: string | null; onSelectMarca: (nome: string) => void;
  topCategoriasValor: RankItem[]; selectedCategoria: string | null; onSelectCategoria: (nome: string) => void;
  porGrupoQtd: RankItem[]; selectedGrupo: string | null; onSelectGrupo: (nome: string) => void;
}) {
  const [aba, setAba] = useState<Aba>("marca");

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="inline-flex items-center rounded-full p-0.5 flex-shrink-0 self-start"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
        {ABAS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setAba(a.key)}
            className="rounded-full transition-all"
            style={{
              padding: "4px 12px", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
              background: aba === a.key ? "var(--accent-cyan)" : "transparent",
              color: aba === a.key ? "#0d1117" : "var(--text-secondary)",
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        {aba === "marca" && (
          <RankingQtd items={porMarcaQtd} selected={selectedMarca} onSelect={onSelectMarca} />
        )}
        {aba === "categoria" && (
          <RankingDual items={topCategoriasValor} selected={selectedCategoria} onSelect={onSelectCategoria} />
        )}
        {aba === "grupo" && (
          <RankingQtd items={porGrupoQtd} selected={selectedGrupo} onSelect={onSelectGrupo} color="#a78bfa" />
        )}
      </div>
    </div>
  );
}
