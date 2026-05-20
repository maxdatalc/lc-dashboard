"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface Loja {
  id: string;
  name: string;
}

interface LojaContextValue {
  lojas: Loja[];
  selectedLojaId: string | null;
  selectedLoja: Loja | null;
}

const LojaContext = createContext<LojaContextValue | null>(null);

interface LojaProviderProps {
  lojas: Loja[];
  selectedLojaId: string | null;
  children: ReactNode;
}

export function LojaProvider({ lojas, selectedLojaId, children }: LojaProviderProps) {
  const selectedLoja = lojas.find((l) => l.id === selectedLojaId) ?? null;
  return (
    <LojaContext.Provider value={{ lojas, selectedLojaId, selectedLoja }}>
      {children}
    </LojaContext.Provider>
  );
}

export function useLoja() {
  const ctx = useContext(LojaContext);
  if (!ctx) throw new Error("useLoja deve ser usado dentro de LojaProvider");
  return ctx;
}
