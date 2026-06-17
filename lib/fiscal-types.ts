export type Empresa = {
  id: string;
  nome: string;
  empId: string;
  bridgeUrl: string;
  maxApiUrl: string;
  terminal: string;
  statusConexao: "online" | "offline" | "instavel";
};

export type Produto = {
  id: string;
  codigo: string;
  codigoBarras: string;
  nome: string;
  unidade: string;
  estoqueFisico: number;
  estoqueFiscal: number;
  preco?: number;
  composicaoFiscal: {
    inventarioBase: number;
    entradas: number;
    saidas: number;
    devolucoes: number;
    ajustes: number;
  };
  reservadoEmOS: number;
  empresaId: string;
};

export type StatusFiscal = "ok" | "atencao" | "bloqueado";

export type TipoAtendimento = {
  tatId: number;
  tatDesc: string;
  tatCorDestaqueTexto: string;
  tatCorDestaqueFundo: string;
  tatProGeraFinanceiro: boolean;
};

export type OrdemServico = {
  id: string;
  numero: string;
  cliente: string;
  placa: string;
  data: string;
  status: "aberta" | "em_andamento" | "faturada" | "cancelada";
  empresaId: string;
  itens: ItemOS[];
  equipamento?: string;
  marca?: string;
  obs?: string;
  defeito?: string;
  laudoTec?: string;
  cliId?: string;
  valorTotal?: number;
  tipoAtendId?: number;
  tipoAtendDesc?: string;
  tipoAtendCor?: string;
  tipoAtendCorFundo?: string;
  tipoAtendGeraFin?: boolean;
  prisma?: string;
  dataFechamento?: string | null;
};

export type ItemOS = {
  id: string;
  produtoId: string;
  produtoNome: string;
  codigo: string;
  quantidade: number;
  unidade?: string;
  precoUnitario?: number;
  total?: number;
  observacao?: string;
};

export type LogIntegracao = {
  id: string;
  data: string;
  empresaId: string;
  tipo: "consulta_estoque" | "consulta_os" | "lancamento" | "autenticacao";
  status: "sucesso" | "erro" | "alerta";
  mensagem: string;
  usuario: string;
};

export function calcularStatusFiscal(p: Produto): StatusFiscal {
  if (p.estoqueFiscal <= 0) return "bloqueado";
  if (p.estoqueFiscal < p.estoqueFisico) return "atencao";
  return "ok";
}

export function disponivelParaEmissao(p: Produto): number {
  return Math.max(0, Math.min(p.estoqueFisico, p.estoqueFiscal) - p.reservadoEmOS);
}

export type StockRiskStatus = "ok" | "atencao" | "bloqueado";

export interface EmpresaRef {
  id: string;
  nome_fantasia: string;
  razao_social?: string | null;
  cnpj?: string | null;
  ativo: boolean;
}

export interface LojaRef {
  id: string;
  empresa_id: string;
  nome: string;
  emp_id_maxdata: string;
  terminal_maxdata: string;
  ativo: boolean;
}

export interface IntegrationConfig {
  loja_id: string;
  bridge_configurada: boolean;
  maxapi_configurada: boolean;
  status_bridge: "online" | "offline" | "erro" | "nao_configurado";
  status_maxapi: "online" | "offline" | "erro" | "nao_configurado";
  ultimo_teste_bridge: string | null;
  ultimo_teste_maxapi: string | null;
}

export interface ProductSummary {
  id: string;
  codigo: string;
  codigoBarras: string;
  nome: string;
  unidade: string;
  estoqueFisico: number;
  estoqueFiscal: number;
}

export interface FiscalStockComposition {
  inventario_base: number;
  entradas: number;
  saidas: number;
  devolucoes: number;
  ajustes: number;
  validada: boolean;
}

export interface ProductStockDetail {
  produto: { id: string; codigo: string; codigoBarras: string; nome: string; unidade: string };
  estoque_fisico: number;
  estoque_fiscal: number;
  diferenca: number;
  status_risco: StockRiskStatus;
  composicao_estoque_fiscal: FiscalStockComposition;
  pode_emitir_nf: boolean;
  pode_lancar_os: boolean;
  disponivel_para_emissao: number;
  alertas: { tipo: "warning" | "danger"; mensagem: string }[];
}

export interface ServiceOrderItem {
  id: string;
  produto_id: string;
  produto_nome: string;
  codigo: string;
  quantidade: number;
  observacao?: string | null;
}

export interface ServiceOrder {
  id: string;
  numero: string;
  cliente: string;
  placa: string;
  data: string;
  status: "aberta" | "em_andamento" | "faturada" | "cancelada";
  loja_id: string;
  itens: ServiceOrderItem[];
}

export interface AuditLog {
  id: string;
  data: string;
  user_id: string | null;
  empresa_id: string | null;
  loja_id: string | null;
  acao: string;
  entidade: string | null;
  entidade_id: string | null;
  detalhes_json: unknown;
}
