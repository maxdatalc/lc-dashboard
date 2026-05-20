// Funções de sincronização por entidade (produtos, clientes, vendas)
// Cada função lê da API MaxData e faz upsert no Supabase

import { SupabaseClient } from "npm:@supabase/supabase-js";
import { fetchAllPages, maxdataGet } from "./maxdata-client.ts";

export interface LojaRow {
  id: string;
  emp_id: number;
  erp_base_url: string;
}

// ── Tipos das respostas da API MaxData ─────────────────────────────────────

interface MaxDataProduto {
  id: number;
  codigo?: string;
  nome?: string;
  descricao?: string;
  grupoId?: number;
  grupoNome?: string;
  precoVenda?: number;
  valor?: number;
  estoque?: number;
  saldoEstoque?: number;
  ativo?: boolean;
}

interface MaxDataCliente {
  id: number;
  nome: string;
  cnpj?: string;
  cpf?: string;
  email?: string;
  celular?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  ativo?: boolean;
}

interface MaxDataVenda {
  id: number;
  abertura?: string;
  fechamento?: string;
  clienteId?: number;
  clienteNome?: string;
  valorTotalLiquidoProduto?: number;
  valorTotal?: number;
  totalNf?: number;
  vlrPago?: number;
  valorTotalDesconto?: number;
  status?: string;
}

interface MaxDataItem {
  produtoId?: number;
  descricaoProduto?: string;
  qtde?: number;
  quantidade?: number;
  valor?: number;
  valorDesconto?: number;
  desconto?: number;
  valorTotal?: number;
}

interface MaxDataPagamento {
  formaPgto?: string;
  valor?: number;
  parcelas?: number;
}

// ── Sincronizações ─────────────────────────────────────────────────────────

export async function syncProdutos(
  supabase: SupabaseClient,
  token: string,
  loja: LojaRow
): Promise<number> {
  const produtos = await fetchAllPages<MaxDataProduto>(
    token,
    loja.erp_base_url,
    "/product",
    { sincronizacao: "true" }
  );

  if (produtos.length === 0) return 0;

  const agora = new Date().toISOString();
  const records = produtos.map((p) => ({
    loja_id: loja.id,
    external_id: p.id,
    codigo: p.codigo ?? null,
    nome: p.nome ?? p.descricao ?? null,
    grupo_id: p.grupoId ?? null,
    grupo_nome: p.grupoNome ?? null,
    preco_venda: p.precoVenda ?? p.valor ?? null,
    estoque_atual: p.estoque ?? p.saldoEstoque ?? 0,
    ativo: p.ativo ?? true,
    sincronizado_em: agora,
  }));

  const { error } = await supabase
    .from("produtos")
    .upsert(records, { onConflict: "loja_id,external_id" });

  if (error) throw new Error(`Erro ao sincronizar produtos: ${error.message}`);

  return produtos.length;
}

export async function syncClientes(
  supabase: SupabaseClient,
  token: string,
  loja: LojaRow
): Promise<number> {
  const clientes = await fetchAllPages<MaxDataCliente>(
    token,
    loja.erp_base_url,
    "/client"
  );

  if (clientes.length === 0) return 0;

  const agora = new Date().toISOString();
  const records = clientes.map((c) => ({
    loja_id: loja.id,
    external_id: c.id,
    nome: c.nome,
    cnpj_cpf: c.cnpj ?? c.cpf ?? null,
    email: c.email ?? null,
    telefone: c.celular ?? c.telefone ?? null,
    cidade: c.cidade ?? null,
    estado: c.estado ?? null,
    ativo: c.ativo ?? true,
    sincronizado_em: agora,
  }));

  const { error } = await supabase
    .from("clientes")
    .upsert(records, { onConflict: "loja_id,external_id" });

  if (error) throw new Error(`Erro ao sincronizar clientes: ${error.message}`);

  return clientes.length;
}

