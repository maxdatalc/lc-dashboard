import { NextRequest, NextResponse } from "next/server";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { createClient } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";
import { requireTenantAccess } from "@/lib/api/tenant-guard";

interface ProdutoRanking {
  nome: string;
  quantidade: number;
  total: number;
}

function limitesMesAtual(): { dataInicio: string; dataFim: string } {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const ultimo = new Date(ano, mes + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    dataInicio: `${ano}-${pad(mes + 1)}-01`,
    dataFim: `${ano}-${pad(mes + 1)}-${pad(ultimo)}`,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const { dataInicio: fallbackInicio, dataFim: fallbackFim } = limitesMesAtual();
  const dataInicio = searchParams.get("dataInicio") ?? fallbackInicio;
  const dataFim = searchParams.get("dataFim") ?? fallbackFim;

  const lojaId = await getSelectedLojaId();
  if (!lojaId) {
    return NextResponse.json({ error: "Selecione uma loja no dashboard" }, { status: 400 });
  }

  const guard = await requireTenantAccess([lojaId]);
  if (guard instanceof NextResponse) return guard;

  const chave = `dashboard:top-produtos:${lojaId}:${dataInicio}:${dataFim}`;

  // Tentar cache Redis antes de bater no banco
  const cached = await redis.get(chave);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const supabase = await createClient();

    // Passo 1 — busca os IDs das vendas finalizadas no período
    const { data: vendas, error: erroVendas } = await supabase
      .from("vendas")
      .select("external_id")
      .eq("loja_id", lojaId)
      .gte("data_venda", dataInicio)
      .lte("data_venda", dataFim)
      .neq("status", "cancelada");

    if (erroVendas || !vendas || vendas.length === 0) {
      return NextResponse.json([]);
    }

    const vendaIds = vendas.map((v) => v.external_id);

    // Passo 2 — busca os itens dessas vendas
    const { data: itens, error: erroItens } = await supabase
      .from("venda_itens")
      .select("produto_external_id, produto_nome, quantidade, valor_total")
      .eq("loja_id", lojaId)
      .in("venda_external_id", vendaIds);

    if (erroItens || !itens || itens.length === 0) {
      return NextResponse.json([]);
    }

    // Passo 3 — agrega por produto
    const agregado = new Map<number, ProdutoRanking>();

    for (const item of itens) {
      const id = item.produto_external_id as number;
      if (!id) continue;

      if (!agregado.has(id)) {
        agregado.set(id, {
          nome: item.produto_nome ?? "Produto",
          quantidade: 0,
          total: 0,
        });
      }

      const entry = agregado.get(id)!;
      entry.quantidade += Number(item.quantidade ?? 0);
      entry.total += Number(item.valor_total ?? 0);
    }

    const resultado: ProdutoRanking[] = Array.from(agregado.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Cachear por 30 minutos
    await redis.setex(chave, 1800, JSON.stringify(resultado));

    return NextResponse.json(resultado);
  } catch {
    return NextResponse.json([]);
  }
}
