import { NextRequest, NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojaDbConfig } from "@/lib/db/tenants";
import { queryBridge } from "@/lib/mssql/client";

export const dynamic = "force-dynamic";

export interface ComissaoRow {
  RecebimentoId: number;
  VendaId: number;
  TipoVenda: string;
  NomeVendedor: string;
  VendedorId: number;
  DataPagamento: string;
  ValorTotalVenda: number;
  BaseCalculoComissao: number;
  ValorRecebidoLiquido: number;
  TipoVista: number | null;
  TipoPrazo: number | null;
  TipoPagamento: string;
}

function buildQuery(vendedorClause: string): string {
  return `
    WITH CTE_OrigemVenda AS (
      SELECT
        p.pgtId, p.pgtRef, p.pgtVendaId, p.pgtValor,
        p.pgtValorJuros, p.pgtValorMulta, p.pgtDataQuitou,
        p.pgtAtendente, p.pgtTipoVista, p.pgtTipoPrazo
      FROM vendapgto p
      WHERE p.pgtRef IS NULL
        AND p.empId = @empId

      UNION ALL

      SELECT
        p.pgtId, p.pgtRef, c.pgtVendaId, p.pgtValor,
        p.pgtValorJuros, p.pgtValorMulta, p.pgtDataQuitou,
        p.pgtAtendente, p.pgtTipoVista, p.pgtTipoPrazo
      FROM vendapgto p
      INNER JOIN CTE_OrigemVenda c ON p.pgtRef = c.pgtId
    )

    SELECT
      pgtoFinal.pgtId                                                                  AS RecebimentoId,
      venda.vedId                                                                      AS VendaId,
      venda.vedTipo                                                                    AS TipoVenda,
      cli.cliNome                                                                      AS NomeVendedor,
      pgtoFinal.pgtAtendente                                                           AS VendedorId,
      pgtoFinal.pgtDataQuitou                                                          AS DataPagamento,
      ROUND(ISNULL(TotalVenda.Total, 0), 2)                                           AS ValorTotalVenda,
      ROUND(ISNULL(
        CASE WHEN venda.vedTipo = 'OS' THEN TotalPecas.Pecas ELSE TotalVenda.Total END
      , 0), 2)                                                                         AS BaseCalculoComissao,
      ROUND(
        ISNULL(pgtoFinal.pgtValor, 0)
        - ISNULL(pgtoFinal.pgtValorJuros, 0)
        - ISNULL(pgtoFinal.pgtValorMulta, 0)
      , 2)                                                                             AS ValorRecebidoLiquido,
      pgtoFinal.pgtTipoVista                                                          AS TipoVista,
      pgtoFinal.pgtTipoPrazo                                                          AS TipoPrazo,
      CASE
        WHEN pgtoFinal.pgtTipoVista = 0 THEN 'Dinheiro'
        WHEN pgtoFinal.pgtTipoVista = 1 THEN 'Cheque à Vista'
        WHEN pgtoFinal.pgtTipoVista = 2 THEN 'Cartão Débito'
        WHEN pgtoFinal.pgtTipoVista = 3 THEN 'Depósito'
        WHEN pgtoFinal.pgtTipoVista = 4 THEN 'Dep./PIX'
        WHEN pgtoFinal.pgtTipoPrazo = 0 THEN 'Cartão Crédito'
        WHEN pgtoFinal.pgtTipoPrazo = 1 THEN 'Cheque Pré'
        WHEN pgtoFinal.pgtTipoPrazo = 2 THEN 'Carteira'
        WHEN pgtoFinal.pgtTipoPrazo = 3 THEN 'Boleto'
        WHEN pgtoFinal.pgtTipoPrazo = 4 THEN 'Vale'
        WHEN pgtoFinal.pgtTipoPrazo = 5 THEN 'Cheque Dev.'
        WHEN pgtoFinal.pgtTipoPrazo = 6 THEN 'Débito Conta'
        WHEN pgtoFinal.pgtTipoPrazo = 7 THEN 'Custódia'
        ELSE 'Outro'
      END                                                                              AS TipoPagamento

    FROM CTE_OrigemVenda pgtoFinal
    INNER JOIN venda ON venda.vedId = pgtoFinal.pgtVendaId AND venda.empId = @empId
    INNER JOIN cliente cli ON cli.cliId = venda.vedAtendente AND cli.empId = @empId

    OUTER APPLY (
      SELECT SUM((vi.vdiValor - (vi.vdiValor * ISNULL(vi.vdiDesc, 0))) * vi.vdiQtde) AS Total
      FROM vendaItem vi
      WHERE vi.vdiVedId = venda.vedId
        AND (vi.vdiStatus IS NULL OR vi.vdiStatus = '')
    ) AS TotalVenda

    OUTER APPLY (
      SELECT SUM((vi.vdiValor - (vi.vdiValor * ISNULL(vi.vdiDesc, 0))) * vi.vdiQtde) AS Pecas
      FROM vendaItem vi
      INNER JOIN produto pr ON pr.proId = vi.vdiItemId
      WHERE vi.vdiVedId = venda.vedId
        AND (vi.vdiStatus IS NULL OR vi.vdiStatus = '')
        AND pr.proTipo = 'P'
    ) AS TotalPecas

    WHERE
      NOT EXISTS (
        SELECT 1 FROM vendaPgto p2
        WHERE p2.pgtRef = pgtoFinal.pgtId AND p2.empId = @empId
      )
      AND CONVERT(date, pgtoFinal.pgtDataQuitou) BETWEEN @start AND @end
      ${vendedorClause}

    ORDER BY pgtoFinal.pgtDataQuitou, pgtoFinal.pgtId
  `;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;

  const lojaIds = (searchParams.get("lojaIds") ?? "").split(",").filter(Boolean);
  if (lojaIds.length === 0)
    return NextResponse.json({ error: "lojaIds obrigatório" }, { status: 400 });

  const start = searchParams.get("start");
  const end   = searchParams.get("end");
  if (!start || !end)
    return NextResponse.json({ error: "start e end obrigatórios" }, { status: 400 });

  const vendedorIds = (searchParams.get("vendedorIds") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0);

  const guard = await requireTenantAccess(lojaIds);
  if (guard instanceof NextResponse) return guard;

  const config = await getLojaDbConfig(lojaIds[0]).catch(() => null);
  if (!config)
    return NextResponse.json({ error: "Bridge não configurada" }, { status: 503 });

  // Build dynamic IN clause for vendedores (avoids STRING_SPLIT version dependency)
  const vendedorParams: Record<string, number> = {};
  let vendedorClause = "";
  if (vendedorIds.length > 0) {
    const placeholders = vendedorIds.map((id, i) => {
      vendedorParams[`vid${i}`] = id;
      return `@vid${i}`;
    });
    vendedorClause = `AND pgtoFinal.pgtAtendente IN (${placeholders.join(", ")})`;
  }

  try {
    const rows = await queryBridge<ComissaoRow>(
      config,
      buildQuery(vendedorClause),
      { empId: config.empId, start, end, ...vendedorParams }
    );
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("[comissao-recebimento]", err);
    return NextResponse.json({ error: "Erro ao executar relatório" }, { status: 500 });
  }
}
