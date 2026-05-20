// Sincronização completa de produtos — roda no Node.js (Next.js)
// Busca todo o catálogo da API MaxData e salva no Supabase

import { getLojaConfig } from "@/lib/db/tenants";
import { getMaxDataToken } from "@/lib/maxdata/client";
import { createAdminClient } from "@/lib/supabase/server";

export interface ProdutoSyncResult {
  total: number;
  erro?: string;
}

interface MaxDataProduto {
  id: number;
  descricao?: string;       // nome do produto — campo correto na API
  codigoFab?: string;
  grupoId?: number | null;
  grupo?: string | null;    // nome do grupo — campo correto na API
  subGrupoId?: number | null;
  subGrupo?: string | null;
  fabricante?: string | null;
  valorVenda?: number | null;   // preço de venda — campo correto na API
  valorCusto?: number | null;
  estoque?: number;
  estoqueMinimo?: number;
  desativado?: boolean;     // INVERTIDO: true = produto inativo
  usaEcommerce?: boolean;
  ecommerce?: boolean;
  peso?: number | null;
  pesoLiq?: number | null;
  largura?: number | null;
  altura?: number | null;
  comprimento?: number | null;
}

interface PaginatedResponse {
  docs: MaxDataProduto[];
  pages: number;
  total: number;
}

export async function syncTodosProdutos(lojaId: string): Promise<ProdutoSyncResult> {
  try {
    const config = await getLojaConfig(lojaId);
    const token = await getMaxDataToken(config);

    // Paginação manual — loop com fetch nativo do Node.js
    const results: MaxDataProduto[] = [];
    const MAX_PAGINAS = 500;

    for (let page = 1; page <= MAX_PAGINAS; page++) {
      const url = `${config.baseUrl}/v2/product?page=${page}&limit=50&sincronizacao=true`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`Erro na API MaxData: HTTP ${response.status}`);
      }

      const data = (await response.json()) as PaginatedResponse;

      if (!data.docs || data.docs.length === 0) break;

      results.push(...data.docs);

      if (page >= (data.pages ?? 1)) break;

      // Pausa entre páginas para não sobrecarregar a API da loja
      await new Promise((r) => setTimeout(r, 100));
    }

    if (results.length === 0) {
      return { total: 0 };
    }

    // Deduplicar por external_id mantendo a primeira ocorrência
    const seen = new Set<number>();
    const unicos = results.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    const agora = new Date().toISOString();
    const rows = unicos.map((p) => ({
      loja_id: lojaId,
      external_id: p.id,
      nome: p.descricao ?? "Sem nome",
      codigo: p.codigoFab || null,
      grupo_id: p.grupoId ?? null,
      grupo_nome: p.grupo ?? null,
      fabricante: p.fabricante ?? null,
      preco_venda: p.valorVenda ?? null,
      valor_custo: p.valorCusto ?? null,
      estoque_atual: p.estoque ?? 0,
      estoque_minimo: p.estoqueMinimo ?? 0,
      ativo: !(p.desativado ?? false),  // campo API é "desativado" — inverter para "ativo"
      usa_ecommerce: p.usaEcommerce ?? p.ecommerce ?? false,
      sub_grupo_id: p.subGrupoId ?? null,
      sub_grupo_nome: p.subGrupo ?? null,
      peso: p.peso ?? null,
      peso_liq: p.pesoLiq ?? null,
      largura: p.largura ?? null,
      altura: p.altura ?? null,
      comprimento: p.comprimento ?? null,
      sincronizado_em: agora,
    }));

    // Inserir em lotes de 200 para evitar payload grande
    const supabase = createAdminClient();
    const LOTE = 200;

    for (let i = 0; i < rows.length; i += LOTE) {
      const lote = rows.slice(i, i + LOTE);
      const { error } = await supabase
        .from("produtos")
        .upsert(lote, { onConflict: "loja_id,external_id" });

      if (error) throw new Error(`Erro ao salvar produtos: ${error.message}`);
    }

    return { total: unicos.length };
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "Erro desconhecido";
    return { total: 0, erro: mensagem };
  }
}
