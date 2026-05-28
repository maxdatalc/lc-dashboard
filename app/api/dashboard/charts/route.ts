import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDateRange } from "@/lib/utils/format";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  // lojaIds (multi-loja, comma-sep) tem prioridade; lojaId mantido para compatibilidade
  const lojaIdsParam = searchParams.get("lojaIds");
  const lojaId = searchParams.get("lojaId");
  const period = searchParams.get("period") ?? "month";
  const type = searchParams.get("type");

  const lojaIds = lojaIdsParam
    ? lojaIdsParam.split(",").filter(Boolean)
    : lojaId
    ? [lojaId]
    : [];

  if (lojaIds.length === 0 || !type) {
    return NextResponse.json({ error: "lojaId/lojaIds e type são obrigatórios" }, { status: 400 });
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

  // Log de diagnóstico — útil para depurar gráficos vazios
  console.log(`[charts] type=${type} period=${period}`);
  console.log(`[charts] lojaIds:`, lojaIds);
  console.log(`[charts] start=${start} end=${end}`);

  try {
    switch (type) {
      case "faturamento-mensal": {
        // Buscar últimos 18 meses para garantir que encontramos 6 meses com dados
        const d18m = new Date();
        d18m.setMonth(d18m.getMonth() - 17);
        d18m.setDate(1);
        const inicio18m = d18m.toISOString().split("T")[0];
        const hoje = new Date().toISOString().split("T")[0];

        const { data, error } = await supabase
          .from("vendas")
          .select("data_venda, valor_total, cfop")
          .in("loja_id", lojaIds)
          .eq("status", "finalizada")
          .gte("data_venda", inicio18m)
          .lte("data_venda", hoje);

        console.log(`[charts/faturamento-mensal] rows encontrados:`, data?.length ?? 0);
        if (error) {
          console.error("[charts/faturamento-mensal] erro:", error.message);
          return NextResponse.json([]);
        }

        // Agrupar por mês — separar faturamento de devoluções por prefixo CFOP
        const agrupado: Record<string, { faturamento: number; devolucoes: number }> = {};
        for (const v of data ?? []) {
          const key = (v.data_venda as string).slice(0, 7);
          if (!agrupado[key]) agrupado[key] = { faturamento: 0, devolucoes: 0 };
          const valor = (v.valor_total as number) ?? 0;
          const cfop = v.cfop as number | null;
          // CFOP 1xxx/2xxx/3xxx = devolução; 5xxx/6xxx ou null = venda
          const isDevolucao = cfop !== null && cfop < 4000;
          if (isDevolucao) {
            agrupado[key].devolucoes += valor;
          } else {
            agrupado[key].faturamento += valor;
          }
        }

        // Retorna os 6 meses mais recentes que tenham dados (faturamento > 0)
        const resultado = Object.entries(agrupado)
          .filter(([, d]) => d.faturamento > 0 || d.devolucoes > 0)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-6)
          .map(([mes, d]) => ({
            mes: new Date(mes + "-15").toLocaleDateString("pt-BR", { month: "short" }),
            faturamento: d.faturamento,
            devolucoes: d.devolucoes,
          }));

        return NextResponse.json(resultado);
      }

      case "vendas-tipo-cliente": {
        // Filtra por tipo='venda' para incluir OS (cfop=5933 seria excluído pelo filtro de CFOP)
        const { data, error } = await supabase
          .from("vendas")
          .select("cpf_cnpj, valor_total")
          .in("loja_id", lojaIds)
          .eq("status", "finalizada")
          .eq("tipo", "venda")
          .gte("data_venda", start)
          .lte("data_venda", end);

        console.log(`[charts/vendas-tipo-cliente] rows encontrados:`, data?.length ?? 0, "erro:", error?.message);
        if (error) {
          console.error("[charts/vendas-tipo-cliente] erro:", error.message);
          return NextResponse.json({ pf: { total: 0, clientes: 0 }, pj: { total: 0, clientes: 0 } });
        }

        let pfTotal = 0, pfCount = 0;
        let pjTotal = 0, pjCount = 0;

        for (const v of data ?? []) {
          const doc = ((v.cpf_cnpj as string) ?? "").replace(/\D/g, "");
          const valor = (v.valor_total as number) ?? 0;
          if (doc.length === 14) {
            pjTotal += valor;
            pjCount += 1;
          } else {
            pfTotal += valor;
            pfCount += 1;
          }
        }

        return NextResponse.json({
          pf: { total: pfTotal, clientes: pfCount },
          pj: { total: pjTotal, clientes: pjCount },
        });
      }

      case "formas-pagamento": {
        // Buscar external_ids das vendas finalizadas no período
        // Usa tipo='venda' em vez de filtro CFOP para incluir OS
        const { data: vendasPeriodo, error: errVendas } = await supabase
          .from("vendas")
          .select("external_id")
          .in("loja_id", lojaIds)
          .eq("status", "finalizada")
          .eq("tipo", "venda")
          .gte("data_venda", start)
          .lte("data_venda", end)
          .not("external_id", "is", null)
          .limit(500);

        console.log(`[charts/formas-pagamento] vendas no período:`, vendasPeriodo?.length ?? 0, "erro:", errVendas?.message);
        if (errVendas) {
          console.error("[charts/formas-pagamento] erro ao buscar vendas:", errVendas.message);
          return NextResponse.json([]);
        }
        if (!vendasPeriodo?.length) return NextResponse.json([]);

        // Chave do join: venda_pagamentos.venda_external_id → vendas.external_id
        const externalIds = vendasPeriodo.map((v) => v.external_id as string | number);

        const { data: pagamentos, error: errPag } = await supabase
          .from("venda_pagamentos")
          .select("forma_pagamento, valor")
          .in("loja_id", lojaIds)
          .in("venda_external_id", externalIds);

        console.log(`[charts/formas-pagamento] pagamentos encontrados:`, pagamentos?.length ?? 0, "erro:", errPag?.message);
        if (errPag) {
          console.error("[charts/formas-pagamento] erro ao buscar pagamentos:", errPag.message);
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
        // Filtra por tipo='venda' para incluir OS nos top produtos
        const { data: vendas, error: errVendas } = await supabase
          .from("vendas")
          .select("external_id")
          .in("loja_id", lojaIds)
          .eq("status", "finalizada")
          .eq("tipo", "venda")
          .not("external_id", "is", null)
          .gte("data_venda", start)
          .lte("data_venda", end);

        console.log(`[charts/top-produtos] vendas no período:`, vendas?.length ?? 0, "erro:", errVendas?.message);
        if (errVendas) {
          console.error("[charts/top-produtos] erro ao buscar vendas:", errVendas.message);
          return NextResponse.json([]);
        }
        if (!vendas?.length) return NextResponse.json([]);

        const externalIds = vendas.map((v) => v.external_id as string | number).filter(Boolean);
        if (!externalIds.length) return NextResponse.json([]);

        // Chave do join: venda_itens.venda_external_id → vendas.external_id
        const { data: itens, error: errItens } = await supabase
          .from("venda_itens")
          .select("produto_nome, quantidade, valor_total")
          .in("loja_id", lojaIds)
          .in("venda_external_id", externalIds);

        console.log(`[charts/top-produtos] itens encontrados:`, itens?.length ?? 0, "erro:", errItens?.message);
        if (errItens) {
          console.error("[charts/top-produtos] erro ao buscar itens:", errItens.message);
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
        // Filtra por tipo='venda' para incluir OS — CFOP=5933 seria excluído pelo filtro anterior
        const { data, error } = await supabase
          .from("vendas")
          .select("cliente_nome, valor_total")
          .in("loja_id", lojaIds)
          .eq("status", "finalizada")
          .eq("tipo", "venda")
          .not("cliente_nome", "is", null)
          .neq("cliente_nome", "")
          .gte("data_venda", start)
          .lte("data_venda", end);

        console.log(`[charts/top-clientes] rows encontrados:`, data?.length ?? 0, "erro:", error?.message);
        if (error) {
          console.error("[charts/top-clientes] erro:", error.message);
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
