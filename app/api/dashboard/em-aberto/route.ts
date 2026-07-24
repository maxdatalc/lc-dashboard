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
      // "Em aberto" = venda/OS já autorizada pelo cliente mas ainda não finalizada
      // no sistema. Confirmado no bridge de testes (SALES) em 2026-07-24 com os
      // exemplos reais 42197 (OS, cli 629, R$1033) e 42186 (OS, R$789,25), ambos
      // vedStatus='X'. Status considerados:
      //   'S' = aguardando Supervisão de Vendas (tela 113),
      //   'X' = no caixa, sem fechar,
      //   'A' = em andamento antes do caixa — só para OS (ver SQL_OS abaixo).
      // NÃO inclui 'O' (abandonada, vedTotalNf sempre 0), 'Q'/'Z' (raros) nem
      // 'F'/'C' (finalizada/cancelada).
      // Valor: vedTotalNf já reflete o desconto de fechamento onde existe (42197 tem
      // vedTotalNf=1033, mas SUM(qtde×valor)=1150 — usar item sem desconto inflava o
      // KPI). Só caímos no SUM(vdiQtde × vdiValor) quando vedTotalNf=0 (ex.: VE em
      // supervisão que ainda não recebeu total). vdiValor é preço UNITÁRIO → × vdiQtde.
      const VALOR_EXPR = `
        ISNULL(SUM(CASE WHEN v.vedTotalNf > 0 THEN v.vedTotalNf
                        ELSE ISNULL(it.itemTotal, 0) END), 0)`;
      const ITEM_APPLY = `
        OUTER APPLY (
          SELECT SUM(vi.vdiQtde * vi.vdiValor) AS itemTotal
          FROM vendaItem vi
          WHERE vi.vdiVedId = v.vedId AND vi.vdiCancel = 0
        ) it`;

      const SQL_VE = `
        SELECT COUNT(*) AS qtd, ${VALOR_EXPR} AS valorTotal
        FROM venda v${ITEM_APPLY}
        WHERE v.vedStatus IN ('S', 'X')
          AND v.vedTipo = 'VE'
          AND v.empId = @empId`;

      // OS em aberto: inclui 'A' (em andamento, antes do caixa) além de supervisão e
      // caixa — uma OS aberta já foi autorizada pelo cliente. É o filtro
      // tatServGeraFinanceiro que exclui orçamento/proposta: no bridge de testes, das
      // 971 OS em 'A', 783 são tipo ORÇAMENTO (geraFinanceiro=false) e só 172 são
      // NORMAL (true) — ou seja, o flag é o que implementa o "não inclui orçamentos"
      // do texto exibido ao usuário. GARANTIA/RETORNO também caem fora por não gerar
      // financeiro. tatServGeraFinanceiro e tatProGeraFinanceiro nunca divergem aqui.
      const SQL_OS = `
        SELECT COUNT(*) AS qtd, ${VALOR_EXPR} AS valorTotal
        FROM venda v
        INNER JOIN tipoAtend ta ON ta.tatId = CAST(v.vedTipoAtend AS INT)${ITEM_APPLY}
        WHERE v.vedStatus IN ('A', 'S', 'X')
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
