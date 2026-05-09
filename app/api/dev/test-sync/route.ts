// Rota de teste para validar a pipeline completa: loja → token → API → Supabase
// Busca apenas a primeira página de produtos e salva no banco
// Disponível apenas em desenvolvimento — retorna 404 em produção

import { NextResponse } from "next/server";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { getLojaConfig } from "@/lib/db/tenants";
import { getMaxDataToken } from "@/lib/maxdata/client";
import { createAdminClient } from "@/lib/supabase/server";

interface MaxDataProduto {
  id: number;
  codigo?: string;
  nome?: string;
  descricao?: string;
  precoVenda?: number;
  valor?: number;
  estoque?: number;
  saldoEstoque?: number;
  ativo?: boolean;
}

interface MaxDataProdutosResponse {
  docs: MaxDataProduto[];
  pages: number;
  total: number;
}

export async function GET(): Promise<NextResponse> {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(null, { status: 404 });
  }

  const lojaId = await getSelectedLojaId();
  if (!lojaId) {
    return NextResponse.json(
      { success: false, error: "Selecione uma loja no dashboard" },
      { status: 400 }
    );
  }

  const inicio = Date.now();

  try {
    // Obter credenciais da loja e autenticar na API MaxData
    const config = await getLojaConfig(lojaId);
    const token = await getMaxDataToken(config);

    // Buscar apenas a primeira página de produtos para validar a conexão
    const url = `${config.baseUrl}/v2/product?page=1&limit=20&sincronizacao=true`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Erro na API MaxData: HTTP ${response.status}`);
    }

    const data = (await response.json()) as MaxDataProdutosResponse;
    const tempoApi = Date.now() - inicio;

    let produtosSalvos = false;

    if (data.docs && data.docs.length > 0) {
      const agora = new Date().toISOString();
      const records = data.docs.map((produto) => ({
        loja_id: lojaId,
        external_id: produto.id,
        nome: produto.nome ?? produto.descricao ?? "Sem nome",
        codigo: produto.codigo ?? null,
        preco_venda: produto.precoVenda ?? produto.valor ?? null,
        estoque_atual: produto.estoque ?? produto.saldoEstoque ?? 0,
        ativo: produto.ativo ?? true,
        sincronizado_em: agora,
      }));

      const supabase = createAdminClient();
      const { error } = await supabase
        .from("produtos")
        .upsert(records, { onConflict: "loja_id,external_id" });

      if (error) throw new Error(`Erro ao salvar produtos: ${error.message}`);

      produtosSalvos = true;
    }

    const tempoTotal = Date.now() - inicio;

    return NextResponse.json({
      success: true,
      totalProdutos: data.docs?.length ?? 0,
      paginasDisponiveis: data.pages ?? 0,
      tempoApiMs: tempoApi,
      tempoTotalMs: tempoTotal,
      produtosSalvos,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[test-sync] Falha:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