export async function syncVendas(
  supabase: SupabaseClient,
  token: string,
  loja: LojaRow,
  dataInicial: string,
  dataFinal: string,
  isInicial: boolean
): Promise<number> {
  // Sem filtro de status — salvamos o status real vindo do ERP para que
  // cancelamentos sejam refletidos no banco e excluídos nas queries do dashboard
  const params = isInicial
    ? {}
    : { dataInicial, dataFinal };

  const vendas = await fetchAllPages<MaxDataVenda>(
    token,
    loja.erp_base_url,
    "/sale",
    params
  );

  if (vendas.length === 0) return 0;

  const agora = new Date().toISOString();
  const rows = vendas.map((v) => ({
    loja_id: loja.id,
    external_id: v.id,
    numero_venda: String(v.id),
    data_venda: (v.fechamento ?? v.abertura ?? dataInicial).split("T")[0],
    cliente_external_id: v.clienteId ?? null,
    cliente_nome: v.clienteNome ?? null,
    valor_bruto: v.valorTotalLiquidoProduto ?? v.valorTotal ?? 0,
    valor_desconto: v.valorTotalDesconto ?? 0,
    valor_total: v.totalNf ?? v.vlrPago ?? 0,
    status: (v.status ?? "finalizada").toLowerCase(),
    sincronizado_em: agora,
  }));

  // Deduplicar por external_id mantendo a primeira ocorrência
  const seen = new Set<number>();
  const rowsUnicos = rows.filter((row) => {
    if (seen.has(row.external_id)) return false;
    seen.add(row.external_id);
    return true;
  });

  // Inserir em lotes para evitar payload muito grande
  const LOTE = 200;
  for (let i = 0; i < rowsUnicos.length; i += LOTE) {
    const lote = rowsUnicos.slice(i, i + LOTE);
    const { error } = await supabase
      .from("vendas")
      .upsert(lote, { onConflict: "loja_id,external_id" });
    if (error) throw new Error(`Erro ao sincronizar vendas: ${error.message}`);
  }

  // Itens e pagamentos são buscados sob demanda no drill-down
  // para não exceder o timeout da Edge Function

  return rowsUnicos.length;
}

export async function syncVendaItens(
  supabase: SupabaseClient,
  token: string,
  loja: LojaRow,
  vendaExternalId: number
): Promise<void> {
  try {
    const response = await maxdataGet<unknown>(
      token,
      loja.erp_base_url,
      `/sale/${vendaExternalId}/items`
    );

    // A API pode retornar paginado {docs:[]} ou diretamente um array
    const itens = Array.isArray(response)
      ? (response as MaxDataItem[])
      : ((response as { docs?: MaxDataItem[] }).docs ?? []);

    if (itens.length === 0) return;

    const records = itens.map((item) => ({
      loja_id: loja.id,
      venda_external_id: vendaExternalId,
      produto_external_id: item.produtoId ?? null,
      produto_nome: item.descricaoProduto ?? "Produto",
      quantidade: item.qtde ?? item.quantidade ?? 0,
      valor_unitario: item.valor ?? 0,
      valor_desconto: item.valorDesconto ?? item.desconto ?? 0,
      valor_total: item.valorTotal ?? 0,
    }));

    await supabase
      .from("venda_itens")
      .upsert(records, { onConflict: "loja_id,venda_external_id,produto_external_id" });
  } catch {
    // Erros de itens não interrompem o sync da venda
  }
}

export async function syncVendaPagamentos(
  supabase: SupabaseClient,
  token: string,
  loja: LojaRow,
  vendaExternalId: number
): Promise<void> {
  try {
    const response = await maxdataGet<unknown>(
      token,
      loja.erp_base_url,
      `/sale/${vendaExternalId}/payment`
    );

    const pagamentos = Array.isArray(response)
      ? (response as MaxDataPagamento[])
      : ((response as { docs?: MaxDataPagamento[] }).docs ?? []);

    if (pagamentos.length === 0) return;

    const records = pagamentos.map((pag) => ({
      loja_id: loja.id,
      venda_external_id: vendaExternalId,
      forma_pagamento: pag.formaPgto ?? "Outro",
      valor: pag.valor ?? 0,
      parcelas: pag.parcelas ?? 1,
    }));

    await supabase
      .from("venda_pagamentos")
      .upsert(records, { onConflict: "loja_id,venda_external_id,forma_pagamento" });
  } catch {
    // Erros de pagamentos não interrompem o sync da venda
  }
}
