import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDateRange } from "@/lib/utils/format";

const IN_FILTER_BATCH_SIZE = 1000;
const QUERY_PAGE_SIZE = 1000;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
        const vendasIds: Record<string, unknown>[] = [];

        for (let offset = 0; ; offset += QUERY_PAGE_SIZE) {
          const { data: vendasLote, error: errVendas } = await supabase
            .from("vendas")
            .select("external_id")
            .in("loja_id", lojaIds)
            .eq("tipo", "venda")
            .eq("status", "finalizada")
            .gte("data_venda", start)
            .lte("data_venda", end)
            .not("external_id", "is", null)
            .range(offset, offset + QUERY_PAGE_SIZE - 1);

          if (errVendas) {
            console.error("[charts/top-produtos] erro:", errVendas.message);
            return NextResponse.json([]);
          }

          vendasIds.push(...((vendasLote ?? []) as Record<string, unknown>[]));
          if ((vendasLote?.length ?? 0) < QUERY_PAGE_SIZE) break;
        }

        console.log(`[charts/top-produtos] vendas no período:`, vendasIds.length);
        if (!vendasIds.length) return NextResponse.json([]);

        const ids = vendasIds.map((v) => v.external_id as string | number).filter(Boolean);
        if (!ids.length) return NextResponse.json([]);

        const itens: Record<string, unknown>[] = [];
        for (const loteIds of chunkArray(ids, IN_FILTER_BATCH_SIZE)) {
          const { data: itensLote, error: errItens } = await supabase
            .from("venda_itens")
            .select("produto_nome, produto_external_id, quantidade, valor_total, valor_unitario")
            .in("loja_id", lojaIds)
            .in("venda_external_id", loteIds);

          if (errItens) {
            console.error("[charts/top-produtos] erro:", errItens.message);
            return NextResponse.json([]);
          }

          itens.push(...((itensLote ?? []) as Record<string, unknown>[]));
        }

        console.log(`[charts/top-produtos] itens encontrados:`, itens.length);
        if (!itens.length) return NextResponse.json([]);

        const porProduto = new Map<string, {
          nome: string;
          produtoExternalId: number | null;
          valorTotal: number;
          quantidade: number;
          valorUnitario: number;
        }>();

        for (const i of itens) {
          const nome = ((i.produto_nome as string) ?? "Produto").trim();
          const produtoExternalId = toNullableNumber(i.produto_external_id);
          const key = produtoExternalId != null ? `id:${produtoExternalId}` : `nome:${nome}`;
          const existing = porProduto.get(key);
          if (!existing) {
            porProduto.set(key, {
              nome,
              produtoExternalId,
              valorTotal: toNumber(i.valor_total),
              quantidade: toNumber(i.quantidade),
              valorUnitario: toNumber(i.valor_unitario),
            });
          } else {
            existing.valorTotal += toNumber(i.valor_total);
            existing.quantidade += toNumber(i.quantidade);
            if (!existing.valorUnitario) existing.valorUnitario = toNumber(i.valor_unitario);
          }
        }

        const top50 = Array.from(porProduto.values())
          .sort((a, b) => b.valorTotal - a.valorTotal)
          .slice(0, 50);

        const produtoIds = Array.from(
          new Set(top50.map((p) => p.produtoExternalId).filter((id): id is number => id != null))
        );

        let detalhesMap = new Map<number, Record<string, unknown>>();
        if (produtoIds.length > 0) {
          const produtosDetalhes: Record<string, unknown>[] = [];
          for (const loteProdutoIds of chunkArray(produtoIds, IN_FILTER_BATCH_SIZE)) {
            const { data: produtosLote, error: errProdutos } = await supabase
              .from("produtos")
              .select("external_id, codigo, grupo_nome, sub_grupo_nome, fabricante, preco_venda, valor_custo, estoque_atual")
              .in("loja_id", lojaIds)
              .in("external_id", loteProdutoIds);

            if (errProdutos) {
              console.error("[charts/top-produtos] erro detalhes:", errProdutos.message);
              return NextResponse.json([]);
            }

            produtosDetalhes.push(...((produtosLote ?? []) as Record<string, unknown>[]));
          }

          detalhesMap = new Map(
            produtosDetalhes.map((p) => [toNumber(p.external_id), p as Record<string, unknown>])
          );
        }

        const resultado = top50.map((p) => {
          const det = p.produtoExternalId ? detalhesMap.get(p.produtoExternalId) : null;
          const precoVenda = toNullableNumber(det?.preco_venda) ?? p.valorUnitario;
          const valorCusto = toNullableNumber(det?.valor_custo);
          const margem =
            valorCusto != null && precoVenda > 0
              ? Number((((precoVenda - valorCusto) / precoVenda) * 100).toFixed(1))
              : null;

          return {
            nome: p.nome,
            valor: p.valorTotal,
            quantidade: p.quantidade,
            codigo: (det?.codigo as string) ?? null,
            grupoNome: (det?.grupo_nome as string) ?? null,
            subGrupo: (det?.sub_grupo_nome as string) ?? null,
            fabricante: (det?.fabricante as string) ?? null,
            precoVenda,
            valorCusto,
            margem,
            estoqueAtual: (det?.estoque_atual as number) ?? null,
          };
        });

        return NextResponse.json(resultado);
      }

      case "top-clientes": {
        const vendasData: Record<string, unknown>[] = [];

        for (let offset = 0; ; offset += QUERY_PAGE_SIZE) {
          const { data: vendasLote, error: errVendas } = await supabase
            .from("vendas")
            .select("cliente_nome, cliente_external_id, cpf_cnpj, valor_total, data_venda")
            .in("loja_id", lojaIds)
            .eq("tipo", "venda")
            .eq("status", "finalizada")
            .gte("data_venda", start)
            .lte("data_venda", end)
            .not("cliente_nome", "is", null)
            .neq("cliente_nome", "")
            .range(offset, offset + QUERY_PAGE_SIZE - 1);

          if (errVendas) {
            console.error("[charts/top-clientes] erro:", errVendas.message);
            return NextResponse.json([]);
          }

          vendasData.push(...((vendasLote ?? []) as Record<string, unknown>[]));
          if ((vendasLote?.length ?? 0) < QUERY_PAGE_SIZE) break;
        }

        console.log(`[charts/top-clientes] rows encontrados:`, vendasData.length);
        if (!vendasData.length) return NextResponse.json([]);

        const porCliente = new Map<string, {
          nome: string;
          clienteExternalId: number | null;
          cpfCnpj: string;
          total: number;
          compras: number;
          ultimaCompra: string;
        }>();

        for (const v of vendasData) {
          const key = (v.cliente_nome as string).trim();
          if (!key) continue;
          const existing = porCliente.get(key);
          if (!existing) {
            porCliente.set(key, {
              nome: key,
              clienteExternalId: (v.cliente_external_id as number) ?? null,
              cpfCnpj: (v.cpf_cnpj as string) ?? "",
              total: (v.valor_total as number) ?? 0,
              compras: 1,
              ultimaCompra: v.data_venda as string,
            });
          } else {
            existing.total += (v.valor_total as number) ?? 0;
            existing.compras += 1;
            if ((v.data_venda as string) > existing.ultimaCompra) {
              existing.ultimaCompra = v.data_venda as string;
            }
          }
        }

        const top50 = Array.from(porCliente.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 50);

        const externalIds = top50.map((c) => c.clienteExternalId).filter(Boolean) as number[];

        let detalhesMap = new Map<number, Record<string, unknown>>();
        if (externalIds.length > 0) {
          const { data: clientesDetalhes } = await supabase
            .from("clientes")
            .select("external_id, email, telefone, cidade, estado, cnpj_cpf")
            .in("loja_id", lojaIds)
            .in("external_id", externalIds);
          detalhesMap = new Map(
            (clientesDetalhes ?? []).map((c) => [c.external_id as number, c as Record<string, unknown>])
          );
        }

        const resultado = top50.map((c) => {
          const det = c.clienteExternalId ? detalhesMap.get(c.clienteExternalId) : null;
          const cnpjCpf = (det?.cnpj_cpf as string) ?? c.cpfCnpj ?? null;
          const tipoPessoa = (cnpjCpf ?? "").replace(/\D/g, "").length === 14 ? "PJ" : "PF";
          return {
            nome: c.nome,
            total: c.total,
            compras: c.compras,
            ticketMedio: c.total / c.compras,
            ultimaCompra: c.ultimaCompra,
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

      default:
        return NextResponse.json({ error: "type inválido" }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[charts/${type}] erro inesperado:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
