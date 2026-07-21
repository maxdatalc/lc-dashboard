"use client";

import { useState } from "react";
import type { RankItem } from "@/lib/db/produtos-estoque";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
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
      <div className="flex-shrink-0 self-start">
        <SegmentedControl<Aba>
          options={ABAS.map((a) => ({ value: a.key, label: a.label }))}
          value={aba}
          onChange={setAba}
          ariaLabel="Dimensão do ranking"
        />
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
