// Tipos base do projeto LC Gestor
import type { Plan, UserRole } from "@/lib/plans";

export type { Plan, UserRole };

export type Empresa = {
  id:        string;
  name:      string;
  slug:      string;
  plan:      Plan;
  isActive:  boolean;
  createdAt: string;
};

/** @deprecated use Empresa */
export type Tenant = Empresa;

export type Loja = {
  id:               string;
  tenantId:         string;  // FK → empresas.id
  name:             string;
  empId:            number;
  isActive:         boolean;
  createdAt:        string;
  // Módulo Dashboard SQL (bridge)
  sqlEnabled:       boolean;
  sqlBridgeUrl:     string | null;
  sqlBridgeToken:   string | null; // sempre criptografado — nunca expor
};

export type User = {
  id:         string;
  email:      string;
  empresaId:  string;
  role:       UserRole;
};

export type DashboardKPI = {
  vendas:          number;
  faturamento:     number;
  contasAVencer:   number;
  clientesAtivos:  number;
};
