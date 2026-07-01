import { NextRequest, NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojaDbConfig } from "@/lib/db/tenants";
import { queryBridge } from "@/lib/mssql/client";

export const dynamic = "force-dynamic";

export interface ComissaoRow {
  RecebimentoId: number;
  VendaId: number | null;
  TipoVenda: string | null;
  TipoRecebimento: string;
  VendedorId: number | null;
  NomeVendedor: string | null;
  DataPagamento: string;
  ValorVendaOrigem: number;
  ValorParcela: number;
  TotalParcelasVenda: number | null;
  ValorRecebidoRateado: number;
  ValorTotalVenda: number;
  BaseCalculoComissao: number;
  PercentualComissao: number;
  ComissaoTotal: number;
  ComissaoPaga: number;
  TipoPagamento: string;
  TipoVistaOrigem: number | null;
  TipoPrazoOrigem: number | null;
  SemVinculo: 0 | 1;
}

// vendedorFilterClause: WHERE aplicado ao SELECT final, filtrando por vendedor em ambos os casos
// Ex (com filtro): "WHERE (v.vedAtendente IN (@vid0,...) OR (rt.RecebimentoId IS NULL AND rec.pgtAtendente IN (@vid0,...)))"
// Ex (sem filtro): ""
function buildQuery(vendedorFilterClause: string): string {
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
        p.pgtTipoPrazo,
        p.pgtTipoOpr
      FROM vendaPgto p
      WHERE p.pgtPago = 'S'
        AND p.empId = @empId
        AND CONVERT(date, p.pgtDataQuitou) BETWEEN @start AND @end
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
      rec.pgtId AS RecebimentoId,
      v.vedId   AS VendaId,
      v.vedTipo AS TipoVenda,
      ISNULL(rec.pgtTipoOpr, '') AS TipoRecebimento,

      CASE WHEN rt.RecebimentoId IS NULL THEN rec.pgtAtendente ELSE v.vedAtendente END AS VendedorId,
      CASE WHEN rt.RecebimentoId IS NULL THEN att.cliNome      ELSE cli.cliNome      END AS NomeVendedor,

      rec.pgtDataQuitou AS DataPagamento,

      ISNULL(ROUND(rt.ValorVenda, 2), 0) AS ValorVendaOrigem,
      rec.pgtValor AS ValorParcela,
      ParcelaVenda.TotalParcelasVenda,

      ROUND(
        (ISNULL(rec.pgtValor,0) - ISNULL(rec.pgtValorJuros,0) - ISNULL(rec.pgtValorMulta,0))
        * ISNULL(rt.PercentualRateio, 1), 2
      ) AS ValorRecebidoRateado,

      ROUND(ISNULL(TotalVenda.Total, 0), 2) AS ValorTotalVenda,
      ROUND(BaseCalc.Valor, 2)              AS BaseCalculoComissao,
      AliqComissao.AliqPct / 100.0          AS PercentualComissao,

      ISNULL(ROUND(BaseCalc.Valor * AliqComissao.AliqPct / 100.0, 2), 0) AS ComissaoTotal,

      ISNULL(ROUND(
        BaseCalc.Valor * AliqComissao.AliqPct / 100.0
        * (
          (ISNULL(rec.pgtValor,0) - ISNULL(rec.pgtValorJuros,0) - ISNULL(rec.pgtValorMulta,0))
          * ISNULL(rt.PercentualRateio, 1)
          / NULLIF(CASE
              WHEN ParcelaVenda.TotalParcelasVenda IS NOT NULL
                   AND ParcelaVenda.TotalParcelasVenda > rt.ValorVenda
                THEN ParcelaVenda.TotalParcelasVenda
              ELSE rt.ValorVenda
            END, 0)
        ), 2
      ), 0) AS ComissaoPaga,

      CASE
        WHEN ISNULL(rt.pgtTipoVistaOrigem, rec.pgtTipoVista) = 0 THEN 'Dinheiro'
        WHEN ISNULL(rt.pgtTipoVistaOrigem, rec.pgtTipoVista) = 1 THEN 'Cheque a Vista'
        WHEN ISNULL(rt.pgtTipoVistaOrigem, rec.pgtTipoVista) = 2 THEN 'Cartao Debito'
        WHEN ISNULL(rt.pgtTipoVistaOrigem, rec.pgtTipoVista) = 3 THEN 'Deposito'
        WHEN ISNULL(rt.pgtTipoVistaOrigem, rec.pgtTipoVista) = 4 THEN 'Dep./PIX'
        WHEN ISNULL(rt.pgtTipoPrazoOrigem, rec.pgtTipoPrazo) = 0 THEN 'Cartao Credito'
        WHEN ISNULL(rt.pgtTipoPrazoOrigem, rec.pgtTipoPrazo) = 1 THEN 'Cheque Pre'
        WHEN ISNULL(rt.pgtTipoPrazoOrigem, rec.pgtTipoPrazo) = 2 THEN 'Carteira'
        WHEN ISNULL(rt.pgtTipoPrazoOrigem, rec.pgtTipoPrazo) = 3 THEN 'Boleto'
        WHEN ISNULL(rt.pgtTipoPrazoOrigem, rec.pgtTipoPrazo) = 4 THEN 'Vale'
        WHEN ISNULL(rt.pgtTipoPrazoOrigem, rec.pgtTipoPrazo) = 5 THEN 'Cheque Dev.'
        WHEN ISNULL(rt.pgtTipoPrazoOrigem, rec.pgtTipoPrazo) = 6 THEN 'Debito Conta'
        WHEN ISNULL(rt.pgtTipoPrazoOrigem, rec.pgtTipoPrazo) = 7 THEN 'Custodia'
        ELSE 'Outro'
      END AS TipoPagamento,

      ISNULL(rt.pgtTipoVistaOrigem, rec.pgtTipoVista) AS TipoVistaOrigem,
      ISNULL(rt.pgtTipoPrazoOrigem, rec.pgtTipoPrazo) AS TipoPrazoOrigem,

      CASE WHEN rt.RecebimentoId IS NULL THEN 1 ELSE 0 END AS SemVinculo

    FROM Recebimentos rec
    LEFT JOIN Rateio rt ON rt.RecebimentoId = rec.pgtId
    LEFT JOIN venda v   ON v.vedId = rt.pgtVendaId AND v.empId = @empId
    LEFT JOIN cliente cli ON cli.cliId = v.vedAtendente
    LEFT JOIN cliente att ON att.cliId = rec.pgtAtendente
    LEFT JOIN configVenda cv ON cv.empId = @empId

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

    CROSS APPLY (
      SELECT CASE
        WHEN rec.pgtTipoOpr = 'DV' THEN 0
        WHEN v.vedTipo = 'OS'       THEN ISNULL(TotalPecas.Pecas, 0)
        ELSE                             ISNULL(TotalVenda.Total, 0)
      END AS Valor
    ) BaseCalc

    CROSS APPLY (
      SELECT CASE
        WHEN rec.pgtTipoOpr                              = 'DV' THEN 0
        WHEN ISNULL(rt.pgtTipoVistaOrigem, rec.pgtTipoVista) = 0 THEN ISNULL(cv.cofVedAliqComissaoFinanceiroDinheiro,      0)
        WHEN ISNULL(rt.pgtTipoVistaOrigem, rec.pgtTipoVista) = 1 THEN ISNULL(cv.cofVedAliqComissaoFinanceiroChequeVista,   0)
        WHEN ISNULL(rt.pgtTipoVistaOrigem, rec.pgtTipoVista) = 2 THEN ISNULL(cv.cofVedAliqComissaoFinanceiroCartaoDebito,  0)
        WHEN ISNULL(rt.pgtTipoVistaOrigem, rec.pgtTipoVista) = 3 THEN ISNULL(cv.cofVedAliqComissaoFinanceiroDeposito,      0)
        WHEN ISNULL(rt.pgtTipoVistaOrigem, rec.pgtTipoVista) = 4 THEN ISNULL(cv.cofVedAliqComissaoFinanceiroPix,           0)
        WHEN ISNULL(rt.pgtTipoPrazoOrigem, rec.pgtTipoPrazo) = 0 THEN ISNULL(cv.cofVedAliqComissaoFinanceiroCartaoCredito, 0)
        WHEN ISNULL(rt.pgtTipoPrazoOrigem, rec.pgtTipoPrazo) = 1 THEN ISNULL(cv.cofVedAliqComissaoFinanceiroChequePrazo,   0)
        WHEN ISNULL(rt.pgtTipoPrazoOrigem, rec.pgtTipoPrazo) = 2 THEN ISNULL(cv.cofVedAliqComissaoFinanceiroCarteira,      0)
        WHEN ISNULL(rt.pgtTipoPrazoOrigem, rec.pgtTipoPrazo) = 3 THEN ISNULL(cv.cofVedAliqComissaoFinanceiroBoleto,        0)
        ELSE 0
      END AS AliqPct
    ) AliqComissao

    ${vendedorFilterClause}

    ORDER BY DataPagamento, RecebimentoId

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
  let vendedorFilterClause = "";

  if (vendedorIds.length > 0) {
    const placeholders = vendedorIds.map((id, i) => {
      vendedorParams[`vid${i}`] = id;
      return `@vid${i}`;
    });
    const inList = placeholders.join(", ");
    // Com vínculo: filtra por v.vedAtendente | Sem vínculo: filtra por rec.pgtAtendente
    vendedorFilterClause = `WHERE (v.vedAtendente IN (${inList}) OR (rt.RecebimentoId IS NULL AND rec.pgtAtendente IN (${inList})))`;
  }

  try {
    const rows = await queryBridge<ComissaoRow>(
      config,
      buildQuery(vendedorFilterClause),
      { empId: config.empId, start, end, ...vendedorParams }
    );
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("[comissao-recebimento]", err);
    return NextResponse.json({ error: "Erro ao executar relatório" }, { status: 500 });
  }
}
