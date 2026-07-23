/**
 * POST /api/internal/checkout-criar
 *
 * Cria (ou reaproveita, se já houver uma em aberto) uma Preference de
 * Checkout Pro para o pedido — substitui pix-criar + cartao-criar +
 * mercadopago-public-key: o Checkout Pro é uma página hospedada única que
 * lida com PIX/cartão/boleto sozinha.
 *
 * valor/e-mail nunca vêm confiados do corpo além do necessário: valor é
 * sempre lido de ecom_pedidos via buscarPedidoParaPagamento.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/server";
import {
  PagamentoPendenteJaExisteError,
  buscarPedidoParaPagamento,
  buscarPreferenciaPendente,
  inserirPagamentoPendente,
  invalidarPagamentoPendente,
} from "@/lib/ecommerce/pedidos-pagamento";
import {
  MercadoPagoDesconectadoError,
  criarPreferenciaCheckoutPro,
  getMercadoPagoAccessToken,
} from "@/lib/mercadopago/mercadopago-client";

export const dynamic = "force-dynamic";

const schema = z.object({
  loja_id: z.string().uuid(),
  pedido_id: z.string().uuid(),
  payer_email: z.string().email(),
  retorno_url_base: z.string().url(),
});

/** Mesmo padrão de origemConfiavel() do OAuth (conectar/callback): a origem
 *  pública do lc-dashboard é o próprio MERCADOPAGO_REDIRECT_URI — fonte mais
 *  confiável atrás de túnel local. Duplicado aqui de propósito (um-liner,
 *  não vale um módulo compartilhado só por isso). */
function origemPublicaDashboard(): string {
  return new URL(process.env.MERCADOPAGO_REDIRECT_URI!).origin;
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

  // Reaproveita a preference em aberto, se houver — evita criar preferences
  // duplicadas no MP a cada refresh da página de pagamento. MAS: se o valor
  // não bate mais com o pedido (cliente cancelou o checkout, editou o
  // carrinho e confirmou de novo — a preference do MP é imutável, não dá
  // pra corrigir o valor nela), invalida essa linha e cria uma nova abaixo.
  const existente = await buscarPreferenciaPendente(supabaseAdmin, dados.pedido_id);
  if (existente) {
    if (existente.valor === pedido.total) {
      return NextResponse.json({
        pagamento_id: existente.id,
        preference_id: existente.preferenceId,
        init_point: existente.initPoint,
      });
    }
    await invalidarPagamentoPendente(supabaseAdmin, existente.id);
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

  // live_mode já foi achado pouco confiável nesta conta de teste — mantido
  // como a fonte de escolha (é o dado que existe e é o correto segundo a doc
  // do MP), mas a verificação manual confirma empiricamente qual URL foi de
  // fato usada antes de fechar a fase.
  const { data: config } = await supabaseAdmin
    .from("mercadopago_configuracoes")
    .select("live_mode")
    .eq("loja_id", dados.loja_id)
    .maybeSingle();

  try {
    const preference = await criarPreferenciaCheckoutPro({
      accessToken,
      pedidoId: dados.pedido_id,
      valor: pedido.total,
      payerEmail: dados.payer_email,
      backUrls: {
        success: `${dados.retorno_url_base}?pedido=${dados.pedido_id}&status=success`,
        failure: `${dados.retorno_url_base}?pedido=${dados.pedido_id}&status=failure`,
        pending: `${dados.retorno_url_base}?pedido=${dados.pedido_id}&status=pending`,
      },
      notificationUrl: `${origemPublicaDashboard()}/api/webhooks/mercadopago?loja_id=${dados.loja_id}`,
    });

    const initPoint = config?.live_mode ? preference.init_point : preference.sandbox_init_point;

    try {
      const pagamentoId = await inserirPagamentoPendente(supabaseAdmin, {
        pedidoId: dados.pedido_id,
        valor: pedido.total,
        preferenceId: preference.id,
        initPoint,
      });
      return NextResponse.json({ pagamento_id: pagamentoId, preference_id: preference.id, init_point: initPoint });
    } catch (err) {
      if (err instanceof PagamentoPendenteJaExisteError) {
        // Corrida: outra requisição venceu entre o check e o insert — reaproveita a dela.
        const ganhou = await buscarPreferenciaPendente(supabaseAdmin, dados.pedido_id);
        if (ganhou) {
          return NextResponse.json({
            pagamento_id: ganhou.id,
            preference_id: ganhou.preferenceId,
            init_point: ganhou.initPoint,
          });
        }
      }
      throw err;
    }
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error(`[checkout-criar] falha para o pedido ${dados.pedido_id} (loja ${dados.loja_id}): ${mensagem}`);
    return NextResponse.json({ error: "checkout_indisponivel" }, { status: 503 });
  }
}
