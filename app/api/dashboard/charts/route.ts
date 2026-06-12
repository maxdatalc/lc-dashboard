import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDateRange } from "@/lib/utils/format";
import { requireTenantAccess } from "@/lib/api/tenant-guard";

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

  const guard = await requireTenantAccess(lojaIds);
  if (guard instanceof NextResponse) return guard;

  const supabase = await createClient();

  // Usar start/end enviados pelo cliente se disponíveis (inclui customRange)
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const { start, end } = startParam && endParam
    ? { start: startParam, end: endParam }
    : getDateRange(period);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = (supabase as any).rpc.bind(supabase);

  try {
    switch (type) {
      case "faturamento-mensal": {
        // 12 meses fixos a partir do mês final do período selecionado
        const endDate = new Date(end + "T12:00:00");
        const startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 11);
        startDate.setDate(1);
        const inicio12m = startDate.toISOString().split("T")[0];

        const { data: dadosMensais, error } = await rpc("get_vendas_mensal", {
          p_loja_ids: lojaIds,
          p_start: inicio12m,
          p_end: end,
        });

        if (error) {
          console.error("[charts/faturamento-mensal] erro RPC:", error.message);
          return NextResponse.json([]);
        }

        // Gerar os 12 meses com zero-fill para garantir todos os meses no gráfico
        const mesesMap = new Map<string, { vendas: number; devolucoes: number }>();
        const cursor = new Date(startDate);
        while (cursor <= endDate) {
          const key = cursor.toISOString().slice(0, 7);
          mesesMap.set(key, { vendas: 0, devolucoes: 0 });
          cursor.setMonth(cursor.getMonth() + 1);
        }

        for (const row of (dadosMensais ?? []) as Record<string, unknown>[]) {
          const key = row.mes_ano as string;
          if (mesesMap.has(key)) {
            mesesMap.set(key, {
              vendas: Number(row.vendas ?? 0),
              devolucoes: Number(row.devolucoes ?? 0),
            });
          }
        }

        const NOMES = ["Jan","Fev","Mar","Abr","Mai","Jun",
                       "Jul","Ago","Set","Out","Nov","Dez"];

        const resultado = Array.from(mesesMap.entries())
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
        const { data, error } = await rpc("get_vendas_tipo_pessoa", {
          p_loja_ids: lojaIds,
          p_start: start,
          p_end: end,
        });

        if (error) {
          console.error("[charts/vendas-tipo-cliente] erro RPC:", error.message);
          return NextResponse.json({ pf: { total: 0, clientes: 0 }, pj: { total: 0, clientes: 0 } });
        }

        let pfTotal = 0, pfCount = 0;
        let pjTotal = 0, pjCount = 0;

        for (const row of (data ?? []) as Record<string, unknown>[]) {
          if (row.tipo_pessoa === "PJ") {
            pjTotal = Number(row.total_valor ?? 0);
            pjCount = Number(row.total_vendas ?? 0);
          } else {
            pfTotal = Number(row.total_valor ?? 0);
            pfCount = Number(row.total_vendas ?? 0);
          }
        }

        return NextResponse.json({
          pf: { total: pfTotal, clientes: pfCount },
          pj: { total: pjTotal, clientes: pjCount },
        });
      }

      case "formas-pagamento": {
        const { data, error } = await rpc("get_formas_pagamento", {
          p_loja_ids: lojaIds,
          p_start: start,
          p_end: end,
        });

        if (error) {
          console.error("[charts/formas-pagamento] erro RPC:", error.message);
          return NextResponse.json([]);
        }

        if (!data?.length) return NextResponse.json([]);

        const rows = data as Record<string, unknown>[];
        const totalGeral = rows.reduce((acc, r) => acc + Number(r.total_valor ?? 0), 0);

        const resultado = rows.map((r) => ({
          nome: (r.forma_pagamento as string) ?? "Outros",
          valor: Number(r.total_valor ?? 0),
          percentual: totalGeral > 0
            ? parseFloat(((Number(r.total_valor) / totalGeral) * 100).toFixed(1))
            : 0,
        }));

        return NextResponse.json(resultado);
      }

      case "top-produtos": {
        const { data: itensAgregados, error: errItens } = await rpc("get_top_produtos", {
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
        const { data: clientesAgregados, error: errClientes } = await rpc("get_top_clientes", {
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
        const { data: vendasAgregadas, error } = await rpc("get_top_vendedores", {
          p_loja_ids: lojaIds,
          p_start: start,
          p_end: end,
          p_limit: 10,
        });

        if (error) {
          console.error("[charts/top-vendedores] erro RPC:", error.message);
          return NextResponse.json([]);
        }

        if (!vendasAgregadas?.length) return NextResponse.json([]);

        const vendedorIds = (vendasAgregadas as Record<string, unknown>[])
          .map((v) => v.atendente_id)
          .filter(Boolean);

        const { data: vendedores } = await supabase
          .from("vendedores")
          .select("external_id, nome, apelido")
          .in("loja_id", lojaIds)
          .in("external_id", vendedorIds.map(String));

        const nomeMap = new Map(
          (vendedores ?? []).map((v) => [
            Number(v.external_id),
            (v.nome as string) ?? `Vendedor ${v.external_id}`,
          ])
        );

        const resultado = (vendasAgregadas as Record<string, unknown>[]).map((v) => ({
          vendedorId: Number(v.atendente_id),
          nome: nomeMap.get(Number(v.atendente_id)) ?? `Vendedor ${v.atendente_id}`,
          valor: Number(v.total_valor),
          quantidade: Number(v.total_vendas),
          ticketMedio: Number(v.ticket_medio),
        }));

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
