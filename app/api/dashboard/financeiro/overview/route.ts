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
 *  - Recebido/Pago realizado → vendaPgto (pgtPago='S' = quitado, data = pgtDataQuitou,
 *    pgtClienteId IS NOT NULL). Antes usava contaMov.ctmData (data do lançamento em caixa),
 *    mas isso diverge da tela "Contas a Pagar/Receber - Pesquisa" do ERP quando pgtDataQuitou
 *    fica defasada em relação ao lançamento em caixa (ex.: título quitado registrado num dado
 *    migrado com data antiga, mas o lançamento em contaMov só é feito depois).
 *    pgtClienteId IS NOT NULL exclui lançamentos internos sem cliente vinculado (tarifas/estornos
 *    automáticos de portador) que o relatório do ERP também não soma — NÃO usar `pgtValor>0`:
 *    estornos legítimos de um cliente real (nota fiscal cancelada) têm valor negativo mas
 *    pgtClienteId preenchido e CONTAM no relatório. Confirmado batendo no centavo comparando com
 *    exportação real do relatório 105/106 (empId 1, fev/2026): Pagamentos R$40.852,60 (114 regs)
 *    e Recebimentos R$335.089,37 (683 regs).
 *  - A Receber / A Pagar em aberto (KPIs + gráfico Contas em Aberto) → vendaPgto
 *    (pgtTipoConta 'R'|'P', pgtPago='N' = aberto). 'G' foi testado e descartado: são
 *    desdobramentos de outro título (pgtRef aponta pro pai, que pode já estar quitado
 *    ou ainda aberto) — contá-los duplica valor e diverge da tela do ERP.
 *  - Análise por Filial/Plano/Subplano → REALIZADO (mesma regra do Recebido/Pago acima:
 *    pgtPago='S', pgtDataQuitou, pgtClienteId IS NOT NULL), detalhado por plano de contas,
 *    no período selecionado (@start/@end). Equivale à tela "343 - Relatório de Centro de
 *    Custos / Plano de Contas" do ERP — mostra o que já foi recebido/pago, não títulos
 *    em aberto. Diferente da tela do ERP, lançamentos sem plano/subplano classificado
 *    aparecem como "Sem plano de contas"/"Sem subplano" em vez de serem omitidos.
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

    // 1. KPIs de fluxo (vendaPgto quitado, pgtDataQuitou) — atual + anterior, por filial
    q<{ empId: number; recCur: number; pagCur: number; recPrev: number; pagPrev: number }>(`
      SELECT empId,
        ISNULL(SUM(CASE WHEN CONVERT(date,pgtDataQuitou) BETWEEN @start AND @end AND pgtTipoConta='R'
                        THEN pgtValor ELSE 0 END),0) AS recCur,
        ISNULL(SUM(CASE WHEN CONVERT(date,pgtDataQuitou) BETWEEN @start AND @end AND pgtTipoConta='P'
                        THEN pgtValor ELSE 0 END),0) AS pagCur,
        ISNULL(SUM(CASE WHEN CONVERT(date,pgtDataQuitou) BETWEEN @prevStart AND @prevEnd AND pgtTipoConta='R'
                        THEN pgtValor ELSE 0 END),0) AS recPrev,
        ISNULL(SUM(CASE WHEN CONVERT(date,pgtDataQuitou) BETWEEN @prevStart AND @prevEnd AND pgtTipoConta='P'
                        THEN pgtValor ELSE 0 END),0) AS pagPrev
      FROM vendaPgto
      WHERE empId IN (${empList}) AND pgtPago='S' AND pgtTipoConta IN ('R','P') AND pgtClienteId IS NOT NULL
        AND CONVERT(date,pgtDataQuitou) BETWEEN @prevStart AND @end
        AND NOT EXISTS (SELECT 1 FROM subPlanoContas sp WHERE sp.spcId = vendaPgto.pgtSubPc AND sp.spcNaoDemonstrarDRE = 1)
      GROUP BY empId
    `, { start, end, prevStart, prevEnd }),

    // 2. Série mensal (12m) de recebimentos/pagamentos por filial (vendaPgto quitado)
    q<{ mes: string; empId: number; recebimentos: number; pagamentos: number }>(`
      SELECT FORMAT(pgtDataQuitou,'yyyy-MM') AS mes, empId,
        ISNULL(SUM(CASE WHEN pgtTipoConta='R' THEN pgtValor ELSE 0 END),0) AS recebimentos,
        ISNULL(SUM(CASE WHEN pgtTipoConta='P' THEN pgtValor ELSE 0 END),0) AS pagamentos
      FROM vendaPgto
      WHERE empId IN (${empList}) AND pgtPago='S' AND pgtTipoConta IN ('R','P') AND pgtClienteId IS NOT NULL
        AND CONVERT(date,pgtDataQuitou) >= @base12m AND CONVERT(date,pgtDataQuitou) <= @endDate
        AND NOT EXISTS (SELECT 1 FROM subPlanoContas sp WHERE sp.spcId = vendaPgto.pgtSubPc AND sp.spcNaoDemonstrarDRE = 1)
      GROUP BY FORMAT(pgtDataQuitou,'yyyy-MM'), empId
    `, { base12m, endDate: end }),

    // 3. Títulos em aberto por mês de vencimento × filial × tipo (estado atual).
    // Alguns títulos têm pgtVecmto NULO (raro, mas existe): não entram em nenhuma
    // barra do gráfico mensal (não têm mês), mas o valor precisa continuar contando
    // no KPI — por isso caem no "mês" sentinela 'sem-venc' e são tratados como vencido.
    // `hoje` é um recorte adicional dentro de `aVencer` (que mantém >= para não alterar
    // os KPIs A Receber/A Pagar do topo) usado só pelo gráfico Contas em Aberto, que
    // subtrai hoje de aVencer no cliente para separar "vence hoje" de "vence no futuro".
    q<{ mes: string; empId: number; tipo: string; valor: number; vencido: number; hoje: number; aVencer: number }>(`
      SELECT ISNULL(FORMAT(pgtVecmto,'yyyy-MM'), 'sem-venc') AS mes, empId, pgtTipoConta AS tipo,
        ISNULL(SUM(pgtValor),0) AS valor,
        ISNULL(SUM(CASE WHEN pgtVecmto IS NULL OR CONVERT(date,pgtVecmto) < CONVERT(date,GETDATE()) THEN pgtValor ELSE 0 END),0) AS vencido,
        ISNULL(SUM(CASE WHEN pgtVecmto IS NOT NULL AND CONVERT(date,pgtVecmto) = CONVERT(date,GETDATE()) THEN pgtValor ELSE 0 END),0) AS hoje,
        ISNULL(SUM(CASE WHEN pgtVecmto IS NOT NULL AND CONVERT(date,pgtVecmto) >= CONVERT(date,GETDATE()) THEN pgtValor ELSE 0 END),0) AS aVencer
      FROM vendaPgto
      WHERE empId IN (${empList}) AND pgtPago = 'N' AND pgtTipoConta IN ('R','P')
        AND NOT EXISTS (SELECT 1 FROM subPlanoContas sp WHERE sp.spcId = vendaPgto.pgtSubPc AND sp.spcNaoDemonstrarDRE = 1)
      GROUP BY ISNULL(FORMAT(pgtVecmto,'yyyy-MM'), 'sem-venc'), empId, pgtTipoConta
    `),

    // 4. Realizado (recebido/pago) por filial × plano × subplano × tipo, no período
    // selecionado — mesma regra de "Recebido/Pago realizado" (query 1), só que
    // detalhada por plano de contas. Equivalente à tela "343 - Relatório de Centro
    // de Custos / Plano de Contas" do ERP: mostra o que já foi recebido e o que já
    // foi pago no período, não títulos em aberto.
    q<{ empId: number; plcId: number | null; plcDesc: string | null; spcId: number | null; spcDesc: string | null; tipo: string; valor: number }>(`
      SELECT vp.empId, vp.pgtPlcId AS plcId, pc.plcDesc, vp.pgtSubPc AS spcId, sp.spcDesc, vp.pgtTipoConta AS tipo,
        ISNULL(SUM(vp.pgtValor),0) AS valor
      FROM vendaPgto vp
        LEFT JOIN planoConta pc ON vp.pgtPlcId = pc.plcId
        LEFT JOIN subPlanoContas sp ON vp.pgtSubPc = sp.spcId
      WHERE vp.empId IN (${empList}) AND vp.pgtPago = 'S' AND vp.pgtClienteId IS NOT NULL AND vp.pgtTipoConta IN ('R','P')
        AND CONVERT(date,vp.pgtDataQuitou) BETWEEN @start AND @end
        AND ISNULL(sp.spcNaoDemonstrarDRE,0) = 0
      GROUP BY vp.empId, vp.pgtPlcId, pc.plcDesc, vp.pgtSubPc, sp.spcDesc, vp.pgtTipoConta
    `, { start, end }),
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
    .map((r) => ({
      mes: r.mes,
      empId: Number(r.empId),
      tipo: r.tipo as "R" | "P",
      valor: Number(r.valor),
      vencido: Number(r.vencido),
      hoje: Number(r.hoje),
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
