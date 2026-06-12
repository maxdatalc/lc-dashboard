import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDateRange } from "@/lib/utils/format";
import { requireTenantAccess } from "@/lib/api/tenant-guard";

function calcVariacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

// Calcula o intervalo do período anterior para comparação de variação percentual
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
      // Período de mesma duração imediatamente anterior ao intervalo personalizado
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

  const supabase = await createClient();

  // Usar start/end enviados pelo cliente — respeita período selecionado
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const { start, end } = startParam && endParam
    ? { start: startParam, end: endParam }
    : getDateRange(period);

  const anterior = periodoAnterior(period, start, end);

  // Buscar período atual + anterior + custos em paralelo via RPC
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = (supabase as any).rpc.bind(supabase);

  const [kpisAtual, kpisAnt, custoAtual] = await Promise.all([
    rpc("get_kpis_periodo", { p_loja_ids: lojaIds, p_start: start, p_end: end }),
    rpc("get_kpis_periodo", { p_loja_ids: lojaIds, p_start: anterior.start, p_end: anterior.end }),
    rpc("get_custo_periodo", { p_loja_ids: lojaIds, p_start: start, p_end: end }),
  ]);

  if (kpisAtual.error) {
    console.error("[kpis] erro RPC get_kpis_periodo:", kpisAtual.error.message);
    return NextResponse.json({ error: kpisAtual.error.message }, { status: 500 });
  }

  // Helper para extrair linha por tipo
  const getRow = (data: Record<string, unknown>[], tipo: string) =>
    (data ?? []).find((r) => r.tipo === tipo);

  // ── Período atual ──────────────────────────────────────────────────────────
  const rowVenda  = getRow(kpisAtual.data as Record<string, unknown>[], "venda");
  const rowDevol  = getRow(kpisAtual.data as Record<string, unknown>[], "devolucao");
  const rowOutros = getRow(kpisAtual.data as Record<string, unknown>[], "outro");

  const vendaTotal      = Number(rowVenda?.total_valor     ?? 0);
  const totalVendas     = Number(rowVenda?.total_registros ?? 0);
  const valorDevolvido  = Number(rowDevol?.total_valor     ?? 0);
  const totalDevolucoes = Number(rowDevol?.total_registros ?? 0);
  const clientesUnicos  = Number(rowVenda?.clientes_unicos ?? 0);
  const totalOutros     = Number(rowOutros?.total_registros ?? 0);
  const valorOutros     = Number(rowOutros?.total_valor     ?? 0);

  const faturamento   = vendaTotal;
  const custoTotal    = Number(custoAtual.data ?? 0);
  const lucroTotal    = faturamento - custoTotal - valorDevolvido;
  const margemPercent = faturamento > 0 ? (lucroTotal / faturamento) * 100 : 0;
  const ticketMedio   = totalVendas > 0 ? faturamento / totalVendas : 0;

  // ── Período anterior ───────────────────────────────────────────────────────
  const rowVendaAnt    = getRow(kpisAnt.data as Record<string, unknown>[], "venda");
  const faturamentoAnt = Number(rowVendaAnt?.total_valor     ?? 0);
  const totalVendasAnt = Number(rowVendaAnt?.total_registros ?? 0);
  const ticketMedioAnt = totalVendasAnt > 0 ? faturamentoAnt / totalVendasAnt : 0;

  return NextResponse.json({
    faturamento: {
      value: faturamento,
      change: calcVariacao(faturamento, faturamentoAnt),
      vendaTotal,
      devolucaoTotal: valorDevolvido,
      totalVendas,
      totalDevolucoes,
    },
    custo:  { value: custoTotal },
    lucro:  { value: lucroTotal, margem: margemPercent },
    clientes: { value: clientesUnicos },
    vendas: {
      value: totalVendas,
      change: calcVariacao(totalVendas, totalVendasAnt),
    },
    ticketMedio: {
      value: ticketMedio,
      change: calcVariacao(ticketMedio, ticketMedioAnt),
    },
    outros: {
      value: totalOutros,
      valorTotal: valorOutros,
    },
    totalVendas,
    totalDevolucoes,
    totalCancelamentos: 0,
    valorDevolvido,
  });
}
