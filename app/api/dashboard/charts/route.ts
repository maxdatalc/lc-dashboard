import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDateRange } from "@/lib/utils/format";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const lojaId = searchParams.get("lojaId");
  const period = searchParams.get("period") ?? "month";
  const type = searchParams.get("type");

  if (!lojaId || !type) {
    return NextResponse.json({ error: "lojaId e type são obrigatórios" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Usar start/end enviados pelo cliente se disponíveis (inclui customRange)
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const { start, end } = startParam && endParam
    ? { start: startParam, end: endParam }
    : getDateRange(period);

  try {
    switch (type) {
      case "faturamento-mensal": {
        // Sempre últimos 6 meses completos, independente do período selecionado
        const d6m = new Date();
        d6m.setMonth(d6m.getMonth() - 5);
        d6m.setDate(1);
        const inicio6m = d6m.toISOString().split("T")[0];
        const hoje = new Date().toISOString().split("T")[0];

        const { data, error } = await supabase
          .from("vendas")
          .select("data_venda, valor_total")
          .eq("loja_id", lojaId)
          .eq("status", "finalizada")
          .gte("data_venda", inicio6m)
          .lte("data_venda", hoje);

        if (error) {
          console.error("[charts/faturamento-mensal] erro:", error);
          return NextResponse.json([]);
        }

        // Agrupar por mês (YYYY-MM) no JavaScript
        const agrupado: Record<string, number> = {};
        for (const v of data ?? []) {
          const key = (v.data_venda as string).slice(0, 7);
          agrupado[key] = (agrupado[key] ?? 0) + ((v.valor_total as number) ?? 0);
        }

        const resultado = Object.entries(agrupado)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([mes, faturamento]) => ({
            mes: new Date(mes + "-15").toLocaleDateString("pt-BR", { month: "short" }),
            faturamento,
          }));

        return NextResponse.json(resultado);
      }

      case "formas-pagamento": {
        // Buscar external_ids das vendas finalizadas no período — excluir devoluções por CFOP
        const { data: vendasPeriodo, error: errVendas } = await supabase
          .from("vendas")
          .select("external_id")
          .eq("loja_id", lojaId)
          .eq("status", "finalizada")
          .gte("data_venda", start)
          .lte("data_venda", end)
          .not("external_id", "is", null)
          .or("cfop.is.null,cfop.in.(5101,5102,5401,5403,5405,6101,6102,6107,6108,6401,6403,6404)");

        if (errVendas) {
          console.error("[charts/formas-pagamento] erro ao buscar vendas:", errVendas);
          return NextResponse.json([]);
        }
        if (!vendasPeriodo?.length) return NextResponse.json([]);

        // Chave do join: venda_pagamentos.venda_external_id → vendas.external_id
        const externalIds = vendasPeriodo.map((v) => v.external_id as string | number);

        const { data: pagamentos, error: errPag } = await supabase
          .from("venda_pagamentos")
          .select("forma_pagamento, valor")
          .eq("loja_id", lojaId)
          .in("venda_external_id", externalIds);

        if (errPag) {
          console.error("[charts/formas-pagamento] erro ao buscar pagamentos:", errPag);
          return NextResponse.json([]);
        }
        if (!pagamentos?.length) return NextResponse.json([]);

        const agrupado: Record<string, number> = {};
        let totalGeral = 0;
        for (const item of pagamentos) {
          const forma = (item.forma_pagamento as string) ?? "Outros";
          const valor = (item.valor as number) ?? 0;
          agrupado[forma] = (agrupado[forma] ?? 0) + valor;
          totalGeral += valor;
        }

        const resultado = Object.entries(agrupado)
          .sort(([, a], [, b]) => b - a)
          .map(([nome, valor]) => ({
            nome,
            valor,
            percentual: totalGeral > 0 ? parseFloat(((valor / totalGeral) * 100).toFixed(1)) : 0,
          }));

        return NextResponse.json(resultado);
      }

      case "top-produtos": {
        // Buscar external_ids das vendas finalizadas no período — excluir devoluções por CFOP
        const { data: vendas, error: errVendas } = await supabase
          .from("vendas")
          .select("external_id")
          .eq("loja_id", lojaId)
          .eq("status", "finalizada")
          .not("external_id", "is", null)
          .gte("data_venda", start)
          .lte("data_venda", end)
          .or("cfop.is.null,cfop.in.(5101,5102,5401,5403,5405,6101,6102,6107,6108,6401,6403,6404)");

        if (errVendas) {
          console.error("[charts/top-produtos] erro ao buscar vendas:", errVendas);
          return NextResponse.json([]);
        }
        if (!vendas?.length) return NextResponse.json([]);

        const externalIds = vendas.map((v) => v.external_id as string | number).filter(Boolean);
        if (!externalIds.length) return NextResponse.json([]);

        // Chave do join: venda_itens.venda_external_id → vendas.external_id
        const { data: itens, error: errItens } = await supabase
          .from("venda_itens")
          .select("produto_nome, quantidade, valor_total")
          .eq("loja_id", lojaId)
          .in("venda_external_id", externalIds);

        if (errItens) {
          console.error("[charts/top-produtos] erro ao buscar itens:", errItens);
          return NextResponse.json([]);
        }
        if (!itens?.length) return NextResponse.json([]);

        const agrupado: Record<string, { valor: number; quantidade: number }> = {};
        for (const item of itens) {
          const nome = (item.produto_nome as string) ?? "Produto";
          if (!agrupado[nome]) agrupado[nome] = { valor: 0, quantidade: 0 };
          agrupado[nome].valor += (item.valor_total as number) ?? 0;
          agrupado[nome].quantidade += (item.quantidade as number) ?? 0;
        }

        const resultado = Object.entries(agrupado)
          .sort(([, a], [, b]) => b.valor - a.valor)
          .slice(0, 8)
          .map(([nome, d]) => ({ nome, ...d }));

        return NextResponse.json(resultado);
      }

      case "top-clientes": {
        // Excluir devoluções por CFOP — top-clientes deve refletir apenas compras reais
        const { data, error } = await supabase
          .from("vendas")
          .select("cliente_nome, valor_total")
          .eq("loja_id", lojaId)
          .eq("status", "finalizada")
          .not("cliente_nome", "is", null)
          .gte("data_venda", start)
          .lte("data_venda", end)
          .or("cfop.is.null,cfop.in.(5101,5102,5401,5403,5405,6101,6102,6107,6108,6401,6403,6404)");

        if (error) {
          console.error("[charts/top-clientes] erro:", error);
          return NextResponse.json([]);
        }
        if (!data?.length) return NextResponse.json([]);

        const agrupado: Record<string, { total: number; compras: number }> = {};
        for (const v of data) {
          const nome = (v.cliente_nome as string).trim();
          if (!nome) continue;
          if (!agrupado[nome]) agrupado[nome] = { total: 0, compras: 0 };
          agrupado[nome].total += (v.valor_total as number) ?? 0;
          agrupado[nome].compras += 1;
        }

        const resultado = Object.entries(agrupado)
          .sort(([, a], [, b]) => b.total - a.total)
          .slice(0, 8)
          .map(([nome, d]) => ({ nome, ...d }));

        return NextResponse.json(resultado);
      }

      default:
        return NextResponse.json({ error: "type inválido" }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[charts/${type}] erro inesperado:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
