// Tipos base do projeto LC Dashboard

export type Tenant = {
  id: string;
  name: string;
  erpBaseUrl: string;
  empId: number;
  createdAt: Date;
};

export type User = {
  id: string;
  email: string;
  tenantId: string;
  role: "admin" | "viewer";
};

export type DashboardKPI = {
  vendas: number;
  faturamento: number;
  contasAVencer: number;
  clientesAtivos: number;
};
