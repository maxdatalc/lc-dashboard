/**
 * Acesso a ecom_pedidos/ecom_pedido_pagamento a partir do lc-dashboard.
 *
 * ATENÇÃO: lc-dashboard e lc-storefront compartilham o MESMO projeto
 * Supabase. Este módulo é a ÚNICA exceção no lc-dashboard que toca tabelas
 * `ecom_*` diretamente (todo o resto de e-commerce — frete, estoque — é
 * "calcule e devolva", nunca escreve nas tabelas do storefront). A exceção
 * é deliberada: `ecom_pedidos.status` e `ecom_pedido_pagamento.status` só
 * podem mudar via service role (aqui e no webhook) — nenhuma policy de
 * INSERT/UPDATE existe para `authenticated` nessas tabelas (ver
 * supabase/migrations/20260723_ecommerce_checkout_pro.sql no lc-storefront),
 * então é estruturalmente impossível o cliente forjar "pago" sozinho.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any>;

export interface PedidoParaPagamento {
  id: string;
  status: "pendente" | "pago";
  total: number;
  freteValor: number | null;
  cpf: string;
  lojaId: string; // resolvido via join ecom_clientes
}

export async function buscarPedidoParaPagamento(
  supabaseAdmin: AnySupabaseClient,
  pedidoId: string,
): Promise<PedidoParaPagamento | null> {
  const { data: pedido } = await supabaseAdmin
    .from("ecom_pedidos")
    .select("id, status, total, frete_valor, cpf, cliente_id")
    .eq("id", pedidoId)
    .maybeSingle();
  if (!pedido) return null;

  const { data: cliente } = await supabaseAdmin
    .from("ecom_clientes")
    .select("loja_id")
    .eq("id", pedido.cliente_id)
    .maybeSingle();
  if (!cliente) return null;

  return {
    id: pedido.id,
    status: pedido.status,
    total: Number(pedido.total),
    freteValor: pedido.frete_valor == null ? null : Number(pedido.frete_valor),
    cpf: pedido.cpf,
    lojaId: cliente.loja_id,
  };
}

export interface ItemPedidoParaPagamento {
  nome: string;
  preco: number;
  quantidade: number;
}

/** Usado só para montar os `items` da Preference do Checkout Pro com nome/preço/quantidade de verdade, em vez de uma linha genérica "Pedido <id>". */
export async function buscarItensPedidoParaPagamento(
  supabaseAdmin: AnySupabaseClient,
  pedidoId: string,
): Promise<ItemPedidoParaPagamento[]> {
  const { data } = await supabaseAdmin
    .from("ecom_pedido_itens")
    .select("nome, preco, quantidade")
    .eq("pedido_id", pedidoId);

  return (data ?? []).map((item) => ({
    nome: item.nome,
    preco: Number(item.preco),
    quantidade: item.quantidade,
  }));
}

/** Privado — idempotente por pedido: única transição autoritativa de dinheiro confirmado. */
async function marcarPedidoComoPagoSeAinda(
  supabaseAdmin: AnySupabaseClient,
  pedidoId: string,
  pagoEm: string,
) {
  await supabaseAdmin
    .from("ecom_pedidos")
    .update({ status: "pago", pago_em: pagoEm, atualizado_em: new Date().toISOString() })
    .eq("id", pedidoId)
    .eq("status", "pendente");
}

export interface PreferenciaPendente {
  id: string;
  preferenceId: string;
  initPoint: string;
  valor: number;
}

/** Reaproveitamento: se já existe uma tentativa em aberto, devolve a mesma preference (evita criar preferences duplicadas no MP a cada refresh da página). */
export async function buscarPreferenciaPendente(
  supabaseAdmin: AnySupabaseClient,
  pedidoId: string,
): Promise<PreferenciaPendente | null> {
  const { data } = await supabaseAdmin
    .from("ecom_pedido_pagamento")
    .select("id, preference_id, init_point, valor")
    .eq("pedido_id", pedidoId)
    .eq("status", "pendente")
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, preferenceId: data.preference_id, initPoint: data.init_point, valor: Number(data.valor) };
}

