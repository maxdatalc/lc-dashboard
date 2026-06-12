import { NextRequest, NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojaDbConfig } from "@/lib/db/tenants";
import { queryBridge, BridgeError } from "@/lib/mssql/client";

export const dynamic = "force-dynamic";

interface ItemRow {
  vdiProNome: string | null;
  vdiQtde: number;
  vdiValor: number;
  vdiTotal: number;
  vdiDesc: number;
}

interface PagamentoRow {
  cavPgtTipoDesc: string | null;
  cavPgtValor: number;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const vedId = params.id;
  const lojaId = req.nextUrl.searchParams.get("lojaId");

  if (!lojaId) {
    return NextResponse.json({ error: "lojaId é obrigatório" }, { status: 400 });
  }

  const guard = await requireTenantAccess([lojaId]);
  if (guard instanceof NextResponse) return guard;

  const config = await getLojaDbConfig(lojaId).catch(() => null);
  if (!config) {
    return NextResponse.json({ error: "Bridge SQL não configurada." }, { status: 503 });
  }

  try {
    const [itensRows, pagamentosRows] = await Promise.all([
      queryBridge<ItemRow>(
        config,
        `SELECT
          vdiProNome,
          vdiQtde,
          vdiValor,
          ISNULL(vdiQtde * vdiValor, 0) AS vdiTotal,
          ISNULL(vdiDesc, 0)            AS vdiDesc
        FROM vendaItem
        WHERE vdiVedId = @id AND vdiCancel = 0
        ORDER BY vdiId`,
        { id: vedId }
      ),
      queryBridge<PagamentoRow>(
        config,
        `SELECT cavPgtTipoDesc, ISNULL(cavPgtValor, 0) AS cavPgtValor
        FROM caixaVendas
        WHERE cavVedId = @id
        ORDER BY cavId`,
        { id: vedId }
      ),
    ]);

    return NextResponse.json({
      itens: itensRows.map((r) => ({
        produto_nome:   r.vdiProNome ?? null,
        quantidade:     Number(r.vdiQtde),
        valor_unitario: Number(r.vdiValor),
        valor_total:    Number(r.vdiTotal),
        desconto:       Number(r.vdiDesc),
      })),
      pagamentos: pagamentosRows.map((r) => ({
        forma_pagamento: r.cavPgtTipoDesc ?? null,
        valor:           Number(r.cavPgtValor),
        parcelas:        1,
      })),
    });
  } catch (e) {
    const msg = e instanceof BridgeError ? e.message : String(e instanceof Error ? e.message : e);
    console.error("[vendas/id] bridge error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
