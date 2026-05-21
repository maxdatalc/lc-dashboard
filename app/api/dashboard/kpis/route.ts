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

// Tipo unificado para linha de venda com classificação CFOP via JOIN
type VendaRow = {
  valor_total: number | null;
  status: string | null;
  cfop: number | null;
  cfop_classificacoes: { tipo: string } | null;
};

// Classifica CFOP por prefixo numérico — fallback quando FK ainda não está configurada
// tipo 'venda'     → CFOPs 5xxx e 6xxx
// tipo 'devolucao' → CFOPs 1xxx, 2xxx, 3xxx
function classificarPorPrefixo(cfop: number | null): "venda" | "devolucao" | "outro" | null {
  if (cfop == null) return null;
  const p = Math.floor(cfop / 1000);
  if (p === 5 || p === 6) return "venda";
  if (p === 1 || p === 2 || p === 3) return "devolucao";
  return "outro";
}

// Busca vendas do período com classificação CFOP via JOIN (FK vendas_cfop_fkey)
// Suporta múltiplas lojas via lojaIds array
// Fallback automático para classificação por prefixo se FK não estiver configurada
async function queryVendasPeriodo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lojaIds: string[],
  startDate: string,
  endDate: string
): Promise<VendaRow[]> {
  const { data, error } = await supabase
    .from("vendas")
    .select("valor_total, status, cfop, cfop_classificacoes!vendas_cfop_fkey(tipo)")
    .in("loja_id", lojaIds)
    .gte("data_venda", startDate)
    .lte("data_venda", endDate);

  if (!error) {
    return (data ?? []) as unknown as VendaRow[];
  }

  // FK não configurada ainda — fallback com classificação por prefixo CFOP
  console.warn("[kpis] join cfop indisponível, usando prefixo:", error.message);
  const { data: fallback, error: err2 } = await supabase
    .from("vendas")
    .select("valor_total, status, cfop")
    .in("loja_id", lojaIds)
    .gte("data_venda", startDate)
    .lte("data_venda", endDate);

  if (err2) {
    console.error("[kpis] erro no fallback:", err2);
    return [];
  }

  return (fallback ?? []).map((row) => {
    const cfop = row.cfop as number | null;
    const tipo = classificarPorPrefixo(cfop);
    return {
      valor_total: row.valor_total as number | null,
      status: row.status as string | null,
      cfop,
      cfop_classificacoes: tipo != null ? { tipo } : null,
    };
  });
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
  const finalizadas = vendasPeriodo.filter((v) => v.status === "finalizada");
  const canceladas = vendasPeriodo.filter((v) => v.status === "cancelada");

  // Vendas = tipo 'venda' ou CFOP não mapeado (conservador — não esconder receita)
  const vendasCfop = finalizadas.filter((v) => {
    const tipo = v.cfop_classificacoes?.tipo;
    return tipo === "venda" || tipo == null;
  });
  // Devoluções = tipo 'devolucao' (CFOPs 1xxx, 2xxx, 3xxx) com status finalizada
  const devolucoesCfop = finalizadas.filter(
    (v) => v.cfop_classificacoes?.tipo === "devolucao"
  );

  const totalVendas = vendasCfop.length;
  const totalDevolucoes = devolucoesCfop.length;
  const totalCancelamentos = canceladas.length;

  const vendaTotal = vendasCfop.reduce((acc, v) => acc + (v.valor_total ?? 0), 0);
  const valorDevolvido = devolucoesCfop.reduce((acc, v) => acc + (v.valor_total ?? 0), 0);
  const faturamento = vendaTotal - valorDevolvido;
  const ticketMedio = totalVendas > 0 ? faturamento / totalVendas : 0;

  // ── Classificar período anterior ───────────────────────────────────────────
  const finalizadasAnt = vendasAnt.filter((v) => v.status === "finalizada");
  const vendasCfopAnt = finalizadasAnt.filter((v) => {
    const tipo = v.cfop_classificacoes?.tipo;
    return tipo === "venda" || tipo == null;
  });
  const devolucoesCfopAnt = finalizadasAnt.filter(
    (v) => v.cfop_classificacoes?.tipo === "devolucao"
  );

  const vendaTotalAnt = vendasCfopAnt.reduce((acc, v) => acc + (v.valor_total ?? 0), 0);
  const valorDevolvidoAnt = devolucoesCfopAnt.reduce((acc, v) => acc + (v.valor_total ?? 0), 0);
  const faturamentoAnt = vendaTotalAnt - valorDevolvidoAnt;
  const ticketMedioAnt =
    vendasCfopAnt.length > 0 ? faturamentoAnt / vendasCfopAnt.length : 0;

  return NextResponse.json({
    faturamento: {
      value: faturamento,
      change: calcVariacao(faturamento, faturamentoAnt),
      vendaTotal,
      devolucaoTotal: valorDevolvido,
      totalVendas,
      totalDevolucoes,
    },
    vendas: {
      value: totalVendas,
      change: calcVariacao(totalVendas, vendasCfopAnt.length),
    },
    ticketMedio: {
      value: ticketMedio,
      change: calcVariacao(ticketMedio, ticketMedioAnt),
    },
    totalVendas,
    totalDevolucoes,
    totalCancelamentos,
    valorDevolvido,
  });
}
