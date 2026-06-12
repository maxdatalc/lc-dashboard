import { NextRequest, NextResponse } from "next/server";
import { getDateRange } from "@/lib/utils/format";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojaDbConfig } from "@/lib/db/tenants";
import { queryBridge, BridgeError } from "@/lib/mssql/client";

export const dynamic = "force-dynamic";

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

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const lojaIdsParam = searchParams.get("lojaIds");
  const lojaId = searchParams.get("lojaId");
  const period = searchParams.get("period") ?? "month";

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
  const { start, end } =
    startParam && endParam
      ? { start: startParam, end: endParam }
      : getDateRange(period);

  const anterior = periodoAnterior(period, start, end);

  // Acumula KPIs de cada loja com bridge configurada
  let faturamento = 0;
  let totalVendas = 0;
  let clientes = 0;
  let faturamentoAnt = 0;
  let totalVendasAnt = 0;

  const SQL_KPIS = `
    SELECT
      ISNULL(SUM(vedTotalNf), 0)                                                   AS faturamento,
      COUNT(*)                                                                       AS totalVendas,
      COUNT(DISTINCT NULLIF(vedClienteId, 0))                                       AS clientes,
      ISNULL(CASE WHEN COUNT(*) > 0 THEN SUM(vedTotalNf)/COUNT(*) ELSE 0 END, 0)  AS ticketMedio
    FROM venda
    WHERE vedStatus IN ('F','C')
      AND vedTipo IN ('OS','VE')
      AND CONVERT(date, vedFechamento) BETWEEN @start AND @end`;

  let bridgeFound = false;
  let lastError = "";

  for (const id of lojaIds) {
    const config = await getLojaDbConfig(id).catch(() => null);
    if (!config) continue;

    bridgeFound = true;

    try {
      const [atual, ant] = await Promise.all([
        queryBridge<KpiRow>(config, SQL_KPIS, { start, end }),
        queryBridge<KpiRow>(config, SQL_KPIS, { start: anterior.start, end: anterior.end }),
      ]);

      faturamento += Number(atual[0]?.faturamento ?? 0);
      totalVendas += Number(atual[0]?.totalVendas ?? 0);
      clientes += Number(atual[0]?.clientes ?? 0);
      faturamentoAnt += Number(ant[0]?.faturamento ?? 0);
      totalVendasAnt += Number(ant[0]?.totalVendas ?? 0);
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

  // Se todas as lojas falharam com erro, expõe o erro real
  if (lastError && faturamento === 0 && totalVendas === 0) {
    return NextResponse.json({ error: lastError }, { status: 500 });
  }

  const ticketMedio = totalVendas > 0 ? faturamento / totalVendas : 0;
  const ticketMedioAnt = totalVendasAnt > 0 ? faturamentoAnt / totalVendasAnt : 0;

  return NextResponse.json({
    faturamento: {
      value: faturamento,
      change: calcVariacao(faturamento, faturamentoAnt),
      vendaTotal: faturamento,
      devolucaoTotal: 0,
      totalVendas,
      totalDevolucoes: 0,
    },
    custo: { value: 0 },
    lucro: { value: 0, margem: 0 },
    clientes: { value: clientes },
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
    totalDevolucoes: 0,
    totalCancelamentos: 0,
    valorDevolvido: 0,
  });
}
