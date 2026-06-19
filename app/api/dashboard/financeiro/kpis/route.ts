import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojaDbConfig } from "@/lib/db/tenants";
import { queryBridge } from "@/lib/mssql/client";

export const dynamic = "force-dynamic";

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

  const cfg = await getConfig(lojaIds);
  if (!cfg) return NextResponse.json({ error: "Bridge não configurada" }, { status: 404 });

  const { bridgeUrl, token, empId } = cfg;
  const q = (sql: string) => queryBridge({ bridgeUrl, token }, sql, { empId });

  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;
  const anoAnt = mes === 1 ? ano - 1 : ano;
  const mesAnt = mes === 1 ? 12 : mes - 1;

  const [
    fatMesRes,
    fatMesAntRes,
    recMesRes,
    recMesAntRes,
    inadRes,
    aVencer30Res,
    saldoMesRes,
    margemMesRes,
  ] = await Promise.allSettled([
    // Faturamento mês atual
    q(`
      SELECT ISNULL(SUM(vedTotalNf),0) AS valor, COUNT(*) AS qtd
      FROM venda
      WHERE vedStatus='F' AND vedTipo IN ('OS','VE') AND vedTotalNf>0 AND empId=@empId
        AND YEAR(vedFechamento)=${ano} AND MONTH(vedFechamento)=${mes}
    `),
    // Faturamento mês anterior
    q(`
      SELECT ISNULL(SUM(vedTotalNf),0) AS valor
      FROM venda
      WHERE vedStatus='F' AND vedTipo IN ('OS','VE') AND vedTotalNf>0 AND empId=@empId
        AND YEAR(vedFechamento)=${anoAnt} AND MONTH(vedFechamento)=${mesAnt}
    `),
    // Recebimentos mês atual
    q(`
      SELECT ISNULL(SUM(pgtValor),0) AS valor, COUNT(*) AS qtd
      FROM vendaPgto
      WHERE pgtPago='S' AND empId=@empId AND pgtDataQuitou IS NOT NULL
        AND YEAR(pgtDataQuitou)=${ano} AND MONTH(pgtDataQuitou)=${mes}
    `),
    // Recebimentos mês anterior
    q(`
      SELECT ISNULL(SUM(pgtValor),0) AS valor
      FROM vendaPgto
      WHERE pgtPago='S' AND empId=@empId AND pgtDataQuitou IS NOT NULL
        AND YEAR(pgtDataQuitou)=${anoAnt} AND MONTH(pgtDataQuitou)=${mesAnt}
    `),
    // Inadimplência total
    q(`
      SELECT ISNULL(SUM(pgtValor),0) AS total, COUNT(DISTINCT pgtCliNome) AS qtd_clientes, COUNT(*) AS qtd_titulos
      FROM vendaPgto
      WHERE empId=@empId AND pgtPago IN ('N','F') AND pgtVecmto < CONVERT(date,GETDATE())
    `),
    // A vencer em 30 dias
    q(`
      SELECT ISNULL(SUM(pgtValor),0) AS total, COUNT(*) AS qtd
      FROM vendaPgto
      WHERE empId=@empId AND pgtPago IN ('N','F')
        AND pgtVecmto >= CONVERT(date,GETDATE())
        AND pgtVecmto <= CONVERT(date,DATEADD(day,30,GETDATE()))
    `),
    // Saldo líquido do mês (contaMov)
    q(`
      SELECT
        ISNULL(SUM(CASE WHEN ctmSinal='+' THEN ctmValor ELSE 0 END),0) AS entradas,
        ISNULL(SUM(CASE WHEN ctmSinal='-' THEN ABS(ctmValor) ELSE 0 END),0) AS saidas
      FROM contaMov
      WHERE empId=@empId AND ctmTipoMov IN ('CP','CR')
        AND YEAR(ctmData)=${ano} AND MONTH(ctmData)=${mes}
    `),
    // Margem mês atual
    q(`
      SELECT
        ISNULL(SUM(vi.vdiQtde*vi.vdiValor),0) AS receita,
        ISNULL(SUM(vi.vdiQtde*vi.vdiProCustoFinal),0) AS custo
      FROM vendaItem vi JOIN venda v ON vi.vdiVedId=v.vedId
      WHERE v.vedStatus='F' AND v.vedTipo IN ('OS','VE') AND v.empId=@empId
        AND vi.vdiProCustoFinal>0
        AND YEAR(v.vedFechamento)=${ano} AND MONTH(v.vedFechamento)=${mes}
    `),
  ]);

  const fatMes   = fatMesRes.status   === "fulfilled" ? (fatMesRes.value   as { valor: number; qtd: number }[])[0]   : { valor: 0, qtd: 0 };
  const fatAnt   = fatMesAntRes.status === "fulfilled" ? (fatMesAntRes.value as { valor: number }[])[0]               : { valor: 0 };
  const recMes   = recMesRes.status   === "fulfilled" ? (recMesRes.value   as { valor: number; qtd: number }[])[0]   : { valor: 0, qtd: 0 };
  const recAnt   = recMesAntRes.status === "fulfilled" ? (recMesAntRes.value as { valor: number }[])[0]               : { valor: 0 };
  const inad     = inadRes.status     === "fulfilled" ? (inadRes.value     as { total: number; qtd_clientes: number; qtd_titulos: number }[])[0] : { total: 0, qtd_clientes: 0, qtd_titulos: 0 };
  const aVencer  = aVencer30Res.status === "fulfilled" ? (aVencer30Res.value as { total: number; qtd: number }[])[0]  : { total: 0, qtd: 0 };
  const saldo    = saldoMesRes.status  === "fulfilled" ? (saldoMesRes.value  as { entradas: number; saidas: number }[])[0] : { entradas: 0, saidas: 0 };
  const margem   = margemMesRes.status === "fulfilled" ? (margemMesRes.value as { receita: number; custo: number }[])[0]   : { receita: 0, custo: 0 };

  const varFat = fatAnt.valor > 0 ? ((fatMes.valor - fatAnt.valor) / fatAnt.valor) * 100 : null;
  const varRec = recAnt.valor > 0 ? ((recMes.valor - recAnt.valor) / recAnt.valor) * 100 : null;
  const saldoLiquido = saldo.entradas - saldo.saidas;
  const margemPct = margem.receita > 0 ? ((margem.receita - margem.custo) / margem.receita) * 100 : null;
  const ticketMedio = (fatMes.qtd ?? 0) > 0 ? fatMes.valor / (fatMes.qtd ?? 1) : 0;

  return NextResponse.json({
    faturamentoMes: fatMes.valor,
    varFaturamento: varFat,
    qtdVendasMes: fatMes.qtd,
    ticketMedioMes: ticketMedio,
    recebidoMes: recMes.valor,
    varRecebido: varRec,
    inadimplenciaTotal: inad.total,
    inadimplenciaClientes: inad.qtd_clientes,
    inadimplenciaTitulos: inad.qtd_titulos,
    aVencer30Total: aVencer.total,
    aVencer30Qtd: aVencer.qtd,
    saldoLiquidoMes: saldoLiquido,
    entradasMes: saldo.entradas,
    saidasMes: saldo.saidas,
    margemPctMes: margemPct,
    receitaBrutaMes: margem.receita,
    custoBrutoMes: margem.custo,
  });
}
