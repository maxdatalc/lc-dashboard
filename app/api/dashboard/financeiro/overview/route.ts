import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojasBridge } from "@/lib/db/tenants";
import { queryBridge } from "@/lib/mssql/client";

export const dynamic = "force-dynamic";

function isDate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
function toStr(d: Date)    { return d.toISOString().split("T")[0]; }

/**
 * Endpoint consolidado do Dashboard Financeiro.
 * Uma única chamada retorna tudo que a tela precisa, com dimensões granulares
 * (mês × filial × plano × conta) para permitir cross-filtering client-side.
 *
 * Fontes de dados no MaxManager:
 *  - Recebido/Pago realizado → contaMov (ledger de caixa, ctmValor já com sinal)
 *  - A Receber / A Pagar em aberto → vendaPgto (pgtTipoConta 'R'|'P', pgtPago IN 'N','G' = não quitado)
 *  - Plano de contas → planoConta (contaMov.ctmPlaCont / vendaPgto.pgtPlcId)
 *
 * Regra DRE: exclui títulos/movimentos cujo subplano (subPlanoContas via pgtSubPc/ctmSubPc)
 * esteja marcado spcNaoDemonstrarDRE=1 — são créditos e afins que não entram nos resultados.
 */
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

  const cfg = await getLojasBridge(lojaIds);
  if (!cfg) return NextResponse.json({ error: "Bridge não configurada" }, { status: 404 });

  const { bridgeUrl, token, empresas } = cfg;

  // Lista de empIds sanitizada (inteiros de fonte própria — seguro inlinar no SQL)
  const empIds = empresas.map((e) => e.empId).filter(Number.isFinite);
  if (empIds.length === 0) return NextResponse.json({ error: "Sem filiais válidas" }, { status: 404 });
  const empList = empIds.join(",");

  // Período anterior (mesma duração) para variação dos KPIs de fluxo
  const startMs   = new Date(start + "T12:00:00").getTime();
  const endMs     = new Date(end   + "T12:00:00").getTime();
  const prevEnd   = toStr(new Date(startMs - 86400000));
  const prevStart = toStr(new Date(startMs - 86400000 - (endMs - startMs)));

  // Janela de 12 meses terminando em `end` para as séries mensais
  const endDate      = new Date(end + "T12:00:00");
  const base12mDate  = new Date(endDate);
  base12mDate.setMonth(base12mDate.getMonth() - 11);
  base12mDate.setDate(1);
  const base12m = toStr(base12mDate);

  const q = <T>(sql: string, params?: Record<string, unknown>) =>
    queryBridge<T>({ bridgeUrl, token }, sql, params);

  const [
    flowKpisRes,   // KPIs de fluxo por filial (período atual + anterior)
    fluxoRes,      // série mensal de recebimentos/pagamentos por filial (12m)
    abertosRes,    // títulos em aberto por mês de vencimento × filial × tipo
    analiseRes,    // aberto por filial × plano × subplano × tipo (R/P)
  ] = await Promise.allSettled([

    // 1. KPIs de fluxo (contaMov CR/CP) — atual + anterior, por filial
    q<{ empId: number; recCur: number; pagCur: number; recPrev: number; pagPrev: number }>(`
      SELECT empId,
        ISNULL(SUM(CASE WHEN CONVERT(date,ctmData) BETWEEN @start AND @end AND ctmSinal='+'
                        THEN ctmValor ELSE 0 END),0) AS recCur,
        ISNULL(SUM(CASE WHEN CONVERT(date,ctmData) BETWEEN @start AND @end AND ctmSinal='-'
                        THEN ABS(ctmValor) ELSE 0 END),0) AS pagCur,
        ISNULL(SUM(CASE WHEN CONVERT(date,ctmData) BETWEEN @prevStart AND @prevEnd AND ctmSinal='+'
                        THEN ctmValor ELSE 0 END),0) AS recPrev,
        ISNULL(SUM(CASE WHEN CONVERT(date,ctmData) BETWEEN @prevStart AND @prevEnd AND ctmSinal='-'
                        THEN ABS(ctmValor) ELSE 0 END),0) AS pagPrev
      FROM contaMov
      WHERE empId IN (${empList}) AND ctmAtivo=0 AND ctmTipoMov IN ('CP','CR')
        AND CONVERT(date,ctmData) BETWEEN @prevStart AND @end
        AND NOT EXISTS (SELECT 1 FROM subPlanoContas sp WHERE sp.spcId = contaMov.ctmSubPc AND sp.spcNaoDemonstrarDRE = 1)
      GROUP BY empId
    `, { start, end, prevStart, prevEnd }),

    // 2. Série mensal (12m) de recebimentos/pagamentos por filial
    q<{ mes: string; empId: number; recebimentos: number; pagamentos: number }>(`
      SELECT FORMAT(ctmData,'yyyy-MM') AS mes, empId,
        ISNULL(SUM(CASE WHEN ctmSinal='+' THEN ctmValor ELSE 0 END),0) AS recebimentos,
        ISNULL(SUM(CASE WHEN ctmSinal='-' THEN ABS(ctmValor) ELSE 0 END),0) AS pagamentos
      FROM contaMov
      WHERE empId IN (${empList}) AND ctmAtivo=0 AND ctmTipoMov IN ('CP','CR')
        AND CONVERT(date,ctmData) >= @base12m AND CONVERT(date,ctmData) <= @endDate
        AND NOT EXISTS (SELECT 1 FROM subPlanoContas sp WHERE sp.spcId = contaMov.ctmSubPc AND sp.spcNaoDemonstrarDRE = 1)
      GROUP BY FORMAT(ctmData,'yyyy-MM'), empId
    `, { base12m, endDate: end }),

    // 3. Títulos em aberto por mês de vencimento × filial × tipo (estado atual)
    q<{ mes: string; empId: number; tipo: string; valor: number; vencido: number; aVencer: number }>(`
      SELECT FORMAT(pgtVecmto,'yyyy-MM') AS mes, empId, pgtTipoConta AS tipo,
        ISNULL(SUM(pgtValor),0) AS valor,
        ISNULL(SUM(CASE WHEN CONVERT(date,pgtVecmto) <  CONVERT(date,GETDATE()) THEN pgtValor ELSE 0 END),0) AS vencido,
        ISNULL(SUM(CASE WHEN CONVERT(date,pgtVecmto) >= CONVERT(date,GETDATE()) THEN pgtValor ELSE 0 END),0) AS aVencer
      FROM vendaPgto
      WHERE empId IN (${empList}) AND pgtPago IN ('N','G') AND pgtTipoConta IN ('R','P')
        AND pgtVecmto IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM subPlanoContas sp WHERE sp.spcId = vendaPgto.pgtSubPc AND sp.spcNaoDemonstrarDRE = 1)
      GROUP BY FORMAT(pgtVecmto,'yyyy-MM'), empId, pgtTipoConta
    `),

    // 4. Aberto por filial × plano × subplano × tipo (para tabela A Receber / A Pagar)
    q<{ empId: number; plcId: number | null; plcDesc: string | null; spcId: number | null; spcDesc: string | null; tipo: string; valor: number; vencido: number; aVencer: number }>(`
      SELECT vp.empId, vp.pgtPlcId AS plcId, pc.plcDesc, vp.pgtSubPc AS spcId, sp.spcDesc, vp.pgtTipoConta AS tipo,
        ISNULL(SUM(vp.pgtValor),0) AS valor,
        ISNULL(SUM(CASE WHEN CONVERT(date,vp.pgtVecmto) <  CONVERT(date,GETDATE()) THEN vp.pgtValor ELSE 0 END),0) AS vencido,
        ISNULL(SUM(CASE WHEN CONVERT(date,vp.pgtVecmto) >= CONVERT(date,GETDATE()) THEN vp.pgtValor ELSE 0 END),0) AS aVencer
      FROM vendaPgto vp
        LEFT JOIN planoConta pc ON vp.pgtPlcId = pc.plcId
        LEFT JOIN subPlanoContas sp ON vp.pgtSubPc = sp.spcId
      WHERE vp.empId IN (${empList}) AND vp.pgtPago IN ('N','G') AND vp.pgtTipoConta IN ('R','P')
        AND ISNULL(sp.spcNaoDemonstrarDRE,0) = 0
      GROUP BY vp.empId, vp.pgtPlcId, pc.plcDesc, vp.pgtSubPc, sp.spcDesc, vp.pgtTipoConta
    `),
  ]);

  const val = <T>(r: PromiseSettledResult<T[]>): T[] => (r.status === "fulfilled" ? r.value : []);

  const flowKpis = val(flowKpisRes).map((r) => ({
    empId: Number(r.empId),
    recebimentos: Number(r.recCur),
    pagamentos: Number(r.pagCur),
    recebimentosPrev: Number(r.recPrev),
    pagamentosPrev: Number(r.pagPrev),
  }));

  const fluxo = val(fluxoRes).map((r) => ({
    mes: r.mes,
    empId: Number(r.empId),
    recebimentos: Number(r.recebimentos),
    pagamentos: Number(r.pagamentos),
  }));

  const abertos = val(abertosRes)
    .filter((r) => r.mes) // ignora vencimentos nulos remanescentes
    .map((r) => ({
      mes: r.mes,
      empId: Number(r.empId),
      tipo: r.tipo as "R" | "P",
      valor: Number(r.valor),
      vencido: Number(r.vencido),
      aVencer: Number(r.aVencer),
    }));

  const analise = val(analiseRes).map((r) => ({
    empId: Number(r.empId),
    plcId: r.plcId == null ? null : Number(r.plcId),
    plcDesc: r.plcDesc ?? "Sem plano de contas",
    spcId: r.spcId == null ? null : Number(r.spcId),
    spcDesc: r.spcDesc ?? "Sem subplano",
    tipo: r.tipo as "R" | "P",
    valor: Number(r.valor),
    vencido: Number(r.vencido),
    aVencer: Number(r.aVencer),
  }));

  // Mês base (12m) — lista completa para preencher lacunas no cliente
  const meses: string[] = [];
  const cursor = new Date(base12mDate);
  while (cursor <= endDate) {
    meses.push(cursor.toISOString().slice(0, 7));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return NextResponse.json({
    filiais: empresas,
    meses,
    periodo: { start, end, prevStart, prevEnd },
    flowKpis,
    fluxo,
    abertos,
    analise,
  });
}
