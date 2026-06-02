import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDateRange } from "@/lib/utils/format";

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

// Linha de venda usando o campo tipo diretamente (populado pelo sync)
type VendaRow = {
  valor_total: number | null;
  status: string | null;
  tipo: string | null;
  external_id: string | null;
  cpf_cnpj: string | null;
  loja_id: string | null;
};

// Busca vendas do período usando o campo tipo — sem join com cfop_classificacoes
async function queryVendasPeriodo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lojaIds: string[],
  startDate: string,
  endDate: string
): Promise<VendaRow[]> {
  const { data, error } = await supabase
    .from("vendas")
    .select("valor_total, status, tipo, external_id, cpf_cnpj, loja_id")
    .in("loja_id", lojaIds)
    .gte("data_venda", startDate)
    .lte("data_venda", endDate);

  if (error) {
    console.error("[kpis] erro ao buscar vendas:", error.message);
    return [];
  }

  return (data ?? []) as VendaRow[];
}

// Calcula custo total processando vendas em lotes de 500 para suportar grandes volumes
async function calcCustoTotal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lojaIds: string[],
  vendas: VendaRow[]
): Promise<number> {
  const vendasIds = vendas.map((v) => v.external_id).filter(Boolean) as string[];
  if (vendasIds.length === 0) return 0;

  const LOTE = 500;
  let custoTotal = 0;

  for (let i = 0; i < vendasIds.length; i += LOTE) {
    const lote = vendasIds.slice(i, i + LOTE);

    const { data: itens } = await supabase
      .from("venda_itens")
      .select("produto_external_id, quantidade, loja_id")
      .in("loja_id", lojaIds)
      .in("venda_external_id", lote);

    if (!itens?.length) continue;

    const produtoIds = [...new Set(
      itens.map((it: { produto_external_id: string | null }) => it.produto_external_id).filter(Boolean)
    )];

    if (!produtoIds.length) continue;

    const { data: produtos } = await supabase
      .from("produtos")
      .select("external_id, valor_custo, loja_id")
      .in("loja_id", lojaIds)
      .in("external_id", produtoIds)
      .gt("valor_custo", 0);

    if (!produtos?.length) continue;

    const custoPorProduto = new Map(
      produtos.map((p: { loja_id: string; external_id: string; valor_custo: number | null }) =>
        [`${p.loja_id}:${p.external_id}`, p.valor_custo ?? 0]
      )
    );

    custoTotal += itens.reduce((acc: number, item: { loja_id: string; produto_external_id: string | null; quantidade: number | null }) => {
      const key = `${item.loja_id}:${item.produto_external_id}`;
      const custo = custoPorProduto.get(key) ?? 0;
      return acc + (item.quantidade ?? 0) * custo;
    }, 0);
  }

  return custoTotal;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  // lojaIds (multi-loja, comma-sep) tem prioridade; lojaId mantido para compatibilidade
  const lojaIdsParam = searchParams.get("lojaIds");
  const lojaId = searchParams.get("lojaId");
  const period = searchParams.get("period") ?? "month";

  const lojaIds = lojaIdsParam
    ? lojaIdsParam.split(",").filter(Boolean)
    : lojaId
    ? [lojaId]
    : [];

  if (lojaIds.length === 0) {
    return NextResponse.json({ error: "lojaId ou lojaIds é obrigatório" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Usar start/end enviados pelo cliente (inclui customRange calculado no browser)
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const { start, end } = startParam && endParam
    ? { start: startParam, end: endParam }
    : getDateRange(period);

  const anterior = periodoAnterior(period, start, end);

  // Buscar período atual e anterior em paralelo
  const [vendasPeriodo, vendasAnt] = await Promise.all([
    queryVendasPeriodo(supabase, lojaIds, start, end),
    queryVendasPeriodo(supabase, lojaIds, anterior.start, anterior.end),
  ]);

  // ── Classificar período atual ──────────────────────────────────────────────
  // Status estendidos para cobrir OS: finalizada, concluida, fechada, pago, aprovada
  const STATUS_FINALIZADOS = ["finalizada", "concluida", "fechada", "pago", "aprovada"];
  const finalizadas = vendasPeriodo.filter((v) =>
    STATUS_FINALIZADOS.some((s) => v.status?.toLowerCase().includes(s))
  );
  const canceladas = vendasPeriodo.filter((v) => v.status === "cancelada");

  // Classificar usando campo tipo (já populado pelo sync — inclui OS com tipo='venda')
  const vendasTipo = finalizadas.filter((v) => v.tipo === "venda" || v.tipo == null);

  // Diagnóstico: amostra dos primeiros registros para validar valores
  console.log("[kpis] sample vendas:", vendasTipo.slice(0, 3).map((v) => ({
    valor_total: v.valor_total,
    status: v.status,
    tipo: v.tipo,
  })));
  const devolucoesTipo = finalizadas.filter((v) => v.tipo === "devolucao");
  const outrosTipo = finalizadas.filter((v) => v.tipo === "outro");

  const totalVendas = vendasTipo.length;
  const totalDevolucoes = devolucoesTipo.length;
  const totalCancelamentos = canceladas.length;
  const totalOutros = outrosTipo.length;

  const vendaTotal = vendasTipo.reduce((acc, v) => acc + (v.valor_total ?? 0), 0);
  const valorDevolvido = devolucoesTipo.reduce((acc, v) => acc + (v.valor_total ?? 0), 0);
  const valorOutros = outrosTipo.reduce((acc, v) => acc + (v.valor_total ?? 0), 0);
  // Faturamento bruto — não subtrai devoluções (exibidas separadamente no dashboard)
  const faturamento = vendaTotal;
  const ticketMedio = totalVendas > 0 ? faturamento / totalVendas : 0;

  // Clientes únicos por CPF/CNPJ nas vendas do período
  const clientesUnicos = new Set(
    vendasTipo
      .map((v) => (v.cpf_cnpj ?? "").replace(/\D/g, ""))
      .filter(Boolean)
  ).size;

  // Custo e lucro calculados em paralelo com período anterior
  const [custoTotal, finalizadasAnt] = await Promise.all([
    calcCustoTotal(supabase, lojaIds, vendasTipo),
    Promise.resolve(
      vendasAnt.filter((v) =>
        STATUS_FINALIZADOS.some((s) => v.status?.toLowerCase().includes(s))
      )
    ),
  ]);

  const lucroTotal = faturamento - custoTotal;
  const margemPercent = faturamento > 0 ? (lucroTotal / faturamento) * 100 : 0;

  // ── Classificar período anterior ───────────────────────────────────────────
  const vendasTipoAnt = finalizadasAnt.filter((v) => v.tipo === "venda" || v.tipo == null);
  const devolucoesTipoAnt = finalizadasAnt.filter((v) => v.tipo === "devolucao");

  const vendaTotalAnt = vendasTipoAnt.reduce((acc, v) => acc + (v.valor_total ?? 0), 0);
  const _valorDevolvidoAnt = devolucoesTipoAnt.reduce((acc, v) => acc + (v.valor_total ?? 0), 0);
  const faturamentoAnt = vendaTotalAnt;
  const ticketMedioAnt =
    vendasTipoAnt.length > 0 ? faturamentoAnt / vendasTipoAnt.length : 0;

  return NextResponse.json({
    faturamento: {
      value: faturamento,
      change: calcVariacao(faturamento, faturamentoAnt),
      vendaTotal,
      devolucaoTotal: valorDevolvido,
      totalVendas,
      totalDevolucoes,
    },
    custo: { value: custoTotal },
    lucro: { value: lucroTotal, margem: margemPercent },
    clientes: { value: clientesUnicos },
    vendas: {
      value: totalVendas,
      change: calcVariacao(totalVendas, vendasTipoAnt.length),
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
    totalCancelamentos,
    valorDevolvido,
  });
}
