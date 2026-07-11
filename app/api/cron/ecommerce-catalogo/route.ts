/**
 * GET /api/cron/ecommerce-catalogo
 *
 * Sincroniza o catálogo do e-commerce (MaxManager → Supabase) e invalida o
 * cache das vitrines afetadas.
 *
 * Chamado pelo Vercel Cron, que invoca com GET e manda
 * `Authorization: Bearer {CRON_SECRET}`.
 */

import { NextRequest, NextResponse } from "next/server";

import { sincronizarCatalogo } from "@/lib/ecommerce/sync-catalogo";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const resultados = await sincronizarCatalogo();

    const falhas = resultados.filter((r) => r.erro).length;
    const produtos = resultados.reduce((total, r) => total + r.produtos, 0);
    const removidos = resultados.reduce((total, r) => total + r.removidos, 0);

    console.log(
      `[ecommerce-sync] ${resultados.length} loja(s), ${produtos} produto(s), ` +
        `${removidos} removido(s), ${falhas} falha(s)`,
    );

    return NextResponse.json({
      lojas: resultados.length,
      produtos,
      removidos,
      falhas,
      resultados,
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error(`[ecommerce-sync] falhou: ${mensagem}`);
    return NextResponse.json({ error: mensagem }, { status: 500 });
  }
}
