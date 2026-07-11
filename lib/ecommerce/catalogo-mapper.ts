/**
 * Mapeamento ERP (MaxManager) → catálogo do lc-storefront.
 *
 * Módulo puro, sem I/O, para ser testável: é aqui que moram as regras que
 * historicamente causaram bug em produção neste ecossistema (assumir semântica
 * de coluna do ERP sem validar).
 */

/** Linha crua de LIST_ECOMMERCE_PRODUCTS (bridge SQL). */
export interface EcommerceProductRow {
  proId: number;
  proDescricao: string | null;
  proAplicacao: string | null;
  proUn: string | null;
  proCodigo: string | null;
  proVenda: number | null;
  proEstoqueAtual: number | null;
  grupoNome: string | null;
  subGrupoNome: string | null;
  marcaNome: string | null;
}

export type Disponibilidade = "em_estoque" | "ultimas_unidades" | "indisponivel";

/** Linha de `ecom_produtos` no Supabase. */
export interface EcomProdutoInsert {
  loja_id: string;
  external_id: number;
  slug: string;
  nome: string;
  descricao: string | null;
  codigo: string | null;
  preco: number;
  unidade: string | null;
  grupo_nome: string | null;
  subgrupo_nome: string | null;
  marca_nome: string | null;
  disponibilidade: Disponibilidade;
  publicado: boolean;
  sincronizado_em: string;
}

/** Abaixo disto, a vitrine avisa que está acabando em vez de prometer estoque. */
export const LIMITE_ULTIMAS_UNIDADES = 3;

export function disponibilidadeDe(estoque: number | null): Disponibilidade {
  const qtd = Number(estoque ?? 0);
  if (!Number.isFinite(qtd) || qtd <= 0) return "indisponivel";
  if (qtd <= LIMITE_ULTIMAS_UNIDADES) return "ultimas_unidades";
  return "em_estoque";
}

/**
 * Slug estável e único por loja. O `proId` no fim garante unicidade mesmo com
 * dois produtos de mesmo nome — sem ele, o UNIQUE (loja_id, slug) derrubaria o
 * sync inteiro por causa de uma descrição duplicada no ERP.
 */
export function slugDoProduto(nome: string, proId: number): string {
  const base = nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

  return base ? `${base}-${proId}` : String(proId);
}

/** Trata '' do ERP como ausência de valor (os ISNULL da query devolvem ''). */
function ouNulo(valor: string | null): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

/**
 * Converte uma linha do ERP numa linha de `ecom_produtos`.
 *
 * Devolve null quando a linha não é publicável — hoje, produto sem descrição ou
 * sem preço. A query já filtra `proVenda > 0`, mas dado de ERP surpreende:
 * melhor pular a linha do que gravar um produto sem nome ou de graça na vitrine.
 */
export function mapearProduto(
  row: EcommerceProductRow,
  lojaId: string,
  sincronizadoEm: string,
): EcomProdutoInsert | null {
  const nome = ouNulo(row.proDescricao);
  const preco = Number(row.proVenda ?? 0);

  if (!nome) return null;
  if (!Number.isFinite(preco) || preco <= 0) return null;

  return {
    loja_id: lojaId,
    external_id: row.proId,
    slug: slugDoProduto(nome, row.proId),
    nome,
    descricao: ouNulo(row.proAplicacao),
    codigo: ouNulo(row.proCodigo),
    preco,
    unidade: ouNulo(row.proUn),
    grupo_nome: ouNulo(row.grupoNome),
    subgrupo_nome: ouNulo(row.subGrupoNome),
    marca_nome: ouNulo(row.marcaNome),
    disponibilidade: disponibilidadeDe(row.proEstoqueAtual),
    // A query só devolve produto com proUsaEcommerce = 1; o que perde o flag no
    // ERP some do resultado e é despublicado à parte, não deletado.
    publicado: true,
    sincronizado_em: sincronizadoEm,
  };
}
