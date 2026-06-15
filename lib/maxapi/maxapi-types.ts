export interface MaxApiAuthBody {
  empid: number;
  terminal: string;
}

export interface TokenDto {
  application: string;
  empId: number;
  expiration: string;
  idUser: number;
  terminal: string;
  token: string;
}

export interface ServiceOrder {
  id: number;
  clienteId: number;
  clienteNome: string;
  clienteTelefone: string;
  clienteCelular: string;
  clienteEndereco: string;
  cpf: string;
  atendenteId: number;
  tecnicoId: number | null;
  tipoAtendimentoId: number;
  condicaoPgtoId: number;
  status: string;
  statusOs: string;
  dataAbertura: string | null;
  dataFechamento: string | null;
  defeito: string | null;
  obs: string | null;
  laudoTec: string | null;
  equipamento: string | null;
  marca: string | null;
  serie: string | null;
  placa: string | null;
  km: number;
  nivelTanque: number;
  prisma: string;
  veiculoId: number;
  frete: number;
  seguro: number;
  outrasDespesas: number;
  totalNf: number;
  vlrTotalLiqProd: number;
  valorTotalProduto: number;
  valorTotalServico: number;
  valorTotalDesconto: number;
  valorIcms?: number;
  trocoPara: number;
  valorTroco: number;
  consumidorFinal: boolean;
}

export interface ServiceOrderBody {
  clienteId?: number;
  clienteNome?: string;
  clienteEndereco?: string;
  atendenteId?: number;
  atendente2Id?: number;
  tecnicoId?: number;
  setorId?: number;
  tipoAtendimentoId?: number;
  condicaoPgtoId?: number;
  placa?: string;
  equipamento?: string;
  marca?: string;
  serie?: string;
  km?: number;
  nivelTanque?: number;
  defeito?: string;
  obs?: string;
  laudoTec?: string;
  status?: string;
  statusOs?: string;
  dataAbertura?: string;
  dataFechamento?: string;
  dataPrevisaoEntrega?: string;
  veiculoId?: number;
  consumidorFinal?: boolean;
  frete?: number;
  seguro?: number;
  outrasDespesas?: number;
  cpf?: string;
  origem?: string;
  itens?: ServiceOrderItem[];
}

export interface ServiceOrderItem {
  id?: number;
  OsId: number;
  produtoId: number;
  produtoDescricao?: string;
  codigoDeBarras?: string;
  qtde: number;
  valor: number;
  desconto?: number;
  valorDesconto?: number;
  valorCadastroAtacado?: number;
  custoFinalProduto?: number;
  tipo?: string;
  cfop?: number;
  un?: string;
  tecnicoId?: number;
  status?: string;
  data?: string;
  lote?: string;
  loteVencimento?: string;
  dataFabricacaoLote?: string;
  informacaoAdicionalProduto?: string;
  promocaoId?: number;
}

export interface MaxApiProduct {
  id: number;
  descricao: string;
  descPdv?: string;
  aplicacao?: string;
  fabricanteId: number;
  fabricante: string;
  grupoId: number;
  grupo: string;
  subGrupoId: number;
  subGrupo: string;
  empId: number;
  estoque: number;
  estoqueMinimo: number;
  descontoMaximo: number;
  fracionado: boolean;
  un: string;
  tipoSped: string;
  valorCusto: number;
  valorAtacado: number;
  valorVenda: number;
  codCST2: string;
  CSOSN: string;
  desativado: boolean;
  tipo: string;
  codigoFab: string;
  localizador: string;
  permitirAlterarNome: boolean;
  permitirAlterarValor: boolean;
  possuiImagem: boolean;
}

export interface MaxApiPaginated<T> {
  docs: T[];
  total: number;
  limit: number;
  page: number;
  pages: number;
}

export interface MaxApiError {
  message: string;
  success?: boolean;
  statusCode?: number;
}
