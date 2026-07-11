import { queryBridge } from "@/lib/bridge/bridge-client";
import { resolveNamedQuery } from "@/lib/bridge/named-queries";
import { getLojaDbConfig } from "@/lib/db/tenants";
import { createAdminClient } from "@/lib/supabase/server";

import {
  type EcomProdutoInsert,
  type EcommerceProductRow,
  mapearProduto,
} from "./catalogo-mapper";

const LOTE = 200;

export interface ResultadoLoja {
  lojaId: string;
  slug: string;
  produtos: number;
  removidos: number;
  erro?: string;
}

/**
 * Sincroniza o catálogo do e-commerce (MaxManager → Supabase).
 *
 * Roda AQUI, no lc-dashboard, e não no lc-storefront: só este projeto tem a
 * service role, a ENCRYPTION_KEY e as credenciais de bridge por loja. A vitrine
 * é um deploy público e permanece 100% leitura, com anon key sob RLS.
 *
 * Isto é o que mantém o SQL Server do cliente fora do caminho quente: a vitrine
 * lê o Supabase (e serve de cache); o ERP é consultado 1 vez por loja por
 * execução, não a cada pageview.
 */
export async function sincronizarCatalogo(): Promise<ResultadoLoja[]> {
  const supabase = createAdminClient();

  const { data: vitrines, error } = await supabase
    .from("ecom_lojas")
    .select("loja_id, slug");

  if (error) throw new Error(`Falha ao listar vitrines: ${error.message}`);

  const resultados: ResultadoLoja[] = [];

  for (const vitrine of (vitrines ?? []) as { loja_id: string; slug: string }[]) {
    try {
      resultados.push(await sincronizarLoja(vitrine.loja_id, vitrine.slug));
    } catch (err) {
      // Isolamento por loja: uma bridge fora do ar não pode derrubar as outras.
      const mensagem = err instanceof Error ? err.message : String(err);
      console.error(`[ecommerce-sync] loja ${vitrine.slug} falhou: ${mensagem}`);
      resultados.push({
        lojaId: vitrine.loja_id,
        slug: vitrine.slug,
        produtos: 0,
        removidos: 0,
        erro: mensagem,
      });
    }
  }

  return resultados;
}

async function sincronizarLoja(lojaId: string, slug: string): Promise<ResultadoLoja> {
  const config = await getLojaDbConfig(lojaId);
  if (!config) throw new Error("bridge SQL não configurada para esta loja");

  const inicio = new Date().toISOString();

  const { sql, params } = resolveNamedQuery("LIST_ECOMMERCE_PRODUCTS", { empId: config.empId });
  const linhas = await queryBridge<EcommerceProductRow>(
    { url: config.bridgeUrl, token: config.token },
    sql,
    params,
  );

  const produtos = linhas
    .map((linha) => mapearProduto(linha, lojaId, inicio))
    .filter((p): p is EcomProdutoInsert => p !== null);

  const supabase = createAdminClient();

  for (let i = 0; i < produtos.length; i += LOTE) {
    const lote = produtos.slice(i, i + LOTE);
    const { error } = await supabase
      .from("ecom_produtos")
      .upsert(lote, { onConflict: "loja_id,external_id" });

    if (error) throw new Error(`upsert falhou: ${error.message}`);
  }

  const removidos = await removerAusentes(lojaId, inicio);

  await revalidarVitrine(slug);

  return { lojaId, slug, produtos: produtos.length, removidos };
}

/**
 * Produto que perdeu o flag `proUsaEcommerce` no ERP some do resultado da query
 * e é APAGADO do Supabase (as imagens vão junto, por ON DELETE CASCADE).
 *
 * `ecom_produtos` é uma projeção do ERP, não um registro histórico: projeção que
 * acumula linha morta é projeção que mente, e ainda paga armazenamento por isso.
 *
 * CONSEQUÊNCIA PARA A FASE 3: o item do pedido tem de guardar a PRÓPRIA cópia de
 * nome, preço e external_id, sem FK para `ecom_produtos`. Fora isso, desmarcar um
 * produto no ERP apagaria o histórico de quem já comprou. (O pedido precisa
 * congelar o preço da compra de qualquer forma — aqui isso vira obrigatório.)
 *
 * A detecção é por `sincronizado_em`: o upsert acima carimba todas as linhas
 * presentes com o timestamp desta execução, então o que ficou para trás é
 * exatamente o que sumiu do ERP. Evita montar um `NOT IN (...)` gigante.
 *
 * Resultado vazio é verdade, não erro: `queryBridge` lança em falha de rede/SQL,
 * então zero linhas significa mesmo que nenhum produto está marcado para
 * e-commerce — e aí a vitrine daquela loja fica (corretamente) vazia.
 */
async function removerAusentes(lojaId: string, inicio: string): Promise<number> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ecom_produtos")
    .delete()
    .eq("loja_id", lojaId)
    .lt("sincronizado_em", inicio)
    .select("id");

  if (error) throw new Error(`remoção falhou: ${error.message}`);
  return data?.length ?? 0;
}

/**
 * Avisa a vitrine que o catálogo daquela loja mudou. É o que permite as páginas
 * serem servidas inteiramente de cache sem ficarem velhas.
 *
 * Falha aqui não invalida o sync: os dados já estão no Supabase, e o cache
 * expira sozinho pelo cacheLife. Por isso apenas loga.
 */
async function revalidarVitrine(slug: string): Promise<void> {
  const raiz = process.env.STOREFRONT_ROOT_DOMAIN;
  const segredo = process.env.STOREFRONT_REVALIDATE_SECRET;

  if (!raiz || !segredo) {
    console.warn("[ecommerce-sync] revalidação da vitrine não configurada — pulando");
    return;
  }

  try {
    const res = await fetch(`https://${slug}.${raiz}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${segredo}`,
      },
      body: JSON.stringify({ slug }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error(`[ecommerce-sync] revalidação de ${slug} devolveu HTTP ${res.status}`);
    }
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error(`[ecommerce-sync] revalidação de ${slug} falhou: ${mensagem}`);
  }
}