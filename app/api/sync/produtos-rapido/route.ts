// Atualização rápida de produtos — estoque, preço e flags sem reimportar tudo
// Processa as primeiras 30 páginas (1.500 produtos) por chamada

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { getLojaConfig } from "@/lib/db/tenants";
import { getMaxDataToken } from "@/lib/maxdata/client";

interface MaxDataProduto {
  id: number;
  descricao?: string;
  codigoFab?: string;
  grupoId?: number | null;
  grupo?: string | null;
  subGrupoId?: number | null;
  subGrupo?: string | null;
  fabricante?: string | null;
  valorVenda?: number | null;
  valorCusto?: number | null;
  estoque?: number;
  estoqueMinimo?: number;
  desativado?: boolean;
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

const MAX_PAGINAS = 30;
const DELAY_MS = 300;

export async function POST() {
  try {
    // Verificar autenticação
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const lojaId = await getSelectedLojaId();
    if (!lojaId) {
      return NextResponse.json({ error: "Selecione uma loja" }, { status: 400 });
    }

    const config = await getLojaConfig(lojaId);
    const token = await getMaxDataToken(config);
    const adminClient = createAdminClient();

    const resultados: MaxDataProduto[] = [];
    let paginasProcessadas = 0;

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

      resultados.push(...data.docs);
      paginasProcessadas++;

      if (page >= (data.pages ?? 1)) break;

      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    // Deduplicar por external_id antes do upsert
    const seen = new Set<number>();
    const unicos = resultados.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    if (unicos.length > 0) {
      const agora = new Date().toISOString();
      const rows = unicos.map((p) => ({
        loja_id: lojaId,
        external_id: p.id,
        nome: p.descricao ?? "Sem nome",
        codigo: p.codigoFab || null,
        grupo_id: p.grupoId ?? null,
        grupo_nome: p.grupo ?? null,
        sub_grupo_id: p.subGrupoId ?? null,
        sub_grupo_nome: p.subGrupo ?? null,
        fabricante: p.fabricante ?? null,
        preco_venda: p.valorVenda ?? null,
        valor_custo: p.valorCusto ?? null,
        estoque_atual: p.estoque ?? 0,
        estoque_minimo: p.estoqueMinimo ?? 0,
        ativo: !(p.desativado ?? false),
        usa_ecommerce: p.usaEcommerce ?? p.ecommerce ?? false,
        peso: p.peso ?? null,
        peso_liq: p.pesoLiq ?? null,
        largura: p.largura ?? null,
        altura: p.altura ?? null,
        comprimento: p.comprimento ?? null,
        sincronizado_em: agora,
      }));

      // Upsert em lotes de 200
      const LOTE = 200;
      for (let i = 0; i < rows.length; i += LOTE) {
        const { error } = await adminClient
          .from("produtos")
          .upsert(rows.slice(i, i + LOTE), { onConflict: "loja_id,external_id" });

        if (error) throw new Error(`Erro ao salvar produtos: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      atualizados: unicos.length,
      paginasProcessadas,
      message: "Produtos atualizados. Execute novamente para continuar.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
