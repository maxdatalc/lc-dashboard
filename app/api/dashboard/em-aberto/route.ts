import { NextRequest, NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojaDbConfig } from "@/lib/db/tenants";
import { queryBridge, BridgeError } from "@/lib/mssql/client";

export const dynamic = "force-dynamic";

interface EmAbertoRow {
  qtd: number;
  valorTotal: number;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const lojaIdsParam = searchParams.get("lojaIds");
  const lojaId = searchParams.get("lojaId");
  const lojaIds = lojaIdsParam
    ? lojaIdsParam.split(",").filter(Boolean)
    : lojaId
    ? [lojaId]
    : [];

  if (lojaIds.length === 0) {
    return NextResponse.json({ error: "lojaId ou lojaIds é obrigatório" }, { status: 400 });
  }

  const guard = await requireTenantAccess(lojaIds);
  if (guard instanceof NextResponse) return guard;

  let qtdVendas = 0;
  let qtdOs = 0;
  let valorTotal = 0;

  for (const id of lojaIds) {
    const config = await getLojaDbConfig(id).catch(() => null);
    if (!config) continue;

    try {
      // Vendas VE em aberto — aguardando supervisão (tela 113) ou caixa (tela 107)
      // vdiValor = total da linha (qtde × preço − desconto), somado dos itens não cancelados
      const SQL_VE = `
        SELECT COUNT(DISTINCT v.vedId) AS qtd,
               ISNULL(SUM(vi.vdiValor), 0) AS valorTotal
        FROM venda v
        LEFT JOIN vendaItem vi ON vi.vdiVedId = v.vedId AND vi.vdiCancel = 0
        WHERE v.vedStatus = 'O'
          AND v.vedTipo = 'VE'
          AND v.empId = @empId`;

      // OS em aberto com tipo de atendimento que gera financeiro
      const SQL_OS = `
        SELECT COUNT(DISTINCT v.vedId) AS qtd,
               ISNULL(SUM(vi.vdiValor), 0) AS valorTotal
        FROM venda v
        INNER JOIN tipoAtend ta ON ta.tatId = CAST(v.vedTipoAtend AS INT)
        LEFT JOIN vendaItem vi ON vi.vdiVedId = v.vedId AND vi.vdiCancel = 0
        WHERE v.vedStatus = 'O'
          AND v.vedTipo = 'OS'
          AND ta.tatServGeraFinanceiro = 1
          AND v.empId = @empId`;

      const [veRes, osRes] = await Promise.all([
        queryBridge<EmAbertoRow>(config, SQL_VE, { empId: config.empId }),
        queryBridge<EmAbertoRow>(config, SQL_OS, { empId: config.empId }),
      ]);

      qtdVendas  += Number(veRes[0]?.qtd        ?? 0);
      qtdOs      += Number(osRes[0]?.qtd         ?? 0);
      valorTotal += Number(veRes[0]?.valorTotal  ?? 0);
      valorTotal += Number(osRes[0]?.valorTotal  ?? 0);
    } catch (e) {
      const msg = e instanceof BridgeError ? e.message : String(e instanceof Error ? e.message : e);
      console.error(`[em-aberto] bridge error loja ${id}:`, msg);
    }
  }

  return NextResponse.json({
    qtd: qtdVendas + qtdOs,
    qtdVendas,
    qtdOs,
    valorTotal,
  });
}