/**
 * Invalida uma tentativa pendente cujo valor não bate mais com o pedido
 * (o cliente cancelou o checkout, editou o carrinho e confirmou de novo —
 * ver ressincronização em garantirPedidoCriado no lc-storefront). A
 * preference já criada no Mercado Pago é imutável (não dá pra corrigir o
 * valor nela), então a única saída é invalidar esta linha e criar uma
 * preference nova com o total atual.
 */
export async function invalidarPagamentoPendente(supabaseAdmin: AnySupabaseClient, id: string) {
  await supabaseAdmin
    .from("ecom_pedido_pagamento")
    .update({ status: "erro", atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pendente");
}

export class PagamentoPendenteJaExisteError extends Error {}

export interface NovoPagamentoPendente {
  pedidoId: string;
  valor: number;
  preferenceId: string;
  initPoint: string;
}

/**
 * Cria a linha "tentativa em aberto". Pode colidir com o índice único
 * parcial (pedido_id) WHERE status='pendente' sob concorrência (dois page
 * loads simultâneos) — quem chama deve capturar
 * PagamentoPendenteJaExisteError e reconsultar buscarPreferenciaPendente
 * para reaproveitar a linha que venceu a corrida, nunca tratar isso como
 * falha para o cliente.
 */
export async function inserirPagamentoPendente(
  supabaseAdmin: AnySupabaseClient,
  dados: NovoPagamentoPendente,
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("ecom_pedido_pagamento")
    .insert({
      pedido_id: dados.pedidoId,
      valor: dados.valor,
      preference_id: dados.preferenceId,
      init_point: dados.initPoint,
      status: "pendente",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") throw new PagamentoPendenteJaExisteError(dados.pedidoId);
    throw new Error(`Falha ao gravar ecom_pedido_pagamento: ${error.message}`);
  }
  return data.id as string;
}

export interface NotificacaoPagamento {
  mpPaymentId: string;
  status: string; // "approved" | "rejected" | "cancelled" | "pending" | "in_process" | ...
  metodo: string | null; // payment_type_id
}

/**
 * Efeito único que substitui os antigos marcarPixEPedidoComoPago/
 * marcarCartaoEPedidoComoPago/marcarPixComoErro/marcarCartaoComoRecusado —
 * um pagamento aprovado/recusado do Checkout Pro pode ser PIX, cartão OU
 * boleto, tratados todos do mesmo jeito (nós não escolhemos nem sabemos o
 * método até o Mercado Pago devolver).
 *
 * Duas responsabilidades DELIBERADAMENTE desacopladas:
 *  1) bookkeeping best-effort na linha de tentativa (auditoria/UI) — guard
 *     WHERE status='pendente', idempotente, pode não achar linha num caso
 *     raro (corrida entre uma tentativa antiga recusada chegando atrasada
 *     e uma nova preference já criada pro mesmo pedido — efeito puramente
 *     cosmético, nunca afeta dinheiro).
 *  2) a transição que REALMENTE importa (ecom_pedidos -> 'pago') — sempre
 *     roda quando aprovado, com seu próprio guard de idempotência em
 *     ecom_pedidos, nunca refém do resultado do passo 1. Esse desacoplamento
 *     evita o bug que a Fase 4b teve (linha de tentativa em estado
 *     inesperado bloqueando a marcação do pedido).
 */
export async function processarNotificacaoPagamento(
  supabaseAdmin: AnySupabaseClient,
  pedidoId: string,
  notificacao: NotificacaoPagamento,
): Promise<void> {
  const statusInterno =
    notificacao.status === "approved"
      ? "pago"
      : notificacao.status === "rejected" || notificacao.status === "cancelled"
        ? "erro"
        : "pendente";
  const agora = new Date().toISOString();

  await supabaseAdmin
    .from("ecom_pedido_pagamento")
    .update({
      mp_payment_id: notificacao.mpPaymentId,
      metodo: notificacao.metodo,
      status: statusInterno,
      pago_em: statusInterno === "pago" ? agora : null,
      atualizado_em: agora,
    })
    .eq("pedido_id", pedidoId)
    .eq("status", "pendente"); // idempotente — best-effort, ver docstring acima

  if (notificacao.status === "approved") {
    await marcarPedidoComoPagoSeAinda(supabaseAdmin, pedidoId, agora);
    // Fase 5 (futuro): aqui é o ponto de enviar a venda para Supervisão de
    // Vendas via MaxAPI — fora de escopo desta migração.
  }
}
