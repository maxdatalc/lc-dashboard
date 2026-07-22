/**
 * GET /api/cron/pix-expirar
 *
 * Detecta tentativas de PIX pendentes cujo date_of_expiration já passou —
 * do NOSSO lado (não depende de reconsultar o status no Mercado Pago: o
 * comportamento exato de status/status_detail que o MP atribui a um PIX
 * vencido via /v1/payments clássico não é 100% documentado publicamente).
 * Só MARCA como "expirado" — a geração do próximo QR é responsabilidade do
 * cliente (client-side, storefront), automática na próxima vez que a tela
 * de pagamento estiver aberta. Não chama o Mercado Pago aqui.
 *
 * Registrado manualmente no cron-job.org (a cada poucos minutos) — NUNCA
 * em vercel.json (plano Hobby só permite cron diário nativo).
 */
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from("ecom_pedido_pix")
    .update({ status: "expirado", atualizado_em: new Date().toISOString() })
    .eq("status", "pendente")
    .lt("date_of_expiration", new Date().toISOString())
    .select("id");

  if (error) {
    console.error(`[pix-expirar] falhou: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ expirados: data?.length ?? 0 });
}
