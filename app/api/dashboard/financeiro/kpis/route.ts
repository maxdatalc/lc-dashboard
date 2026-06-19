import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojaDbConfig } from "@/lib/db/tenants";
import { queryBridge } from "@/lib/mssql/client";

export const dynamic = "force-dynamic";

function isDate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }

function toStr(d: Date) { return d.toISOString().split("T")[0]; }

async function getConfig(lojaIds: string[]) {
  for (const id of lojaIds) {
    const cfg = await getLojaDbConfig(id);
    if (cfg) return cfg;
  }
  return null;
}

export async function GET(request: Request) {
  const auth = await requireTenantAccess();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const lojaIds = (searchParams.get("lojaIds") ?? "").split(",").filter(Boolean);
  if (lojaIds.length === 0) return NextResponse.json({ error: "lojaIds obrigatório" }, { status: 400 });

  const start = searchParams.get("start") ?? "";
  const end   = searchParams.get("end")   ?? "";
  if (!isDate(start) || !isDate(end)) {
    return NextResponse.json({ error: "start e end obrigatórios (YYYY-MM-DD)" }, { status: 400 });
  }

  const cfg = await getConfig(lojaIds);
  if (!cfg) return NextResponse.json({ error: "Bridge não configurada" }, { status: 404 });

  const { bridgeUrl, token, empId } = cfg;

  // Período anterior com mesma duração
  const startMs   = new Date(start + "T12:00:00").getTime();
  const endMs     = new Date(end   + "T12:00:00").getTime();
  const durationMs = endMs - startMs;
  const prevEndDate   = new Date(startMs - 86400000);
  const prevStartDate = new Date(prevEndDate.getTime() - durationMs);
  const prevStart = toStr(prevStartDate);
  const prevEnd   = toStr(prevEndDate);

  // Helpers: qCur = período selecionado, qPrev = período anterior, qNow = estado atual
  const qCur  = <T>(sql: string) => queryBridge<T>({ bridgeUrl, token }, sql, { empId, start, end });
  const qPrev = <T>(sql: string) => queryBridge<T>({ bridgeUrl, token }, sql, { empId, start: prevStart, end: prevEnd });
  const qNow  = <T>(sql: string) => queryBridge<T>({ bridgeUrl, token }, sql, { empId });

  const [
    fatRes,
    fatPrevRes,
    recRes,
    recPrevRes,
    saldoRes,
    saldoPrevRes,
    margemRes,
    contasReceberRes,
    contasPagarRes,
    inadRes,
    aVencer7Res,
  ] = await Promise.allSettled([
    // Faturamento período atual
    qCur<{ valor: number; qtd: number }>(`
      SELECT ISNULL(SUM(vedTotalNf),0) AS valor, COUNT(*) AS qtd
      FROM venda
      WHERE vedStatus='F' AND vedTipo IN ('OS','VE') AND vedTotalNf>0 AND empId=@empId
        AND CONVERT(date,vedFechamento) BETWEEN @start AND @end
    `),
    // Faturamento período anterior
    qPrev<{ valor: number }>(`
      SELECT ISNULL(SUM(vedTotalNf),0) AS valor
      FROM venda
      WHERE vedStatus='F' AND vedTipo IN ('OS','VE') AND vedTotalNf>0 AND empId=@empId
        AND CONVERT(date,vedFechamento) BETWEEN @start AND @end
    `),
    // Recebimentos período atual
    qCur<{ valor: number; qtd: number }>(`
      SELECT ISNULL(SUM(pgtValor),0) AS valor, COUNT(*) AS qtd
      FROM vendaPgto
      WHERE pgtPago='S' AND empId=@empId AND pgtDataQuitou IS NOT NULL
        AND CONVERT(date,pgtDataQuitou) BETWEEN @start AND @end
    `),
    // Recebimentos período anterior
    qPrev<{ valor: number }>(`
      SELECT ISNULL(SUM(pgtValor),0) AS valor
      FROM vendaPgto
      WHERE pgtPago='S' AND empId=@empId AND pgtDataQuitou IS NOT NULL
        AND CONVERT(date,pgtDataQuitou) BETWEEN @start AND @end
    `),
    // Saldo líquido (contaMov) no período atual
    qCur<{ entradas: number; saidas: number }>(`
      SELECT
        ISNULL(SUM(CASE WHEN ctmSinal='+' THEN ctmValor ELSE 0 END),0) AS entradas,
        ISNULL(SUM(CASE WHEN ctmSinal='-' THEN ABS(ctmValor) ELSE 0 END),0) AS saidas
      FROM contaMov
      WHERE empId=@empId AND ctmTipoMov IN ('CP','CR')
        AND CONVERT(date,ctmData) BETWEEN @start AND @end
    `),
    // Saldo líquido (contaMov) no período anterior — para variação do resultado de caixa
    qPrev<{ entradas: number; saidas: number }>(`
      SELECT
        ISNULL(SUM(CASE WHEN ctmSinal='+' THEN ctmValor ELSE 0 END),0) AS entradas,
        ISNULL(SUM(CASE WHEN ctmSinal='-' THEN ABS(ctmValor) ELSE 0 END),0) AS saidas
      FROM contaMov
      WHERE empId=@empId AND ctmTipoMov IN ('CP','CR')
        AND CONVERT(date,ctmData) BETWEEN @start AND @end
    `),
    // Margem bruta no período
    qCur<{ receita: number; custo: number }>(`
      SELECT
        ISNULL(SUM(vi.vdiQtde*vi.vdiValor),0) AS receita,
        ISNULL(SUM(vi.vdiQtde*vi.vdiProCustoFinal),0) AS custo
      FROM vendaItem vi JOIN venda v ON vi.vdiVedId=v.vedId
      WHERE v.vedStatus='F' AND v.vedTipo IN ('OS','VE') AND v.empId=@empId
        AND vi.vdiProCustoFinal>0
        AND CONVERT(date,v.vedFechamento) BETWEEN @start AND @end
    `),
    // Contas a Receber — títulos não pagos com vencimento no período
    qCur<{ total: number; qtd: number }>(`
      SELECT ISNULL(SUM(pgtValor),0) AS total, COUNT(*) AS qtd
      FROM vendaPgto
      WHERE empId=@empId AND pgtPago IN ('N','F')
        AND CONVERT(date,pgtVecmto) BETWEEN @start AND @end
    `),
    // Contas a Pagar — saídas registradas no contaMov no período
    qCur<{ total: number; qtd: number }>(`
      SELECT ISNULL(SUM(ABS(ctmValor)),0) AS total, COUNT(*) AS qtd
      FROM contaMov
      WHERE empId=@empId AND ctmSinal='-'
        AND CONVERT(date,ctmData) BETWEEN @start AND @end
    `),
    // Inadimplência — vencidos e não pagos (estado atual, sem filtro de período)
    qNow<{ total: number; qtd: number }>(`
      SELECT ISNULL(SUM(pgtValor),0) AS total, COUNT(*) AS qtd
      FROM vendaPgto
      WHERE empId=@empId AND pgtPago IN ('N','F')
        AND CONVERT(date,pgtVecmto) < CONVERT(date,GETDATE())
    `),
    // A vencer nos próximos 7 dias (estado atual)
    qNow<{ total: number; qtd: number }>(`
      SELECT ISNULL(SUM(pgtValor),0) AS total, COUNT(*) AS qtd
      FROM vendaPgto
      WHERE empId=@empId AND pgtPago IN ('N','F')
        AND CONVERT(date,pgtVecmto) >= CONVERT(date,GETDATE())
        AND CONVERT(date,pgtVecmto) <= CONVERT(date,DATEADD(day,7,GETDATE()))
    `),
  ]);

  const fat      = fatRes.status        === "fulfilled" ? (fatRes.value        as { valor: number; qtd: number }[])[0]      : { valor: 0, qtd: 0 };
  const fatPrev  = fatPrevRes.status    === "fulfilled" ? (fatPrevRes.value    as { valor: number }[])[0]                    : { valor: 0 };
  const rec      = recRes.status        === "fulfilled" ? (recRes.value        as { valor: number; qtd: number }[])[0]      : { valor: 0, qtd: 0 };
  const recPrev  = recPrevRes.status    === "fulfilled" ? (recPrevRes.value    as { valor: number }[])[0]                    : { valor: 0 };
  const saldo    = saldoRes.status      === "fulfilled" ? (saldoRes.value      as { entradas: number; saidas: number }[])[0] : { entradas: 0, saidas: 0 };
  const saldoPrv = saldoPrevRes.status  === "fulfilled" ? (saldoPrevRes.value  as { entradas: number; saidas: number }[])[0] : { entradas: 0, saidas: 0 };
  const margem   = margemRes.status     === "fulfilled" ? (margemRes.value     as { receita: number; custo: number }[])[0]   : { receita: 0, custo: 0 };
  const ctaRec   = contasReceberRes.status === "fulfilled" ? (contasReceberRes.value as { total: number; qtd: number }[])[0] : { total: 0, qtd: 0 };
  const ctaPag   = contasPagarRes.status   === "fulfilled" ? (contasPagarRes.value   as { total: number; qtd: number }[])[0] : { total: 0, qtd: 0 };
  const inad     = inadRes.status       === "fulfilled" ? (inadRes.value       as { total: number; qtd: number }[])[0]      : { total: 0, qtd: 0 };
  const aVenc7   = aVencer7Res.status   === "fulfilled" ? (aVencer7Res.value   as { total: number; qtd: number }[])[0]      : { total: 0, qtd: 0 };

  const saldoLiquido    = saldo.entradas - saldo.saidas;
  const saldoPrevLiq    = saldoPrv.entradas - saldoPrv.saidas;
  const varFat          = fatPrev.valor > 0 ? ((fat.valor - fatPrev.valor) / fatPrev.valor) * 100 : null;
  const varRec          = recPrev.valor > 0 ? ((rec.valor - recPrev.valor) / recPrev.valor) * 100 : null;
  const varSaldoLiquido = saldoPrevLiq !== 0 ? ((saldoLiquido - saldoPrevLiq) / Math.abs(saldoPrevLiq)) * 100 : null;
  const margemPct       = margem.receita > 0 ? ((margem.receita - margem.custo) / margem.receita) * 100 : null;
  const ticketMedio     = fat.qtd > 0 ? fat.valor / fat.qtd : 0;

  return NextResponse.json({
    faturamentoMes: fat.valor,
    varFaturamento: varFat,
    qtdVendasMes: fat.qtd,
    ticketMedioMes: ticketMedio,
    recebidoMes: rec.valor,
    varRecebido: varRec,
    qtdRecebimentosMes: rec.qtd,
    saldoLiquidoMes: saldoLiquido,
    varSaldoLiquido,
    entradasMes: saldo.entradas,
    saidasMes: saldo.saidas,
    margemPctMes: margemPct,
    receitaBrutaMes: margem.receita,
    custoBrutoMes: margem.custo,
    contasReceberTotal: ctaRec.total,
    contasReceberQtd: ctaRec.qtd,
    contasPagarTotal: ctaPag.total,
    contasPagarQtd: ctaPag.qtd,
    inadimplenciaTotal: inad.total,
    inadimplenciaQtd: inad.qtd,
    aVencer7Total: aVenc7.total,
    aVencer7Qtd: aVenc7.qtd,
    prevStart,
    prevEnd,
  });
}
