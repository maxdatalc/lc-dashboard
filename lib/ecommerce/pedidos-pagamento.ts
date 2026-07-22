/**
 * Acesso a ecom_pedidos/ecom_pedido_pix/ecom_pedido_pagamento_cartao a
 * partir do lc-dashboard.
 *
 * ATENÇÃO: lc-dashboard e lc-storefront compartilham o MESMO projeto
 * Supabase. Este módulo é a ÚNICA exceção no lc-dashboard que toca tabelas
 * `ecom_*` diretamente (todo o resto de e-commerce — frete, estoque — é
 * "calcule e devolva", nunca escreve nas tabelas do storefront). A exceção
 * é deliberada: `ecom_pedidos.status`, `ecom_pedido_pix.status` e
 * `ecom_pedido_pagamento_cartao.status` só podem mudar via service role
 * (aqui, no webhook, e no cron de expiração) — nenhuma policy de
 * INSERT/UPDATE existe para `authenticated` nessas tabelas (ver
 * supabase/migrations/20260721_ecommerce_pedidos_pagamento.sql e
 * 20260722_ecommerce_pagamento_cartao.sql no lc-storefront), então é
 * estruturalmente impossível o cliente forjar "pago"/"aprovado" sozinho.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any>;

export interface PedidoParaPagamento {
  id: string;
  status: "pendente" | "pago";
  total: number;
  cpf: string;
  lojaId: string; // resolvido via join ecom_clientes
}

export async function buscarPedidoParaPagamento(
  supabaseAdmin: AnySupabaseClient,
  pedidoId: string,
): Promise<PedidoParaPagamento | null> {
  const { data: pedido } = await supabaseAdmin
    .from("ecom_pedidos")
    .select("id, status, total, cpf, cliente_id")
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
    cpf: pedido.cpf,
    lojaId: cliente.loja_id,
  };
}

export async function expirarPixPendentes(supabaseAdmin: AnySupabaseClient, pedidoId: string) {
  await supabaseAdmin
    .from("ecom_pedido_pix")
    .update({ status: "expirado", atualizado_em: new Date().toISOString() })
    .eq("pedido_id", pedidoId)
    .eq("status", "pendente");
}

export interface NovaPixRow {
  pedidoId: string;
  mpPaymentId: string;
  valor: number;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  dateOfExpiration: string;
  mpStatusDetail: string;
}

export async function inserirPixRow(supabaseAdmin: AnySupabaseClient, dados: NovaPixRow) {
  const { data, error } = await supabaseAdmin
    .from("ecom_pedido_pix")
    .insert({
      pedido_id: dados.pedidoId,
      mp_payment_id: dados.mpPaymentId,
      valor: dados.valor,
      status: "pendente",
      qr_code: dados.qrCode,
      qr_code_base64: dados.qrCodeBase64,
      ticket_url: dados.ticketUrl,
      date_of_expiration: dados.dateOfExpiration,
      mp_status_detail: dados.mpStatusDetail,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Falha ao gravar ecom_pedido_pix: ${error.message}`);
  return data.id as string;
}

/** Privado — idempotente por pedido: usado tanto por PIX quanto por cartão. */
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

/** Idempotente por mp_payment_id — múltiplas entregas do webhook não duplicam efeito. */
export async function marcarPixEPedidoComoPago(
  supabaseAdmin: AnySupabaseClient,
  mpPaymentId: string,
  pagoEm: string,
) {
  const { data: pix } = await supabaseAdmin
    .from("ecom_pedido_pix")
    .update({ status: "pago", pago_em: pagoEm, atualizado_em: new Date().toISOString() })
    .eq("mp_payment_id", mpPaymentId)
    .eq("status", "pendente") // idempotente: se já processado, não repete o efeito colateral
    .select("pedido_id")
    .maybeSingle();

  if (!pix) return; // já processado antes, ou mp_payment_id desconhecido (tratado por quem chama)

  await marcarPedidoComoPagoSeAinda(supabaseAdmin, pix.pedido_id, pagoEm);
}

export async function marcarPixComoErro(supabaseAdmin: AnySupabaseClient, mpPaymentId: string) {
  await supabaseAdmin
    .from("ecom_pedido_pix")
    .update({ status: "erro", atualizado_em: new Date().toISOString() })
    .eq("mp_payment_id", mpPaymentId)
    .eq("status", "pendente");
}

export interface NovaCartaoRow {
  pedidoId: string;
  mpPaymentId: string;
  valor: number;
  status: "aprovado" | "recusado" | "em_analise" | "erro";
  parcelas: number;
  paymentMethodId: string;
  ultimosQuatroDigitos: string | null;
  mpStatusDetail: string;
}

export async function inserirCartaoRow(supabaseAdmin: AnySupabaseClient, dados: NovaCartaoRow) {
  const { data, error } = await supabaseAdmin
    .from("ecom_pedido_pagamento_cartao")
    .insert({
      pedido_id: dados.pedidoId,
      mp_payment_id: dados.mpPaymentId,
      valor: dados.valor,
      status: dados.status,
      parcelas: dados.parcelas,
      payment_method_id: dados.paymentMethodId,
      ultimos_4_digitos: dados.ultimosQuatroDigitos,
      mp_status_detail: dados.mpStatusDetail,
      pago_em: dados.status === "aprovado" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Falha ao gravar ecom_pedido_pagamento_cartao: ${error.message}`);
  return data.id as string;
}

/** Idempotente por mp_payment_id — reentrega do webhook não duplica efeito (mesmo padrão do PIX). */
export async function marcarCartaoEPedidoComoPago(
  supabaseAdmin: AnySupabaseClient,
  mpPaymentId: string,
  pagoEm: string,
) {
  const { data: cartao } = await supabaseAdmin
    .from("ecom_pedido_pagamento_cartao")
    .update({ status: "aprovado", pago_em: pagoEm, atualizado_em: new Date().toISOString() })
    .eq("mp_payment_id", mpPaymentId)
    .eq("status", "em_analise")
    .select("pedido_id")
    .maybeSingle();

  if (!cartao) return; // já processado, ou a linha nasceu direto "aprovado" na criação síncrona
  await marcarPedidoComoPagoSeAinda(supabaseAdmin, cartao.pedido_id, pagoEm);
}

export async function marcarCartaoComoRecusado(
  supabaseAdmin: AnySupabaseClient,
  mpPaymentId: string,
  statusDetail: string,
) {
  await supabaseAdmin
    .from("ecom_pedido_pagamento_cartao")
    .update({ status: "recusado", mp_status_detail: statusDetail, atualizado_em: new Date().toISOString() })
    .eq("mp_payment_id", mpPaymentId)
    .eq("status", "em_analise");
}

export type TentativaPagamento = { tipo: "pix" | "cartao"; pedidoId: string };

/** Usado pelo webhook: um mp_payment_id pode ser de PIX ou de cartão — tenta as duas tabelas. */
export async function localizarTentativaPagamento(
  supabaseAdmin: AnySupabaseClient,
  mpPaymentId: string,
): Promise<TentativaPagamento | null> {
  const { data: pix } = await supabaseAdmin
    .from("ecom_pedido_pix")
    .select("pedido_id")
    .eq("mp_payment_id", mpPaymentId)
    .maybeSingle();
  if (pix) return { tipo: "pix", pedidoId: pix.pedido_id };

  const { data: cartao } = await supabaseAdmin
    .from("ecom_pedido_pagamento_cartao")
    .select("pedido_id")
    .eq("mp_payment_id", mpPaymentId)
    .maybeSingle();
  if (cartao) return { tipo: "cartao", pedidoId: cartao.pedido_id };

  return null;
}
