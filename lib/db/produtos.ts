// Consultas ao Supabase para o módulo de produtos e estoque
// Usa createClient (respeita RLS — dados isolados por sessão)

import { createClient } from "@/lib/supabase/server";

// ── Tipos exportados ───────────────────────────────────────────────────────

export type FiltroProduto = "todos" | "ruptura" | "critico" | "normal";

export type ProdutoItem = {
  id: string;
  externalId: number;
  nome: string;
  codigo: string | null;
  grupoNome: string | null;
  fabricante: string | null;
  precoVenda: number | null;
  valorCusto: number | null;
  estoqueAtual: number;
  estoqueMinimo: number;
  ativo: boolean;
  statusEstoque: "ruptura" | "critico" | "normal";
  usaEcommerce: boolean;
  subGrupoNome: string | null;
  peso: number | null;
  largura: number | null;
  altura: number | null;
  comprimento: number | null;
};

export type ResumoProdutos = {
  totalAtivos: number;
  totalRuptura: number;       // estoque_atual <= 0
  totalCritico: number;       // 0 < estoque_atual <= estoque_minimo (quando estoqueMinimo > 0)
  totalNormal: number;
  valorTotalEstoque: number;  // soma de estoque_atual * preco_venda para produtos ativos com ambos > 0
  gruposUnicos: number;
};

// ── Helper interno ─────────────────────────────────────────────────────────

function calcularStatus(
  estoqueAtual: number,
  estoqueMinimo: number
): "ruptura" | "critico" | "normal" {
  if (estoqueAtual <= 0) return "ruptura";
  if (estoqueMinimo > 0 && estoqueAtual <= estoqueMinimo) return "critico";
  return "normal";
}

// ── Funções de consulta ────────────────────────────────────────────────────

export async function getResumoProdutos(lojaId: string): Promise<ResumoProdutos> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("produtos")
    .select("estoque_atual, estoque_minimo, preco_venda, grupo_nome")
    .eq("loja_id", lojaId)
    .eq("ativo", true);

  const registros = data ?? [];

  const grupos = new Set<string>();
  let totalRuptura = 0;
  let totalCritico = 0;
  let totalNormal = 0;
  let valorTotalEstoque = 0;

  for (const r of registros) {
    const estoqueAtual = (r.estoque_atual as number) ?? 0;
    const estoqueMinimo = (r.estoque_minimo as number) ?? 0;
    const precoVenda = (r.preco_venda as number | null) ?? null;
    const grupoNome = r.grupo_nome as string | null;

    const status = calcularStatus(estoqueAtual, estoqueMinimo);

    if (status === "ruptura") totalRuptura++;
    else if (status === "critico") totalCritico++;
    else totalNormal++;

    // Valor em estoque apenas quando ambos são positivos
    if (estoqueAtual > 0 && precoVenda !== null && precoVenda > 0) {
      valorTotalEstoque += estoqueAtual * precoVenda;
    }

    if (grupoNome) grupos.add(grupoNome);
  }

  return {
    totalAtivos: registros.length,
    totalRuptura,
    totalCritico,
    totalNormal,
    valorTotalEstoque,
    gruposUnicos: grupos.size,
  };
}

export async function getProdutos(
  lojaId: string,
  filtro: FiltroProduto,
  busca?: string
): Promise<ProdutoItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("produtos")
    .select(
      "id, external_id, nome, codigo, grupo_nome, sub_grupo_nome, fabricante, preco_venda, valor_custo, estoque_atual, estoque_minimo, ativo, usa_ecommerce, peso, largura, altura, comprimento"
    )
    .eq("loja_id", lojaId)
    .eq("ativo", true)
    .limit(200);

  // Filtro de estoque na query — reduz volume de dados retornados
  if (filtro === "ruptura") {
    query = query.lte("estoque_atual", 0).order("nome");
  } else if (filtro === "critico") {
    // Filtrar na query o intervalo geral; refinamento por estoque <= minimo feito no JS
    query = query.gt("estoque_atual", 0).gt("estoque_minimo", 0).order("estoque_atual");
  } else {
    // 'todos' e 'normal' buscam tudo ordenado por nome; filtro JS separa normal
    query = query.order("nome");
  }

  // Busca textual por nome do produto
  if (busca) {
    query = query.ilike("nome", `%${busca}%`);
  }

  const { data } = await query;
  const registros = data ?? [];

  // Mapear e calcular status
  const itens: ProdutoItem[] = registros.map((r) => {
    const estoqueAtual = (r.estoque_atual as number) ?? 0;
    const estoqueMinimo = (r.estoque_minimo as number) ?? 0;

    return {
      id: r.id as string,
      externalId: r.external_id as number,
      nome: r.nome as string,
      codigo: (r.codigo as string | null) ?? null,
      grupoNome: (r.grupo_nome as string | null) ?? null,
      fabricante: (r.fabricante as string | null) ?? null,
      precoVenda: (r.preco_venda as number | null) ?? null,
      valorCusto: (r.valor_custo as number | null) ?? null,
      estoqueAtual,
      estoqueMinimo,
      ativo: r.ativo as boolean,
      statusEstoque: calcularStatus(estoqueAtual, estoqueMinimo),
      usaEcommerce: (r.usa_ecommerce as boolean) ?? false,
      subGrupoNome: (r.sub_grupo_nome as string | null) ?? null,
      peso: (r.peso as number | null) ?? null,
      largura: (r.largura as number | null) ?? null,
      altura: (r.altura as number | null) ?? null,
      comprimento: (r.comprimento as number | null) ?? null,
    };
  });

  // Refinamento JS para 'critico' (estoque_atual <= estoque_minimo) e 'normal'
  if (filtro === "critico") {
    return itens.filter((p) => p.statusEstoque === "critico");
  }
  if (filtro === "normal") {
    return itens.filter((p) => p.statusEstoque === "normal");
  }

  return itens;
}
