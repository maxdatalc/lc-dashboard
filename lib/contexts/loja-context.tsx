"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export interface Loja {
  id: string;
  name: string;
}

interface LojaContextValue {
  lojas: Loja[];
  selectedLojaId: string | null;
  selectedLoja: Loja | null;
  // Multi-select: array de IDs selecionados (vazio = todas as lojas)
  lojasDisponiveis: Loja[];
  lojasSelecionadas: string[];
  setLojasSelecionadas: (ids: string[]) => void;
}

const LojaContext = createContext<LojaContextValue | null>(null);

interface LojaProviderProps {
  lojas: Loja[];
  selectedLojaId: string | null;
  children: ReactNode;
}

export function LojaProvider({ lojas, selectedLojaId, children }: LojaProviderProps) {
  const selectedLoja = lojas.find((l) => l.id === selectedLojaId) ?? null;
  const [lojasSelecionadas, setLojasSelecionadas] = useState<string[]>([]);

  return (
    <LojaContext.Provider
      value={{
        lojas,
        selectedLojaId,
        selectedLoja,
        lojasDisponiveis: lojas,
        lojasSelecionadas,
        setLojasSelecionadas,
      }}
    >
      {children}
    </LojaContext.Provider>
  );
}

export function useLoja() {
  const ctx = useContext(LojaContext);
  if (!ctx) throw new Error("useLoja deve ser usado dentro de LojaProvider");
  return ctx;
}
