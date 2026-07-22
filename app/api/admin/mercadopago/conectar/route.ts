/**
 * GET /api/admin/mercadopago/conectar?lojaId=...&tenantId=...
 *
 * Inicia o fluxo OAuth marketplace do Mercado Pago para UMA loja. Redireciona
 * o navegador do admin para a tela de autorização do MP; o vendedor (dono da
 * conta MP da loja) faz login lá e autoriza — nunca aqui.
 *
 * `state` carrega {lojaId, tenantId, nonce, ts} assinado com HMAC-SHA256
 * (MERCADOPAGO_APP_CLIENT_SECRET), verificado no callback (assinatura + ts
 * com no máximo 15 min). Não usa tabela própria de states: só um admin
 * autenticado consegue gerar o link (isSystemAdmin aqui), e o callback
 * reexige isSystemAdmin da sessão de quem clicou — um state vazado só é
 * útil para outro admin já autenticado do mesmo sistema.
 */
import { createHmac, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { isSystemAdmin } from "@/lib/db/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Origem confiável para o redirect de "não autorizado". NÃO usar req.url:
 * atrás de um túnel local (ngrok/cloudflared) o Next pode enxergar o Host
 * como "localhost:PORT", gerando um Location inalcançável pelo navegador.
 * MERCADOPAGO_REDIRECT_URI já precisa ser o domínio público correto para o
 * próprio OAuth funcionar — funciona igual em produção e em túnel local.
 */
function origemConfiavel(): string {
  return new URL(process.env.MERCADOPAGO_REDIRECT_URI!).origin;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isSystemAdmin(user.id))) {
    return NextResponse.redirect(new URL("/login", origemConfiavel()));
  }

  const lojaId = req.nextUrl.searchParams.get("lojaId");
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!lojaId || !tenantId) {
    return NextResponse.json({ error: "lojaId e tenantId são obrigatórios" }, { status: 400 });
  }

  const payload = { lojaId, tenantId, nonce: randomUUID(), ts: Date.now() };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const assinatura = createHmac("sha256", process.env.MERCADOPAGO_APP_CLIENT_SECRET!)
    .update(payloadB64)
    .digest("hex");
  const state = `${payloadB64}.${assinatura}`;

  const url = new URL("https://auth.mercadopago.com/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.MERCADOPAGO_APP_CLIENT_ID!);
  url.searchParams.set("redirect_uri", process.env.MERCADOPAGO_REDIRECT_URI!);
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("scope", "offline_access"); // necessário para receber refresh_token
  url.searchParams.set("state", state);

  return NextResponse.redirect(url);
}
