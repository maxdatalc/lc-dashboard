/**
 * POST /api/internal/pix-criar
 *
 * Gera um pagamento PIX (Mercado Pago, Payments API clássica) para um
 * ecom_pedido do lc-storefront, em nome da conta MP conectada pela loja
 * dona do pedido (marketplace real — nunca uma conta central). Server-to-
 * server, mesmo padrão de autenticação de frete-cotar/stock-check.
 *
 * `valor`, `cpf` e a descrição do pagamento NUNCA vêm do corpo da
 * requisição — são lidos de ecom_pedidos pelo próprio pedido_id (mesma
 * disciplina de "nunca confiar em valor monetário do chamador" já usada em
 * confirmarPedido, fase 3 do lc-storefront), reforçada aqui porque o
 * chamador roda numa camada sem privilégio nenhum.
 */

import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/server";
import {
  buscarPedidoParaPagamento,
  expirarPixPendentes,
  inserirPixRow,
} from "@/lib/ecommerce/pedidos-pagamento";
import {
  MercadoPagoDesconectadoError,
  calcularDataExpiracaoPix,
  criarPagamentoPix,
  getMercadoPagoAccessToken,
} from "@/lib/mercadopago/mercadopago-client";

export const dynamic = "force-dynamic";

const EXPIRACAO_MINUTOS = 30;

const schema = z.object({
  loja_id: z.string().uuid(),
  pedido_id: z.string().uuid(),
  payer_email: z.string().email(),
  payer_first_name: z.string().min(1),
  payer_last_name: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const segredo = process.env.INTERNAL_API_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";

  if (!segredo || authHeader !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { loja_id, pedido_id, payer_email, payer_first_name, payer_last_name } = parsed.data;

  const supabaseAdmin = createAdminClient();

  const pedido = await buscarPedidoParaPagamento(supabaseAdmin, pedido_id);
  if (!pedido || pedido.lojaId !== loja_id) {
    return NextResponse.json({ error: "pedido_nao_encontrado" }, { status: 404 });
  }
  if (pedido.status === "pago") {
    return NextResponse.json({ error: "pedido_ja_pago" }, { status: 409 });
  }

  let accessToken: string;
  try {
    accessToken = await getMercadoPagoAccessToken(supabaseAdmin, loja_id);
  } catch (err) {
    if (err instanceof MercadoPagoDesconectadoError) {
      return NextResponse.json({ error: "mercadopago_nao_conectado" }, { status: 503 });
    }
    throw err;
  }

  const dataExpiracao = calcularDataExpiracaoPix(new Date(), EXPIRACAO_MINUTOS);

  try {
    const pagamento = await criarPagamentoPix({
      accessToken,
      valor: pedido.total,
      descricao: `Pedido ${pedido.id}`,
      payerEmail: payer_email,
      payerFirstName: payer_first_name,
      payerLastName: payer_last_name,
      cpf: pedido.cpf.replace(/\D/g, ""),
      dataExpiracao,
      idempotencyKey: randomUUID(),
    });

    const dadosPix = pagamento.point_of_interaction?.transaction_data;
    if (!dadosPix) {
      throw new Error("Resposta do Mercado Pago sem dados de QR code (point_of_interaction ausente)");
    }

    await expirarPixPendentes(supabaseAdmin, pedido_id);
    const pixId = await inserirPixRow(supabaseAdmin, {
      pedidoId: pedido_id,
      mpPaymentId: String(pagamento.id),
      valor: pedido.total,
      qrCode: dadosPix.qr_code,
      qrCodeBase64: dadosPix.qr_code_base64,
      ticketUrl: dadosPix.ticket_url,
      dateOfExpiration: pagamento.date_of_expiration ?? dataExpiracao,
      mpStatusDetail: pagamento.status_detail,
    });

    return NextResponse.json({
      pix_id: pixId,
      mp_payment_id: String(pagamento.id),
      qr_code: dadosPix.qr_code,
      qr_code_base64: dadosPix.qr_code_base64,
      ticket_url: dadosPix.ticket_url,
      date_of_expiration: pagamento.date_of_expiration ?? dataExpiracao,
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error(`[pix-criar] falha para o pedido ${pedido_id} (loja ${loja_id}): ${mensagem}`);
    return NextResponse.json({ error: "pix_indisponivel" }, { status: 503 });
  }
}
