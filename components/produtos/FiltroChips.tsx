"use client";

import { X, Filter } from "lucide-react";
import type { StatusEstoque } from "@/lib/db/produtos-estoque";
import { STATUS_META } from "./utils";

export interface ProdutosFilterState {
  marca: string | null;
  grupo: string | null;
  categoria: string | null;
  status: StatusEstoque | null;
}

interface Chip { key: keyof ProdutosFilterState; label: string; value: string; color?: string }

export function FiltroChips({
  filters, onRemove, onClear,
}: {
  filters: ProdutosFilterState;
  onRemove: (key: keyof ProdutosFilterState) => void;
  onClear: () => void;
}) {
  const chips: Chip[] = [];
  if (filters.marca) chips.push({ key: "marca", label: "Marca", value: filters.marca });
  if (filters.grupo) chips.push({ key: "grupo", label: "Grupo", value: filters.grupo });
  if (filters.categoria) chips.push({ key: "categoria", label: "Categoria", value: filters.categoria });
  if (filters.status) chips.push({ key: "status", label: "Status", value: STATUS_META[filters.status].label, color: STATUS_META[filters.status].color });

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap rounded-xl px-3 py-2"
      style={{ background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.18)", animation: "fadeInUp 0.25s ease-out both" }}>
      <Filter style={{ width: 13, height: 13, color: "var(--accent-cyan)", flexShrink: 0 }} />
      <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", fontWeight: 600 }}>
        Filtros ativos
      </span>

      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onRemove(c.key)}
          className="inline-flex items-center gap-1.5 rounded-full transition-all"
          style={{
            padding: "3px 9px", fontSize: 11.5,
            background: c.color ? `${c.color}18` : "var(--bg-card)",
            border: `1px solid ${c.color ?? "var(--border-subtle)"}`,
            color: c.color ?? "var(--text-primary)", cursor: "pointer",
          }}
          title="Remover filtro"
        >
          <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{c.label}:</span>
          <span style={{ fontWeight: 600 }}>{c.value}</span>
          <X style={{ width: 12, height: 12, opacity: 0.8 }} />
        </button>
      ))}

      <button
        type="button"
        onClick={onClear}
        className="ml-auto inline-flex items-center gap-1 transition-colors"
        style={{ fontSize: 11, color: "var(--text-muted)", cursor: "pointer", padding: "2px 8px", borderRadius: 6, border: "1px solid var(--border-subtle)", background: "transparent" }}
      >
        <X style={{ width: 11, height: 11 }} /> Limpar filtros
      </button>
    </div>
  );
}
