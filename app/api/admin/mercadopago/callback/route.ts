/**
 * GET /api/admin/mercadopago/callback?code=...&state=...
 *
 * Callback do OAuth marketplace do Mercado Pago. Recebe o `code` (válido por
 * 10 min, uso único) depois do vendedor autorizar no MP, troca por
 * access_token/refresh_token e grava encriptado em mercadopago_configuracoes.
 *
 * `state` é verificado (HMAC + janela de 15 min) ANTES de confiar em
 * lojaId/tenantId — nunca redirecionar para um destino não confiável.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { isSystemAdmin } from "@/lib/db/admin";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { exchangeAuthorizationCode } from "@/lib/mercadopago/mercadopago-client";

const JANELA_STATE_MS = 15 * 60 * 1000;

/**
 * Origem confiável para os redirects internos (não os do próprio OAuth, que
 * são absolutos). NÃO usar req.url aqui: atrás de um túnel (ngrok/cloudflared)
 * o Next.js local pode enxergar o Host como "localhost:PORT" em vez do
 * domínio público, gerando um Location para localhost que o navegador não
 * alcança (ERR_SSL_PROTOCOL_ERROR). MERCADOPAGO_REDIRECT_URI já precisa ser
 * o domínio público correto para o próprio OAuth funcionar, então é a fonte
 * mais segura de origem — funciona igual em produção (Vercel) e em túnel local.
 */
function origemConfiavel(): string {
  return new URL(process.env.MERCADOPAGO_REDIRECT_URI!).origin;
}

function verificarState(state: string): { lojaId: string; tenantId: string } | null {
  const separador = state.lastIndexOf(".");
  if (separador === -1) return null;

  const payloadB64 = state.slice(0, separador);
  const assinaturaRecebida = state.slice(separador + 1);

  const assinaturaEsperada = createHmac("sha256", process.env.MERCADOPAGO_APP_CLIENT_SECRET!)
    .update(payloadB64)
    .digest("hex");

  const bufEsperado = Buffer.from(assinaturaEsperada, "hex");
  const bufRecebido = Buffer.from(assinaturaRecebida, "hex");
  if (bufEsperado.length !== bufRecebido.length || !timingSafeEqual(bufEsperado, bufRecebido)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
      lojaId: string;
      tenantId: string;
      nonce: string;
      ts: number;
    };
    if (Date.now() - payload.ts > JANELA_STATE_MS) return null;
    if (!payload.lojaId || !payload.tenantId) return null;
    return { lojaId: payload.lojaId, tenantId: payload.tenantId };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isSystemAdmin(user.id))) {
    return NextResponse.redirect(new URL("/login", origemConfiavel()));
  }

  const state = req.nextUrl.searchParams.get("state");
  const dados = state ? verificarState(state) : null;
  if (!dados) {
    // state ausente/inválido/expirado — não há destino confiável para redirecionar.
    return NextResponse.json({ error: "Sessão de conexão inválida ou expirada. Tente novamente." }, {
      status: 400,
    });
  }

  const { lojaId, tenantId } = dados;
  const destino = (query: string) =>
    NextResponse.redirect(
      new URL(`/admin/empresas/${tenantId}/lojas/${lojaId}/mercadopago${query}`, origemConfiavel()),
    );

  const erroMp = req.nextUrl.searchParams.get("error");
  if (erroMp) {
    return destino("?erro=oauth_cancelado");
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return destino("?erro=falha_oauth");
  }

  try {
    const dto = await exchangeAuthorizationCode(code, process.env.MERCADOPAGO_REDIRECT_URI!);
    const tokenExpiresAt = new Date(Date.now() + dto.expires_in * 1000).toISOString();

    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin.from("mercadopago_configuracoes").upsert(
      {
        loja_id: lojaId,
        mp_user_id: String(dto.user_id),
        access_token: encrypt(dto.access_token),
        refresh_token: encrypt(dto.refresh_token),
        public_key: dto.public_key,
        scope: dto.scope,
        live_mode: dto.live_mode,
        token_expires_at: tokenExpiresAt,
        status: "conectado",
        conectado_em: new Date().toISOString(),
        desconectado_em: null,
      },
      { onConflict: "loja_id" },
    );

    if (error) throw new Error(error.message);

    return destino("?conectado=1");
  } catch (err) {
    console.error(`[mercadopago-callback] falha para a loja ${lojaId}: ${(err as Error).message}`);
    return destino("?erro=falha_oauth");
  }
}
