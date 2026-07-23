/**
 * POST /api/webhooks/mercadopago?loja_id=<uuid>
 *
 * Notificação de pagamento do Mercado Pago (Checkout Pro). Diferente do
 * padrão do webhook do Asaas (app/api/webhooks/asaas/route.ts, só Bearer
 * estático) — aqui a verificação é HMAC-SHA256 sobre a manifest oficial do
 * MP (id/request-id/ts), comparação timingSafeEqual, secret único de
 * plataforma (MERCADOPAGO_WEBHOOK_SECRET, registrado uma vez no painel MP,
 * não por loja).
 *
 * `loja_id` vem da própria query string da notification_url (setada por nós
 * ao criar a preference, ver /api/internal/checkout-criar) — no Checkout
 * Pro o primeiro contato com um mp_payment_id é este próprio webhook, então
 * não dá para localizar a loja por lookup em mp_payment_id (nunca o vimos
 * antes). O parâmetro é só roteamento, não autenticação: a segurança real
 * continua sendo o HMAC (que não cobre a URL) mais o cross-check
 * `pedido.lojaId === lojaId` abaixo.
 *
 * Idempotente por mp_payment_id (ver lib/ecommerce/pedidos-pagamento.ts) —
 * reentrega do Mercado Pago não duplica o efeito de "pago".
 */

import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";
import { buscarPedidoParaPagamento, processarNotificacaoPagamento } from "@/lib/ecommerce/pedidos-pagamento";
import {
  buscarPagamento,
  getMercadoPagoAccessToken,
  verificarAssinaturaWebhook,
} from "@/lib/mercadopago/mercadopago-client";

export const dynamic = "force-dynamic";

interface WebhookBody {
  type?: string;
  action?: string;
  data?: { id?: string };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as WebhookBody | null;
    if (!body?.data?.id) {
      return NextResponse.json({ ok: true, ignorado: true });
    }

    if (body.type !== "payment") {
      return NextResponse.json({ ok: true, ignorado: true });
    }

    const dataId = body.data.id;
    const xSignatureHeader = req.headers.get("x-signature") ?? "";
    const xRequestId = req.headers.get("x-request-id") ?? "";
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

    if (
      !secret ||
      !verificarAssinaturaWebhook({ xSignatureHeader, xRequestId, dataId, secret })
    ) {
      console.error(`[webhook-mercadopago] assinatura inválida para o pagamento ${dataId}`);
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    const lojaId = req.nextUrl.searchParams.get("loja_id");
    if (!lojaId) {
      console.warn(`[webhook-mercadopago] notification sem loja_id na URL para o pagamento ${dataId}`);
      return NextResponse.json({ ok: true, desconhecido: true });
    }

    let accessToken: string;
    try {
      accessToken = await getMercadoPagoAccessToken(supabaseAdmin, lojaId);
    } catch (err) {
      console.warn(`[webhook-mercadopago] loja ${lojaId} sem token utilizável: ${(err as Error).message}`);
      return NextResponse.json({ ok: true, desconhecido: true });
    }

    const pagamento = await buscarPagamento(dataId, accessToken);
    const pedidoId = pagamento.external_reference;
    if (!pedidoId) {
      console.warn(`[webhook-mercadopago] pagamento ${dataId} sem external_reference`);
      return NextResponse.json({ ok: true, desconhecido: true });
    }

    // Reconciliação cross-tenant: o pedido tem de pertencer à MESMA loja que
    // o loja_id da query string indicou — mesma classe de checagem que a
    // Fase 3 já exigiu para carrinho/endereço.
    const pedido = await buscarPedidoParaPagamento(supabaseAdmin, pedidoId);
    if (!pedido || pedido.lojaId !== lojaId) {
      console.error(`[webhook-mercadopago] pedido ${pedidoId} não bate com a loja ${lojaId} (payment ${dataId})`);
      return NextResponse.json({ ok: true, desconhecido: true });
    }

    await processarNotificacaoPagamento(supabaseAdmin, pedidoId, {
      mpPaymentId: dataId,
      status: pagamento.status,
      metodo: pagamento.payment_type_id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Erro genuinamente inesperado — o Mercado Pago faz retry com backoff,
    // comportamento correto aqui (diferente dos casos tratados acima, que
    // sempre respondem 200 e nunca disparam retry).
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error(`[webhook-mercadopago] falha inesperada: ${mensagem}`);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
