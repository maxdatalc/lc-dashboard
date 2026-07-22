/**
 * POST /api/internal/mercadopago-public-key
 *
 * ÚNICO endpoint interno do módulo Mercado Pago que devolve um valor não
 * secreto: public_key é projetado pelo próprio Mercado Pago para uso
 * client-side (inicializa o CardForm no navegador do cliente) — não passa
 * por encrypt()/decrypt() como access_token/refresh_token. Mesmo assim fica
 * atrás do mesmo Bearer INTERNAL_API_SECRET dos demais endpoints internos,
 * por consistência — não por necessidade de sigilo do valor em si.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const schema = z.object({ loja_id: z.string().uuid() });

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

  const supabaseAdmin = createAdminClient();
  const { data: config } = await supabaseAdmin
    .from("mercadopago_configuracoes")
    .select("public_key, status")
    .eq("loja_id", parsed.data.loja_id)
    .maybeSingle();

  if (!config || config.status !== "conectado" || !config.public_key) {
    return NextResponse.json({ error: "mercadopago_nao_conectado" }, { status: 503 });
  }

  return NextResponse.json({ public_key: config.public_key });
}
