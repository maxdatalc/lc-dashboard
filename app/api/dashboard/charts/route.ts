import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDateRange } from "@/lib/utils/format";

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

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
        // 12 meses fixos a partir do mês final do período selecionado
        const endDate = new Date(end + "T12:00:00");
        const startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 11);
        startDate.setDate(1);

        const inicio12m = startDate.toISOString().split("T")[0];
        const fim12m = end;

        const { data, error } = await supabase
          .from("vendas")
          .select("data_venda, valor_total, tipo")
          .in("loja_id", lojaIds)
          .in("status", ["finalizada", "concluida", "fechada", "pago", "aprovada"])
          .gte("data_venda", inicio12m)
          .lte("data_venda", fim12m);

        if (error) {
          console.error("[charts/faturamento-mensal] erro:", error.message);
          return NextResponse.json([]);
        }

        // Gerar os 12 meses do intervalo (mesmo sem dados — zero fill)
        const meses: Record<string, { vendas: number; devolucoes: number }> = {};
        const cursor = new Date(startDate);
        while (cursor <= endDate) {
          const key = cursor.toISOString().slice(0, 7);
          meses[key] = { vendas: 0, devolucoes: 0 };
          cursor.setMonth(cursor.getMonth() + 1);
        }

        // Acumular valores por tipo
        for (const v of data ?? []) {
          const key = (v.data_venda as string).slice(0, 7);
          if (!meses[key]) continue;
          const valor = (v.valor_total as number) ?? 0;
          const tipo = v.tipo as string | null;
          if (tipo === "devolucao") {
            meses[key].devolucoes += valor;
          } else if (tipo === "venda" || tipo == null) {
            meses[key].vendas += valor;
          }
        }

        const NOMES = ["Jan","Fev","Mar","Abr","Mai","Jun",
                       "Jul","Ago","Set","Out","Nov","Dez"];

        const resultado = Object.entries(meses)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([mesKey, d]) => {
            const [ano, mes] = mesKey.split("-");
            const label = `${NOMES[parseInt(mes) - 1]}/${ano.slice(2)}`;
            return {
              mes: label,
              mesCompleto: `${NOMES[parseInt(mes) - 1]}/${ano}`,
              vendas: d.vendas,
              devolucoes: d.devolucoes,
              vendaLiquidaDevolucao: d.vendas - d.devolucoes,
            };
          });

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
          .in("venda_external_id", externalIds.map(String));

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
        // Query agregada via RPC — elimina 143 queries sequenciais em JS
        // deno-lint-ignore no-explicit-any
        const { data: itensAgregados, error: errItens } = await (supabase as any)
          .rpc("get_top_produtos", {
            p_loja_ids: lojaIds,
            p_start: start,
            p_end: end,
            p_limit: 50,
          });

        if (errItens) {
          console.error("[charts/top-produtos] erro RPC:", errItens.message);
          return NextResponse.json([]);
        }

        if (!itensAgregados?.length) return NextResponse.json([]);

        // Buscar detalhes dos top 50 produtos (1 query)
        const produtoIds = (itensAgregados as Record<string, unknown>[])
          .map((i) => i.produto_external_id)
          .filter(Boolean);

        const { data: produtos } = await supabase
          .from("produtos")
          .select("external_id, codigo, grupo_nome, sub_grupo_nome, fabricante, preco_venda, valor_custo")
          .in("loja_id", lojaIds)
          .in("external_id", produtoIds.map(String));

        const detalhesMap = new Map(
          (produtos ?? []).map((p) => [Number(p.external_id), p])
        );

        const resultado = (itensAgregados as Record<string, unknown>[]).map((item) => {
          const det = detalhesMap.get(Number(item.produto_external_id)) ?? null;
          const precoVenda = Number(det?.preco_venda ?? 0);
          const valorCusto = Number(det?.valor_custo ?? 0);
          const margem = precoVenda > 0
            ? Number((((precoVenda - valorCusto) / precoVenda) * 100).toFixed(1))
            : null;

          return {
            nome: (item.produto_nome as string) ?? "Produto",
            valor: Number(item.valor_total),
            quantidade: Number(item.quantidade_total),
            externalId: Number(item.produto_external_id),
            codigo: (det?.codigo as string) ?? null,
            grupoNome: (det?.grupo_nome as string) ?? null,
            subGrupo: (det?.sub_grupo_nome as string) ?? null,
            fabricante: (det?.fabricante as string) ?? null,
            precoVenda: precoVenda || null,
            valorCusto: valorCusto || null,
            margem,
            estoqueAtual: null,
          };
        });

        return NextResponse.json(resultado);
      }

      case "top-clientes": {
        // Query agregada via RPC — elimina busca de 143k rows no JS
        // deno-lint-ignore no-explicit-any
        const { data: clientesAgregados, error: errClientes } = await (supabase as any)
          .rpc("get_top_clientes", {
            p_loja_ids: lojaIds,
            p_start: start,
            p_end: end,
            p_limit: 50,
          });

        if (errClientes) {
          console.error("[charts/top-clientes] erro RPC:", errClientes.message);
          return NextResponse.json([]);
        }

        if (!clientesAgregados?.length) return NextResponse.json([]);

        // Buscar detalhes adicionais (1 query)
        const clienteIds = (clientesAgregados as Record<string, unknown>[])
          .map((c) => c.cliente_external_id)
          .filter(Boolean);

        let detalhesMap = new Map<number, Record<string, unknown>>();
        if (clienteIds.length > 0) {
          const { data: detalhes } = await supabase
            .from("clientes")
            .select("external_id, email, telefone, cidade, estado, cnpj_cpf")
            .in("loja_id", lojaIds)
            .in("external_id", clienteIds.map(String));
          detalhesMap = new Map(
            (detalhes ?? []).map((c) => [Number(c.external_id), c as Record<string, unknown>])
          );
        }

        const resultado = (clientesAgregados as Record<string, unknown>[]).map((c) => {
          const det = detalhesMap.get(Number(c.cliente_external_id)) ?? null;
          const cnpjCpf = (det?.cnpj_cpf as string) ?? (c.cpf_cnpj as string) ?? null;
          const tipoPessoa = (cnpjCpf ?? "").replace(/\D/g, "").length === 14 ? "PJ" : "PF";
          return {
            nome: (c.cliente_nome as string) ?? "Cliente",
            total: Number(c.valor_total),
            compras: Number(c.total_compras),
            ticketMedio: Number(c.ticket_medio),
            ultimaCompra: (c.ultima_compra as string) ?? "",
            tipoPessoa,
            cidade: (det?.cidade as string) ?? null,
            estado: (det?.estado as string) ?? null,
            email: (det?.email as string) ?? null,
            telefone: (det?.telefone as string) ?? null,
            cnpjCpf,
          };
        });

        return NextResponse.json(resultado);
      }

      case "top-vendedores": {
        // Buscar vendas do período com atendente_id preenchido
        const { data: vendasVendedor } = await supabase
          .from("vendas")
          .select("atendente_id, valor_total")
          .in("loja_id", lojaIds)
          .gte("data_venda", start)
          .lte("data_venda", end)
          .eq("tipo", "venda")
          .in("status", ["finalizada", "concluida", "fechada", "pago"])
          .not("atendente_id", "is", null);

        if (!vendasVendedor?.length) return NextResponse.json([]);

        // Agrupar por atendente_id
        const porVendedor = new Map<number, { total: number; qtd: number }>();
        for (const v of vendasVendedor) {
          const id = v.atendente_id as number;
          const existing = porVendedor.get(id);
          if (!existing) {
            porVendedor.set(id, { total: toNumber(v.valor_total), qtd: 1 });
          } else {
            existing.total += toNumber(v.valor_total);
            existing.qtd++;
          }
        }

        // Buscar nomes dos vendedores na tabela vendedores
        const vendedorIds = Array.from(porVendedor.keys());
        const { data: vendedores } = await supabase
          .from("vendedores")
          .select("external_id, nome, apelido")
          .in("loja_id", lojaIds)
          .in("external_id", vendedorIds.map(String));

        const nomeMap = new Map(
          (vendedores ?? []).map((v) => [
            toNumber(v.external_id),
            (v.nome as string) ?? `Vendedor ${v.external_id}`,
          ])
        );

        // Top 10 por valor total
        const resultado = Array.from(porVendedor.entries())
          .map(([id, dados]) => ({
            vendedorId: id,
            nome: nomeMap.get(id) ?? `Vendedor ${id}`,
            valor: dados.total,
            quantidade: dados.qtd,
            ticketMedio: dados.qtd > 0 ? dados.total / dados.qtd : 0,
          }))
          .sort((a, b) => b.valor - a.valor)
          .slice(0, 10);

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
