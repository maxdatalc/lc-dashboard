import { NextRequest, NextResponse } from "next/server";
import { getDateRange } from "@/lib/utils/format";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojaDbConfig } from "@/lib/db/tenants";
import { queryBridge, BridgeError } from "@/lib/mssql/client";

export const dynamic = "force-dynamic";

function isDate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }

function calcVariacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

function periodoAnterior(
  period: string,
  currentStart: string,
  currentEnd: string
): { start: string; end: string } {
  const hoje = new Date();
  const toStr = (d: Date) => d.toISOString().split("T")[0];
  const y = hoje.getFullYear();
  const m = hoje.getMonth();

  switch (period) {
    case "today": {
      const ontem = toStr(new Date(hoje.getTime() - 86400000));
      return { start: ontem, end: ontem };
    }
    case "7d":
      return {
        start: toStr(new Date(hoje.getTime() - 13 * 86400000)),
        end: toStr(new Date(hoje.getTime() - 7 * 86400000)),
      };
    case "month": {
      const primAnterior = new Date(y, m - 1, 1);
      const ultimoAnterior = new Date(y, m, 0);
      return { start: toStr(primAnterior), end: toStr(ultimoAnterior) };
    }
    case "3m":
      return {
        start: toStr(new Date(y, m - 6, 1)),
        end: toStr(new Date(y, m - 3, 0)),
      };
    case "year":
      return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` };
    case "prev-year":
      return { start: `${y - 2}-01-01`, end: `${y - 2}-12-31` };
    case "custom": {
      const startMs = new Date(currentStart).getTime();
      const endMs = new Date(currentEnd).getTime();
      const duration = endMs - startMs;
      return {
        start: toStr(new Date(startMs - duration - 86400000)),
        end: toStr(new Date(startMs - 86400000)),
      };
    }
    default:
      return { start: toStr(new Date(y, m - 1, 1)), end: toStr(new Date(y, m, 0)) };
  }
}

interface KpiRow {
  faturamento: number;
  totalVendas: number;
  clientes: number;
  ticketMedio: number;
}

interface CustoRow {
  custo: number;
}

interface DevRow {
  totalDevolucoes: number;
  valorDevolvido: number;
}

function buildSqlKpis(vClause: string, extra = "") {
  return `
  SELECT
    ISNULL(SUM(vedTotalNf), 0)                                                   AS faturamento,
    COUNT(*)                                                                       AS totalVendas,
    COUNT(DISTINCT NULLIF(vedClienteId, 0))                                       AS clientes,
    ISNULL(CASE WHEN COUNT(*) > 0 THEN SUM(vedTotalNf)/COUNT(*) ELSE 0 END, 0)  AS ticketMedio
  FROM venda
  WHERE vedStatus = 'F'
    AND vedTipo IN ('OS','VE')
    AND vedTotalNf > 0
    AND empId = @empId
    AND CONVERT(date, vedFechamento) BETWEEN @start AND @end
    ${vClause}${extra}`;
}

function buildSqlCusto(vClause: string, extra = "") {
  return `
  SELECT ISNULL(SUM(vi.vdiQtde * vi.vdiProCustoFinal), 0) AS custo
  FROM vendaItem vi
  JOIN venda v ON vi.vdiVedId = v.vedId
  WHERE v.vedStatus = 'F'
    AND v.vedTipo IN ('OS','VE')
    AND v.vedTotalNf > 0
    AND v.empId = @empId
    AND vi.vdiCancel = 0
    AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
    ${vClause}${extra}`;
}

function buildSqlDev(vClause: string, extra = "") {
  return `
  SELECT
    COUNT(*)                       AS totalDevolucoes,
    ISNULL(SUM(vedTotalNf), 0)    AS valorDevolvido
  FROM venda
  WHERE vedStatus = 'F'
    AND vedTipo = 'DV'
    AND vedTotalNf > 0
    AND empId = @empId
    AND CONVERT(date, vedFechamento) BETWEEN @start AND @end
    ${vClause}${extra}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const lojaIdsParam = searchParams.get("lojaIds");
  const lojaId = searchParams.get("lojaId");
  const period = searchParams.get("period") ?? "month";
  const vendedorIdRaw = searchParams.get("vendedorId");
  const vendedorId = vendedorIdRaw ? parseInt(vendedorIdRaw) : null;
  const vendedorClause  = vendedorId ? "AND vedAtendente = @vendedorId" : "";
  const vendedorClauseJ = vendedorId ? "AND v.vedAtendente = @vendedorId" : "";

  const clienteNomeRaw = searchParams.get("clienteNome");
  const produtoNomeRaw = searchParams.get("produtoNome");
  const cClause  = clienteNomeRaw ? "AND vedClienteId IN (SELECT cliId FROM cliente WHERE cliNome = @clienteNome AND empId = @empId)" : "";
  const cClauseJ = clienteNomeRaw ? "AND v.vedClienteId IN (SELECT cliId FROM cliente WHERE cliNome = @clienteNome AND empId = @empId)" : "";
  const pClause  = produtoNomeRaw ? "AND vedId IN (SELECT vdiVedId FROM vendaItem WHERE vdiProNome = @produtoNome AND vdiCancel = 0)" : "";
  const pClauseJ = produtoNomeRaw ? "AND v.vedId IN (SELECT vdiVedId FROM vendaItem WHERE vdiProNome = @produtoNome AND vdiCancel = 0)" : "";
  const cp = {
    ...(clienteNomeRaw ? { clienteNome: clienteNomeRaw } : {}),
    ...(produtoNomeRaw ? { produtoNome: produtoNomeRaw } : {}),
  };

  const lojaIds = lojaIdsParam
    ? lojaIdsParam.split(",").filter(Boolean)
    : lojaId
    ? [lojaId]
    : [];

  if (lojaIds.length === 0) {
    return NextResponse.json(
      { error: "lojaId ou lojaIds é obrigatório" },
      { status: 400 }
    );
  }

  const guard = await requireTenantAccess(lojaIds);
  if (guard instanceof NextResponse) return guard;

  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  if (startParam && endParam && (!isDate(startParam) || !isDate(endParam))) {
    return NextResponse.json({ error: "start e end devem ser YYYY-MM-DD" }, { status: 400 });
  }
  const { start, end } =
    startParam && endParam
      ? { start: startParam, end: endParam }
      : getDateRange(period);

  const anterior = periodoAnterior(period, start, end);

  let faturamento = 0;
  let totalVendas = 0;
  let clientes = 0;
  let custo = 0;
  let totalDevolucoes = 0;
  let valorDevolvido = 0;
  let faturamentoAnt = 0;
  let totalVendasAnt = 0;
  let custoAnt = 0;

  let bridgeFound = false;
  let lastError = "";

  for (const id of lojaIds) {
    const config = await getLojaDbConfig(id).catch(() => null);
    if (!config) continue;

    bridgeFound = true;

    try {
      const vp = vendedorId ? { vendedorId } : {};
      const ep = { empId: config.empId };
      const SQL_KPIS = buildSqlKpis(vendedorClause, `${cClause}${pClause}`);
      const SQL_CUSTO = buildSqlCusto(vendedorClauseJ, `${cClauseJ}${pClauseJ}`);
      const SQL_DEV   = buildSqlDev(vendedorClause, `${cClause}${pClause}`);

      const [atual, ant, custoAtual, custoAnterior, dev] = await Promise.all([
        queryBridge<KpiRow>(config, SQL_KPIS, { start, end, ...ep, ...vp, ...cp }),
        queryBridge<KpiRow>(config, SQL_KPIS, { start: anterior.start, end: anterior.end, ...ep, ...vp, ...cp }),
        queryBridge<CustoRow>(config, SQL_CUSTO, { start, end, ...ep, ...vp, ...cp }),
        queryBridge<CustoRow>(config, SQL_CUSTO, { start: anterior.start, end: anterior.end, ...ep, ...vp, ...cp }),
        queryBridge<DevRow>(config, SQL_DEV, { start, end, ...ep, ...vp, ...cp }),
      ]);

      faturamento     += Number(atual[0]?.faturamento        ?? 0);
      totalVendas     += Number(atual[0]?.totalVendas        ?? 0);
      clientes        += Number(atual[0]?.clientes           ?? 0);
      custo           += Number(custoAtual[0]?.custo         ?? 0);
      totalDevolucoes += Number(dev[0]?.totalDevolucoes      ?? 0);
      valorDevolvido  += Number(dev[0]?.valorDevolvido       ?? 0);
      faturamentoAnt  += Number(ant[0]?.faturamento          ?? 0);
      totalVendasAnt  += Number(ant[0]?.totalVendas          ?? 0);
      custoAnt        += Number(custoAnterior[0]?.custo      ?? 0);
    } catch (e) {
      lastError = e instanceof BridgeError ? e.message : String(e instanceof Error ? e.message : e);
      console.error(`[kpis] bridge error loja ${id}:`, lastError);
    }
  }

  if (!bridgeFound) {
    return NextResponse.json(
      { error: "Bridge SQL não configurada para esta loja. Acesse Admin → Empresas → Lojas → Bridge." },
      { status: 503 }
    );
  }

  if (lastError && faturamento === 0 && totalVendas === 0) {
    return NextResponse.json({ error: lastError }, { status: 500 });
  }

  const ticketMedio    = totalVendas > 0 ? faturamento / totalVendas : 0;
  const ticketMedioAnt = totalVendasAnt > 0 ? faturamentoAnt / totalVendasAnt : 0;
  const lucro          = faturamento - custo;
  const lucroAnt       = faturamentoAnt - custoAnt;
  const margem         = faturamento > 0 ? (lucro / faturamento) * 100 : 0;

  return NextResponse.json({
    faturamento: {
      value: faturamento,
      change: calcVariacao(faturamento, faturamentoAnt),
      vendaTotal: faturamento,
      devolucaoTotal: valorDevolvido,
      totalVendas,
      totalDevolucoes,
    },
    custo:  { value: custo,  change: calcVariacao(custo, custoAnt) },
    lucro:  { value: lucro,  change: calcVariacao(lucro, lucroAnt), margem },
    clientes:   { value: clientes },
    vendas: {
      value: totalVendas,
      change: calcVariacao(totalVendas, totalVendasAnt),
    },
    ticketMedio: {
      value: ticketMedio,
      change: calcVariacao(ticketMedio, ticketMedioAnt),
    },
    outros: { value: 0, valorTotal: 0 },
    totalVendas,
    totalDevolucoes,
    totalCancelamentos: 0,
    valorDevolvido,
  });
}
