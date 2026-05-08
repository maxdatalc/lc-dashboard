// Tipos base do projeto LC Dashboard

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "premium";
  isActive: boolean;
  createdAt: string;
};

export type Loja = {
  id: string;
  tenantId: string;
  name: string;
  empId: number;
  erpBaseUrl: string;
  terminalEncrypted: string;
  isActive: boolean;
  createdAt: string;
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

// Credenciais de acesso à API do ERP MaxManager
export type MaxDataConfig = {
  baseUrl: string;
  empId: number;
  terminal: string; // equivalente a uma chave de API — nunca logar
};

// Resposta da rota POST /v2/auth do MaxManager
export type MaxDataTokenResponse = {
  token: string;
  expiration: string;
  empId: number;
  terminal: string;
};
