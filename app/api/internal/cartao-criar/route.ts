/**
 * POST /api/internal/cartao-criar
 *
 * Cria um pagamento de cartão (crédito/débito) via CardForm do Mercado Pago
 * (Checkout Transparente). Diferente do PIX: a resposta de /v1/payments já
 * traz o status final (ou quase final) na mesma chamada — este endpoint
 * marca ecom_pedidos como "pago" SINCRONAMENTE quando aprovado (não espera
 * o webhook). O webhook processa o mesmo mp_payment_id depois como defesa em
 * profundidade — a query idempotente WHERE status='em_analise' garante que
 * não há dupla marcação.
 *
 * token/payment_method_id/issuer_id/installments vêm do CardForm (client-side;
 * número/CVV nunca saem do iframe do MP). valor/cpf NUNCA vêm do corpo: lidos
 * de ecom_pedidos.
 */

import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/server";
import {
  buscarPedidoParaPagamento,
  inserirCartaoRow,
  marcarCartaoEPedidoComoPago,
} from "@/lib/ecommerce/pedidos-pagamento";
import {
  MercadoPagoDesconectadoError,
  criarPagamentoCartao,
  getMercadoPagoAccessToken,
} from "@/lib/mercadopago/mercadopago-client";

export const dynamic = "force-dynamic";

const schema = z.object({
  loja_id: z.string().uuid(),
  pedido_id: z.string().uuid(),
  token: z.string().min(1),
  payment_method_id: z.string().min(1),
  issuer_id: z.string().min(1),
  installments: z.number().int().min(1).max(24), // sanidade de payload, não regra de negócio
  payer_email: z.string().email(),
  payer_first_name: z.string().min(1),
  payer_last_name: z.string().min(1),
});

function mapearStatus(mpStatus: string): "aprovado" | "recusado" | "em_analise" {
  if (mpStatus === "approved") return "aprovado";
  if (mpStatus === "rejected") return "recusado";
  return "em_analise";
}

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
  const dados = parsed.data;

  const supabaseAdmin = createAdminClient();

  const pedido = await buscarPedidoParaPagamento(supabaseAdmin, dados.pedido_id);
  if (!pedido || pedido.lojaId !== dados.loja_id) {
    return NextResponse.json({ error: "pedido_nao_encontrado" }, { status: 404 });
  }
  if (pedido.status === "pago") {
    return NextResponse.json({ error: "pedido_ja_pago" }, { status: 409 });
  }

  let accessToken: string;
  try {
    accessToken = await getMercadoPagoAccessToken(supabaseAdmin, dados.loja_id);
  } catch (err) {
    if (err instanceof MercadoPagoDesconectadoError) {
      return NextResponse.json({ error: "mercadopago_nao_conectado" }, { status: 503 });
    }
    throw err;
  }

  try {
    const pagamento = await criarPagamentoCartao({
      accessToken,
      valor: pedido.total,
      descricao: `Pedido ${pedido.id}`,
      token: dados.token,
      paymentMethodId: dados.payment_method_id,
      issuerId: dados.issuer_id,
      installments: dados.installments,
      payerEmail: dados.payer_email,
      payerFirstName: dados.payer_first_name,
      payerLastName: dados.payer_last_name,
      cpf: pedido.cpf.replace(/\D/g, ""),
      idempotencyKey: randomUUID(),
    });

    const statusInterno = mapearStatus(pagamento.status);

    const cartaoId = await inserirCartaoRow(supabaseAdmin, {
      pedidoId: dados.pedido_id,
      mpPaymentId: String(pagamento.id),
      valor: pedido.total,
      status: statusInterno,
      parcelas: dados.installments,
      paymentMethodId: dados.payment_method_id,
      ultimosQuatroDigitos: pagamento.card?.last_four_digits ?? null,
      mpStatusDetail: pagamento.status_detail,
    });

    // Marcação SÍNCRONA — não espera o webhook para o caso comum (aprovado
    // na hora). Idempotente: se o webhook chegar depois com o mesmo
    // mp_payment_id, o WHERE status='em_analise' já não encontra linha e
    // não duplica efeito.
    if (statusInterno === "aprovado") {
      await marcarCartaoEPedidoComoPago(supabaseAdmin, String(pagamento.id), new Date().toISOString());
    }

    return NextResponse.json({
      cartao_id: cartaoId,
      mp_payment_id: String(pagamento.id),
      status: statusInterno,
      status_detail: pagamento.status_detail,
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error(`[cartao-criar] falha para o pedido ${dados.pedido_id} (loja ${dados.loja_id}): ${mensagem}`);
    return NextResponse.json({ error: "cartao_indisponivel" }, { status: 503 });
  }
}
