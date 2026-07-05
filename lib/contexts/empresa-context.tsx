"use client";

import { createContext, useContext } from "react";
import type { Plan, UserRole } from "@/lib/plans";
import { planHasFeature, roleCanEdit, roleCanManageUsers } from "@/lib/plans";

export type EmpresaContextValue = {
  empresaId:   string;
  empresaNome: string;
  plan:        Plan;
  userRole:    UserRole;
  /** Verifica se a feature está disponível (considera kill-switch global) */
  hasFeature:  (key: string) => boolean;
  /** Cor de destaque configurada para um módulo (admin), ou undefined se não houver override */
  getModuleColor: (key: string) => string | undefined;
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
  features,
  killedFeatureKeys,
  moduleColors,
}: {
  children:    React.ReactNode;
  empresaId:   string;
  empresaNome: string;
  plan:        Plan;
  userRole:    UserRole;
  features?:   string[];
  killedFeatureKeys?: string[];
  moduleColors?: Record<string, string>;
}) {
  const killedSet = new Set(killedFeatureKeys ?? []);

  const value: EmpresaContextValue = {
    empresaId,
    empresaNome,
    plan,
    userRole,
    hasFeature: (key) => {
      if (killedSet.has(key)) return false;
      return features ? features.includes(key) : planHasFeature(plan, key);
    },
    getModuleColor: (key) => moduleColors?.[key],
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
