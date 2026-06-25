import { NextRequest, NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojaDbConfig } from "@/lib/db/tenants";
import { queryBridge } from "@/lib/mssql/client";

export const dynamic = "force-dynamic";

export interface ComissaoRow {
  RecebimentoId: number;
  VendaId: number;
  TipoVenda: string;
  VendedorId: number | null;
  NomeVendedor: string | null;
  DataPagamento: string;
  ValorVendaOrigem: number;
  ValorParcela: number;
  TotalParcelasVenda: number | null;
  ValorRecebidoRateado: number;
  ValorTotalVenda: number;
  BaseCalculoComissao: number;
  PercentualComissao: number;  // decimal 0-1 (ex: 0.02 para 2%)
  ComissaoTotal: number;
  ComissaoPaga: number;
  TipoPagamento: string;
  TipoVistaOrigem: number | null;
  TipoPrazoOrigem: number | null;
}

function buildQuery(vendedorClause: string): string {
  return `
    WITH Recebimentos AS (
      SELECT
        p.pgtId,
        p.pgtRef,
        p.pgtVendaId,
        p.pgtValor,
        p.pgtValorJuros,
        p.pgtValorMulta,
        p.pgtDataQuitou,
        p.pgtAtendente,
        p.pgtTipoVista,
        p.pgtTipoPrazo
      FROM vendaPgto p
      WHERE p.pgtPago = 'S'
        AND p.empId = @empId
        AND CONVERT(date, p.pgtDataQuitou) BETWEEN @start AND @end
        ${vendedorClause}
    ),

    Arvore AS (
      SELECT
        r.pgtId AS RecebimentoId,
        r.pgtId,
        r.pgtRef,
        r.pgtVendaId,
        r.pgtValor,
        r.pgtTipoVista,
        r.pgtTipoPrazo
      FROM Recebimentos r

      UNION ALL

      SELECT
        a.RecebimentoId,
        pai.pgtId,
        pai.pgtRef,
        pai.pgtVendaId,
        pai.pgtValor,
        pai.pgtTipoVista,
        pai.pgtTipoPrazo
      FROM Arvore a
      INNER JOIN vendaPgto pai ON pai.pgtId = a.pgtRef
    ),

    VendasOrigem AS (
      SELECT
        a.RecebimentoId,
        o.pgtVendaId,
        SUM(o.pgtValor) AS ValorVenda,
        MAX(o.pgtTipoVista) AS pgtTipoVistaOrigem,
        MAX(o.pgtTipoPrazo) AS pgtTipoPrazoOrigem
      FROM Arvore a
      INNER JOIN vendaPgto o ON o.pgtRef = a.pgtId
      WHERE o.pgtVendaId IS NOT NULL
      GROUP BY a.RecebimentoId, o.pgtVendaId

      UNION

      SELECT
        r.pgtId,
        r.pgtVendaId,
        (SELECT SUM(vp.pgtValor) FROM vendaPgto vp WHERE vp.pgtVendaId = r.pgtVendaId) AS ValorVenda,
        r.pgtTipoVista,
        r.pgtTipoPrazo
      FROM Recebimentos r
      WHERE r.pgtVendaId IS NOT NULL

      UNION

      SELECT
        a.RecebimentoId,
        a.pgtVendaId,
        (SELECT SUM(vp.pgtValor) FROM vendaPgto vp WHERE vp.pgtVendaId = a.pgtVendaId) AS ValorVenda,
        a.pgtTipoVista,
        a.pgtTipoPrazo
      FROM Arvore a
      WHERE a.pgtVendaId IS NOT NULL
    ),

    Rateio AS (
      SELECT
        v.*,
        CAST(
          v.ValorVenda /
          NULLIF(SUM(v.ValorVenda) OVER (PARTITION BY v.RecebimentoId), 0)
        AS DECIMAL(18,10)) AS PercentualRateio
      FROM VendasOrigem v
    )

    SELECT
      rec.pgtId                                                                        AS RecebimentoId,
      v.vedId                                                                          AS VendaId,
      v.vedTipo                                                                        AS TipoVenda,
      rec.pgtAtendente                                                                 AS VendedorId,
      cli.cliNome                                                                      AS NomeVendedor,
      rec.pgtDataQuitou                                                                AS DataPagamento,
      ROUND(rt.ValorVenda, 2)                                                          AS ValorVendaOrigem,
      rec.pgtValor                                                                     AS ValorParcela,
      ParcelaVenda.TotalParcelasVenda,
      ROUND(
        (ISNULL(rec.pgtValor, 0) - ISNULL(rec.pgtValorJuros, 0) - ISNULL(rec.pgtValorMulta, 0))
        * rt.PercentualRateio, 2
      )                                                                                AS ValorRecebidoRateado,
      ROUND(ISNULL(TotalVenda.Total, 0), 2)                                           AS ValorTotalVenda,
      ROUND(BaseCalc.Valor, 2)                                                         AS BaseCalculoComissao,
      AliqComissao.AliqPct / 100.0                                                     AS PercentualComissao,
      ROUND(BaseCalc.Valor * AliqComissao.AliqPct / 100.0, 2)                         AS ComissaoTotal,
      ROUND(
        BaseCalc.Valor * AliqComissao.AliqPct / 100.0
        * (
          (ISNULL(rec.pgtValor, 0) - ISNULL(rec.pgtValorJuros, 0) - ISNULL(rec.pgtValorMulta, 0))
          * rt.PercentualRateio
          / NULLIF(
            CASE
              WHEN ParcelaVenda.TotalParcelasVenda IS NOT NULL
                   AND ParcelaVenda.TotalParcelasVenda > rt.ValorVenda
                THEN ParcelaVenda.TotalParcelasVenda
              ELSE rt.ValorVenda
            END, 0
          )
        ), 2
      )                                                                                AS ComissaoPaga,
      CASE
        WHEN rt.pgtTipoVistaOrigem = 0 THEN 'Dinheiro'
        WHEN rt.pgtTipoVistaOrigem = 1 THEN 'Cheque à Vista'
        WHEN rt.pgtTipoVistaOrigem = 2 THEN 'Cartão Débito'
        WHEN rt.pgtTipoVistaOrigem = 3 THEN 'Depósito'
        WHEN rt.pgtTipoVistaOrigem = 4 THEN 'Dep./PIX'
        WHEN rt.pgtTipoPrazoOrigem = 0 THEN 'Cartão Crédito'
        WHEN rt.pgtTipoPrazoOrigem = 1 THEN 'Cheque Pré'
        WHEN rt.pgtTipoPrazoOrigem = 2 THEN 'Carteira'
        WHEN rt.pgtTipoPrazoOrigem = 3 THEN 'Boleto'
        WHEN rt.pgtTipoPrazoOrigem = 4 THEN 'Vale'
        WHEN rt.pgtTipoPrazoOrigem = 5 THEN 'Cheque Dev.'
        WHEN rt.pgtTipoPrazoOrigem = 6 THEN 'Débito Conta'
        WHEN rt.pgtTipoPrazoOrigem = 7 THEN 'Custódia'
        ELSE 'Outro'
      END                                                                              AS TipoPagamento,
      rt.pgtTipoVistaOrigem                                                            AS TipoVistaOrigem,
      rt.pgtTipoPrazoOrigem                                                            AS TipoPrazoOrigem

    FROM Rateio rt
    INNER JOIN Recebimentos rec   ON rec.pgtId  = rt.RecebimentoId
    INNER JOIN venda v            ON v.vedId    = rt.pgtVendaId AND v.empId = @empId
    INNER JOIN cliente cli        ON cli.cliId  = v.vedAtendente
    INNER JOIN configVenda cv     ON cv.empId   = @empId

    OUTER APPLY (
      SELECT SUM((vi.vdiValor - (vi.vdiValor * ISNULL(vi.vdiDesc, 0))) * vi.vdiQtde) AS Total
      FROM vendaItem vi
      WHERE vi.vdiVedId = v.vedId
        AND (vi.vdiStatus IS NULL OR vi.vdiStatus = '')
    ) TotalVenda

    OUTER APPLY (
      SELECT SUM((vi.vdiValor - (vi.vdiValor * ISNULL(vi.vdiDesc, 0))) * vi.vdiQtde) AS Pecas
      FROM vendaItem vi
      INNER JOIN produto pr ON pr.proId = vi.vdiItemId
      WHERE vi.vdiVedId = v.vedId
        AND (vi.vdiStatus IS NULL OR vi.vdiStatus = '')
        AND pr.proTipo = 'P'
    ) TotalPecas

    OUTER APPLY (
      SELECT SUM(vp.pgtValor) AS TotalParcelasVenda
      FROM vendaPgto vp
      WHERE vp.pgtVendaId = v.vedId
    ) ParcelaVenda

    /* Base de cálculo: pecas para OS, total da venda para VE */
    CROSS APPLY (
      SELECT CASE
        WHEN v.vedTipo = 'OS' THEN ISNULL(TotalPecas.Pecas, 0)
        ELSE ISNULL(TotalVenda.Total, 0)
      END AS Valor
    ) BaseCalc

    /* Alíquota de comissão vinda de configVenda, por forma de pagamento original */
    CROSS APPLY (
      SELECT CASE
        WHEN rt.pgtTipoVistaOrigem = 0 THEN ISNULL(cv.cofVedAliqComissaoFinanceiroDinheiro,  0)
        WHEN rt.pgtTipoVistaOrigem = 1 THEN ISNULL(cv.cofVedAliqComissaoFinanceiroChequeVista, 0)
        WHEN rt.pgtTipoVistaOrigem = 2 THEN ISNULL(cv.cofVedAliqComissaoFinanceiroCartaoDebito, 0)
        WHEN rt.pgtTipoVistaOrigem = 3 THEN ISNULL(cv.cofVedAliqComissaoFinanceiroDeposito,  0)
        WHEN rt.pgtTipoVistaOrigem = 4 THEN ISNULL(cv.cofVedAliqComissaoFinanceiroPix,       0)
        WHEN rt.pgtTipoPrazoOrigem = 0 THEN ISNULL(cv.cofVedAliqComissaoFinanceiroCartaoCredito, 0)
        WHEN rt.pgtTipoPrazoOrigem = 1 THEN ISNULL(cv.cofVedAliqComissaoFinanceiroChequePrazo, 0)
        WHEN rt.pgtTipoPrazoOrigem = 2 THEN ISNULL(cv.cofVedAliqComissaoFinanceiroCarteira,  0)
        WHEN rt.pgtTipoPrazoOrigem = 3 THEN ISNULL(cv.cofVedAliqComissaoFinanceiroBoleto,    0)
        ELSE 0
      END AS AliqPct
    ) AliqComissao

    ORDER BY rec.pgtDataQuitou, rec.pgtId, v.vedId

    OPTION (MAXRECURSION 100)
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

  const vendedorParams: Record<string, number> = {};
  let vendedorClause = "";
  if (vendedorIds.length > 0) {
    const placeholders = vendedorIds.map((id, i) => {
      vendedorParams[`vid${i}`] = id;
      return `@vid${i}`;
    });
    vendedorClause = `AND p.pgtAtendente IN (${placeholders.join(", ")})`;
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
