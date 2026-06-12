"use client";

import { createContext, useContext } from "react";
import type { Plan, UserRole } from "@/lib/plans";
import { planHasFeature, roleCanEdit, roleCanManageUsers } from "@/lib/plans";

export type EmpresaContextValue = {
  empresaId:   string;
  empresaNome: string;
  plan:        Plan;
  userRole:    UserRole;
  /** Verifica se a feature está disponível no plano atual */
  hasFeature:  (key: string) => boolean;
  /** Usuário pode editar configurações */
  canEdit:     boolean;
  /** Usuário pode gerenciar outros usuários */
  canManageUsers: boolean;
};

const EmpresaContext = createContext<EmpresaContextValue | null>(null);

export function EmpresaProvider({
  children,
  empresaId,
  empresaNome,
  plan,
  userRole,
}: {
  children:    React.ReactNode;
  empresaId:   string;
  empresaNome: string;
  plan:        Plan;
  userRole:    UserRole;
}) {
  const value: EmpresaContextValue = {
    empresaId,
    empresaNome,
    plan,
    userRole,
    hasFeature:     (key) => planHasFeature(plan, key),
    canEdit:        roleCanEdit(userRole),
    canManageUsers: roleCanManageUsers(userRole),
  };

  return (
    <EmpresaContext.Provider value={value}>
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa(): EmpresaContextValue {
  const ctx = useContext(EmpresaContext);
  if (!ctx) throw new Error("useEmpresa precisa estar dentro de EmpresaProvider");
  return ctx;
}
