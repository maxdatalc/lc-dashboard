/**
 * Cliente Mercado Pago — server-side only, lc-dashboard.
 *
 * OAuth marketplace: cada loja conecta SUA PRÓPRIA conta MP (não existe
 * collector_id/conta central). O access_token obtido via OAuth é usado
 * como Bearer ao criar um pagamento "em nome" do vendedor conectado.
 *
 * Token: ~180 dias de validade (grant_type=authorization_code) — bem mais
 * longo que o token de 1h da MaxAPI, então a margem de segurança de
 * renovação aqui é em DIAS, não minutos (ver tokenPrecisaRenovar).
 * Cada renovação troca refresh_token TAMBÉM (o antigo é invalidado pelo MP)
 * — os dois campos são sempre persistidos juntos.
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { decrypt, encrypt } from "../crypto";
import type {
  MercadoPagoOAuthTokenResponse,
  MercadoPagoPaymentResponse,
  MercadoPagoPreferenceResponse,
} from "./mercadopago-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any>;

const MP_API_BASE = "https://api.mercadopago.com";
const TIMEOUT_MS = 15_000;

// ── Funções puras (testadas em mercadopago-client.test.ts) ──────────────

export function montarManifestWebhook(dataId: string, requestId: string, ts: string): string {
  return `id:${dataId};request-id:${requestId};ts:${ts};`;
}

export function verificarAssinaturaWebhook(params: {
  xSignatureHeader: string;
  xRequestId: string;
  dataId: string;
  secret: string;
}): boolean {
  const partes = Object.fromEntries(
    params.xSignatureHeader.split(",").map((par) => {
      const [chave, valor] = par.split("=");
      return [chave?.trim(), valor?.trim()];
    }),
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  const manifest = montarManifestWebhook(params.dataId, params.xRequestId, ts);
  const esperado = createHmac("sha256", params.secret).update(manifest).digest("hex");

  const bufEsperado = Buffer.from(esperado, "hex");
  const bufRecebido = Buffer.from(v1, "hex");
  if (bufEsperado.length !== bufRecebido.length) return false;

  return timingSafeEqual(bufEsperado, bufRecebido);
}

/** Margem de segurança: renova se faltar menos de 7 dias para o vencimento (~180 dias de validade total). */
const MARGEM_RENOVACAO_MS = 7 * 24 * 60 * 60 * 1000;

export function tokenPrecisaRenovar(expiresAtIso: string | null, agora: Date): boolean {
  if (!expiresAtIso) return true;
  return new Date(expiresAtIso).getTime() - agora.getTime() < MARGEM_RENOVACAO_MS;
}

// ── Chamadas de rede (não testadas por unidade — mesmo padrão de maxapi-client.ts) ──

export class MercadoPagoDesconectadoError extends Error {}

async function chamarMercadoPago<T>(
  path: string,
  init: RequestInit,
  timeoutMs = TIMEOUT_MS,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${MP_API_BASE}${path}`, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Mercado Pago ${init.method ?? "GET"} ${path} HTTP ${res.status}: ${body.slice(0, 300)}`,
      );
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function exchangeAuthorizationCode(
  code: string,
  redirectUri: string,
): Promise<MercadoPagoOAuthTokenResponse> {
  return chamarMercadoPago<MercadoPagoOAuthTokenResponse>("/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.MERCADOPAGO_APP_CLIENT_ID,
      client_secret: process.env.MERCADOPAGO_APP_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<MercadoPagoOAuthTokenResponse> {
  return chamarMercadoPago<MercadoPagoOAuthTokenResponse>("/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.MERCADOPAGO_APP_CLIENT_ID,
      client_secret: process.env.MERCADOPAGO_APP_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
}

/** Lazy-cache-check-then-refresh, mesma forma de getOrRefreshToken() da MaxAPI. */
export async function getMercadoPagoAccessToken(
  supabaseAdmin: AnySupabaseClient,
  lojaId: string,
): Promise<string> {
  const { data: row } = await supabaseAdmin
    .from("mercadopago_configuracoes")
    .select("access_token, refresh_token, token_expires_at, status")
    .eq("loja_id", lojaId)
    .maybeSingle();

  if (!row || row.status !== "conectado" || !row.access_token || !row.refresh_token) {
    throw new MercadoPagoDesconectadoError(`Loja ${lojaId} sem Mercado Pago conectado`);
  }

  if (!tokenPrecisaRenovar(row.token_expires_at, new Date())) {
    return decrypt(row.access_token);
  }

  try {
    const dto = await refreshAccessToken(decrypt(row.refresh_token));
    const expiresAt = new Date(Date.now() + dto.expires_in * 1000).toISOString();

    await supabaseAdmin
      .from("mercadopago_configuracoes")
      .update({
        access_token: encrypt(dto.access_token),
        refresh_token: encrypt(dto.refresh_token), // MP invalida o anterior — sempre sobrescrever os dois.
        token_expires_at: expiresAt,
        status: "conectado",
      })
      .eq("loja_id", lojaId);

    return dto.access_token;
  } catch (err) {
    // Refresh falhou (ex.: revogado no painel do vendedor) — marca erro para a
    // UI do admin sinalizar "reconectar", em vez de tentar de novo silenciosamente.
    await supabaseAdmin
      .from("mercadopago_configuracoes")
      .update({ status: "erro" })
      .eq("loja_id", lojaId);
    throw new MercadoPagoDesconectadoError(
      `Renovação de token falhou para a loja ${lojaId}: ${(err as Error).message}`,
    );
  }
}

export interface CriarPreferenciaParams {
  accessToken: string;
  pedidoId: string;
  valor: number;
  payerEmail: string;
  backUrls: { success: string; failure: string; pending: string };
  notificationUrl: string;
}

/**
 * Checkout Pro: cria uma Preference (não um Payment). O Mercado Pago
 * hospeda a página inteira de pagamento (PIX/cartão/boleto) — não criamos o
 * payment nós mesmos, só redirecionamos o cliente pro init_point devolvido.
 */
export async function criarPreferenciaCheckoutPro(
  params: CriarPreferenciaParams,
): Promise<MercadoPagoPreferenceResponse> {
  return chamarMercadoPago<MercadoPagoPreferenceResponse>("/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({
      items: [
        {
          title: `Pedido ${params.pedidoId}`,
          quantity: 1,
          unit_price: params.valor,
          currency_id: "BRL",
        },
      ],
      payer: { email: params.payerEmail },
      external_reference: params.pedidoId,
      back_urls: params.backUrls,
      auto_return: "approved",
      notification_url: params.notificationUrl,
    }),
  });
}

export async function buscarPagamento(
  mpPaymentId: string,
  accessToken: string,
): Promise<MercadoPagoPaymentResponse> {
  return chamarMercadoPago<MercadoPagoPaymentResponse>(`/v1/payments/${mpPaymentId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
