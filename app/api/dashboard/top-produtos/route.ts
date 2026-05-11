// API route para buscar top produtos do período via MaxData com cache Redis
// Disponível para todas as ambientes (dados são cacheados 30 min)

import { NextRequest, NextResponse } from "next/server";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { getLojaConfig } from "@/lib/db/tenants";
import { getMaxDataToken } from "@/lib/maxdata/client";
import { redis } from "@/lib/redis";

interface ProdutoRanking {
  nome: string;
  quantidade: number;
  total: number;
}

interface SummaryItem {
  descricao?: string;
  qtd?: number;
  total?: number;
}

interface SummaryResponse {
  docs?: SummaryItem[];
}

// Calcula primeiro e último dia do mês atual como fallback
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
    return NextResponse.json(
      { error: "Selecione uma loja no dashboard" },
      { status: 400 }
    );
  }

  const chave = `dashboard:top-produtos:${lojaId}:${dataInicio}:${dataFim}`;

  // Tentar cache Redis antes de bater na API da loja
  const cached = await redis.get(chave);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const config = await getLojaConfig(lojaId);
    const token = await getMaxDataToken(config);

    const response = await fetch(
      `${config.baseUrl}/v2/summary?data_inicial=${dataInicio}&data_final=${dataFim}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!response.ok) {
      // Retornar vazio sem quebrar o dashboard
      return NextResponse.json([]);
    }

    const data = (await response.json()) as SummaryResponse;
    const docs = data.docs ?? [];

    const resultado: ProdutoRanking[] = docs
      .map((item) => ({
        nome: item.descricao ?? "Produto",
        quantidade: item.qtd ?? 0,
        total: item.total ?? 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Cachear por 30 minutos
    await redis.setex(chave, 1800, JSON.stringify(resultado));

    return NextResponse.json(resultado);
  } catch {
    // Erros da API da loja não quebram o dashboard
    return NextResponse.json([]);
  }
}
