/**
 * GET /api/cron/ecommerce-pedidos-erp
 *
 * Fase 5 (lc-storefront): worker desacoplado do push ao ERP. Roda em duas
 * fases a cada execução — empurra pedidos recém-pagos pra Supervisão de
 * Vendas, depois consulta os que já estão em Supervisão pra detectar
 * aprovação (polling, não existe webhook do MaxManager).
 *
 * Chamado pelo cron-job.org (não pelo cron nativo da Vercel — Hobby plan não
 * roda mais de 1x/dia, ver memória vercel-hobby-cron-limite), que invoca com
 * GET e manda `Authorization: Bearer {CRON_SECRET}`. Mesmo padrão de
 * app/api/cron/ecommerce-catalogo/route.ts.
 */

import { NextRequest, NextResponse } from "next/server";

import { processarPedidosPagos, verificarPedidosPreparando } from "@/lib/ecommerce/pedidos-erp";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const push = await processarPedidosPagos();
    const polling = await verificarPedidosPreparando();

    const pushFalhas = push.filter((r) => !r.ok).length;
    const pollingFalhas = polling.filter((r) => !r.ok).length;

    console.log(
      `[ecommerce-pedidos-erp] push: ${push.length} pedido(s), ${pushFalhas} falha(s). ` +
        `polling: ${polling.length} pedido(s), ${pollingFalhas} falha(s).`,
    );

    return NextResponse.json({ push, polling });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error(`[ecommerce-pedidos-erp] falhou: ${mensagem}`);
    return NextResponse.json({ error: mensagem }, { status: 500 });
  }
}
