/**
 * POST /api/webhooks/mercadopago
 *
 * Notificação de pagamento do Mercado Pago. Diferente do padrão do
 * webhook do Asaas (app/api/webhooks/asaas/route.ts, só Bearer estático) —
 * aqui a verificação é HMAC-SHA256 sobre a manifest oficial do MP
 * (id/request-id/ts), comparação timingSafeEqual, secret único de
 * plataforma (MERCADOPAGO_WEBHOOK_SECRET, registrado uma vez no painel MP,
 * não por loja).
 *
 * Idempotente por mp_payment_id (ver lib/ecommerce/pedidos-pagamento.ts) —
 * reentrega do Mercado Pago não duplica o efeito de "pago".
 */

import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";
import {
  buscarPedidoParaPagamento,
  marcarPixComoErro,
  marcarPixEPedidoComoPago,
} from "@/lib/ecommerce/pedidos-pagamento";
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

    const { data: pixRow } = await supabaseAdmin
      .from("ecom_pedido_pix")
      .select("pedido_id")
      .eq("mp_payment_id", dataId)
      .maybeSingle();

    if (!pixRow) {
      // Nunca erro/retry-storm para notificação de um pagamento que não é
      // nosso (ou já foi limpo) — só registra e confirma o recebimento.
      console.warn(`[webhook-mercadopago] mp_payment_id desconhecido: ${dataId}`);
      return NextResponse.json({ ok: true, desconhecido: true });
    }

    const pedido = await buscarPedidoParaPagamento(supabaseAdmin, pixRow.pedido_id);
    if (!pedido) {
      console.error(`[webhook-mercadopago] pedido ${pixRow.pedido_id} não encontrado para o pagamento ${dataId}`);
      return NextResponse.json({ ok: true, desconhecido: true });
    }

    const accessToken = await getMercadoPagoAccessToken(supabaseAdmin, pedido.lojaId);
    const pagamento = await buscarPagamento(dataId, accessToken);

    if (pagamento.status === "approved") {
      await marcarPixEPedidoComoPago(supabaseAdmin, dataId, new Date().toISOString());
    } else if (pagamento.status === "rejected" || pagamento.status === "cancelled") {
      await marcarPixComoErro(supabaseAdmin, dataId);
    } else {
      console.log(`[webhook-mercadopago] pagamento ${dataId} em status "${pagamento.status}" — sem ação`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Erro genuinamente inesperado — o Mercado Pago faz retry com backoff,
    // comportamento correto aqui (diferente dos casos tratados acima, que
    // sempre respondem 200/401 e nunca disparam retry).
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error(`[webhook-mercadopago] falha inesperada: ${mensagem}`);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
