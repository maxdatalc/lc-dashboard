import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojaDbConfig } from "@/lib/db/tenants";
import { queryBridge } from "@/lib/mssql/client";

export const dynamic = "force-dynamic";

function isDate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
function toStr(d: Date)    { return d.toISOString().split("T")[0]; }

async function getConfig(lojaIds: string[]) {
  for (const id of lojaIds) {
    const cfg = await getLojaDbConfig(id);
    if (cfg) return cfg;
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lojaIds = (searchParams.get("lojaIds") ?? "").split(",").filter(Boolean);
  if (lojaIds.length === 0) return NextResponse.json({ error: "lojaIds obrigatório" }, { status: 400 });

  const auth = await requireTenantAccess(lojaIds);
  if (auth instanceof NextResponse) return auth;

  const start = searchParams.get("start") ?? "";
  const end   = searchParams.get("end")   ?? "";
  if (!isDate(start) || !isDate(end)) {
    return NextResponse.json({ error: "start e end obrigatórios (YYYY-MM-DD)" }, { status: 400 });
  }

  const cfg = await getConfig(lojaIds);
  if (!cfg) return NextResponse.json({ error: "Bridge não configurada" }, { status: 404 });

  const { bridgeUrl, token, empId } = cfg;

  // Período anterior com mesma duração
  const startMs    = new Date(start + "T12:00:00").getTime();
  const endMs      = new Date(end   + "T12:00:00").getTime();
  const prevEndDate    = new Date(startMs - 86400000);
  const prevStartDate  = new Date(prevEndDate.getTime() - (endMs - startMs));
  const prevStart = toStr(prevStartDate);
  const prevEnd   = toStr(prevEndDate);

  const q = <T>(sql: string, params: Record<string, unknown>) =>
    queryBridge<T>({ bridgeUrl, token }, sql, params);

  // 6 queries paralelas (eram 11 antes da otimização)
  const [
    fatComboRes,
    recComboRes,
    saldoComboRes,
    contasReceberRes,
    contasPagarRes,
    riscoComboRes,
  ] = await Promise.allSettled([

    // 1. Faturamento atual + anterior em uma única varredura
    q<{ valorCur: number; qtdCur: number; valorPrev: number }>(`
      SELECT
        ISNULL(SUM(CASE WHEN CONVERT(date,vedFechamento) BETWEEN @start AND @end
                        THEN vedTotalNf ELSE 0 END),0) AS valorCur,
        SUM(CASE WHEN CONVERT(date,vedFechamento) BETWEEN @start AND @end
                 THEN 1 ELSE 0 END) AS qtdCur,
        ISNULL(SUM(CASE WHEN CONVERT(date,vedFechamento) BETWEEN @prevStart AND @prevEnd
                        THEN vedTotalNf ELSE 0 END),0) AS valorPrev
      FROM venda
      WHERE vedStatus='F' AND vedTipo IN ('OS','VE') AND vedTotalNf>0 AND empId=@empId
        AND CONVERT(date,vedFechamento) BETWEEN @prevStart AND @end
    `, { empId, start, end, prevStart, prevEnd }),

    // 2. Recebimentos atual + anterior em uma única varredura
    q<{ valorCur: number; qtdCur: number; valorPrev: number }>(`
      SELECT
        ISNULL(SUM(CASE WHEN CONVERT(date,pgtDataQuitou) BETWEEN @start AND @end
                        THEN pgtValor ELSE 0 END),0) AS valorCur,
        SUM(CASE WHEN CONVERT(date,pgtDataQuitou) BETWEEN @start AND @end
                 THEN 1 ELSE 0 END) AS qtdCur,
        ISNULL(SUM(CASE WHEN CONVERT(date,pgtDataQuitou) BETWEEN @prevStart AND @prevEnd
                        THEN pgtValor ELSE 0 END),0) AS valorPrev
      FROM vendaPgto
      WHERE pgtPago='S' AND empId=@empId AND pgtDataQuitou IS NOT NULL
        AND CONVERT(date,pgtDataQuitou) BETWEEN @prevStart AND @end
    `, { empId, start, end, prevStart, prevEnd }),

    // 3. Saldo contaMov atual + anterior em uma única varredura
    q<{ entradasCur: number; saidasCur: number; entradasPrev: number; saidasPrev: number }>(`
      SELECT
        ISNULL(SUM(CASE WHEN CONVERT(date,ctmData) BETWEEN @start AND @end AND ctmSinal='+'
                        THEN ctmValor ELSE 0 END),0) AS entradasCur,
        ISNULL(SUM(CASE WHEN CONVERT(date,ctmData) BETWEEN @start AND @end AND ctmSinal='-'
                        THEN ABS(ctmValor) ELSE 0 END),0) AS saidasCur,
        ISNULL(SUM(CASE WHEN CONVERT(date,ctmData) BETWEEN @prevStart AND @prevEnd AND ctmSinal='+'
                        THEN ctmValor ELSE 0 END),0) AS entradasPrev,
        ISNULL(SUM(CASE WHEN CONVERT(date,ctmData) BETWEEN @prevStart AND @prevEnd AND ctmSinal='-'
                        THEN ABS(ctmValor) ELSE 0 END),0) AS saidasPrev
      FROM contaMov
      WHERE empId=@empId AND ctmTipoMov IN ('CP','CR')
        AND CONVERT(date,ctmData) BETWEEN @prevStart AND @end
    `, { empId, start, end, prevStart, prevEnd }),

    // 4. Contas a Receber: títulos não pagos com vencimento no período
    q<{ total: number; qtd: number }>(`
      SELECT ISNULL(SUM(pgtValor),0) AS total, COUNT(*) AS qtd
      FROM vendaPgto
      WHERE empId=@empId AND pgtPago IN ('N','F')
        AND CONVERT(date,pgtVecmto) BETWEEN @start AND @end
    `, { empId, start, end }),

    // 5. Contas a Pagar: saídas contaMov no período
    q<{ total: number; qtd: number }>(`
      SELECT ISNULL(SUM(ABS(ctmValor)),0) AS total, COUNT(*) AS qtd
      FROM contaMov
      WHERE empId=@empId AND ctmSinal='-'
        AND CONVERT(date,ctmData) BETWEEN @start AND @end
    `, { empId, start, end }),

    // 6. Risco: inadimplência + a vencer 7 dias em uma única varredura (estado atual)
    q<{ inadTotal: number; inadQtd: number; aVencer7Total: number; aVencer7Qtd: number }>(`
      SELECT
        ISNULL(SUM(CASE WHEN CONVERT(date,pgtVecmto) < CONVERT(date,GETDATE())
                        THEN pgtValor ELSE 0 END),0) AS inadTotal,
        SUM(CASE WHEN CONVERT(date,pgtVecmto) < CONVERT(date,GETDATE())
                 THEN 1 ELSE 0 END) AS inadQtd,
        ISNULL(SUM(CASE WHEN CONVERT(date,pgtVecmto) >= CONVERT(date,GETDATE())
                          AND CONVERT(date,pgtVecmto) <= CONVERT(date,DATEADD(day,7,GETDATE()))
                        THEN pgtValor ELSE 0 END),0) AS aVencer7Total,
        SUM(CASE WHEN CONVERT(date,pgtVecmto) >= CONVERT(date,GETDATE())
                   AND CONVERT(date,pgtVecmto) <= CONVERT(date,DATEADD(day,7,GETDATE()))
                 THEN 1 ELSE 0 END) AS aVencer7Qtd
      FROM vendaPgto
      WHERE empId=@empId AND pgtPago IN ('N','F')
    `, { empId }),
  ]);

  // Extração de resultados com fallback
  const fatC  = fatComboRes.status   === "fulfilled" ? (fatComboRes.value   as { valorCur: number; qtdCur: number; valorPrev: number }[])[0]                                                    : { valorCur: 0, qtdCur: 0, valorPrev: 0 };
  const recC  = recComboRes.status   === "fulfilled" ? (recComboRes.value   as { valorCur: number; qtdCur: number; valorPrev: number }[])[0]                                                    : { valorCur: 0, qtdCur: 0, valorPrev: 0 };
  const salC  = saldoComboRes.status === "fulfilled" ? (saldoComboRes.value as { entradasCur: number; saidasCur: number; entradasPrev: number; saidasPrev: number }[])[0]                       : { entradasCur: 0, saidasCur: 0, entradasPrev: 0, saidasPrev: 0 };
  const ctaR  = contasReceberRes.status === "fulfilled" ? (contasReceberRes.value as { total: number; qtd: number }[])[0]                                                                       : { total: 0, qtd: 0 };
  const ctaP  = contasPagarRes.status   === "fulfilled" ? (contasPagarRes.value   as { total: number; qtd: number }[])[0]                                                                       : { total: 0, qtd: 0 };
  const risco = riscoComboRes.status === "fulfilled" ? (riscoComboRes.value as { inadTotal: number; inadQtd: number; aVencer7Total: number; aVencer7Qtd: number }[])[0]                         : { inadTotal: 0, inadQtd: 0, aVencer7Total: 0, aVencer7Qtd: 0 };

  const saldoLiquido    = salC.entradasCur - salC.saidasCur;
  const saldoPrevLiq    = salC.entradasPrev - salC.saidasPrev;
  const varFat          = fatC.valorPrev  > 0 ? ((fatC.valorCur  - fatC.valorPrev)  / fatC.valorPrev)             * 100 : null;
  const varRec          = recC.valorPrev  > 0 ? ((recC.valorCur  - recC.valorPrev)  / recC.valorPrev)             * 100 : null;
  const varSaldoLiquido = saldoPrevLiq   !== 0 ? ((saldoLiquido   - saldoPrevLiq)    / Math.abs(saldoPrevLiq))     * 100 : null;
  const ticketMedio     = fatC.qtdCur     > 0 ?   fatC.valorCur  / fatC.qtdCur                                          : 0;

  return NextResponse.json({
    faturamentoMes:    fatC.valorCur,
    varFaturamento:    varFat,
    qtdVendasMes:      fatC.qtdCur,
    ticketMedioMes:    ticketMedio,
    recebidoMes:       recC.valorCur,
    varRecebido:       varRec,
    qtdRecebimentosMes:recC.qtdCur,
    saldoLiquidoMes:   saldoLiquido,
    varSaldoLiquido,
    entradasMes:       salC.entradasCur,
    saidasMes:         salC.saidasCur,
    contasReceberTotal:ctaR.total,
    contasReceberQtd:  ctaR.qtd,
    contasPagarTotal:  ctaP.total,
    contasPagarQtd:    ctaP.qtd,
    inadimplenciaTotal:risco.inadTotal,
    inadimplenciaQtd:  risco.inadQtd,
    aVencer7Total:     risco.aVencer7Total,
    aVencer7Qtd:       risco.aVencer7Qtd,
    prevStart,
    prevEnd,
  });
}
