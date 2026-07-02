// ─────────────────────────────────────────────────────────────────────────────
// Dashboard de Produtos & Estoque — camada de dados (SQL bridge / MaxManager)
//
// Fonte no MaxManager (BATAUTO):
//   produto          → catálogo mestre (proId, proDescricao, proGrupo→grupoProd,
//                      proSubGrupo→subGrupoProd, proFab→fabricante, proTipo 'P'/'S')
//   produto_empresa  → posição por FILIAL (empId + proId): proEstoqueAtual, proCusto,
//                      proVenda, proEstoqueMin, proCodigo, proDesativaProd (0=ativo, -1=inativo)
//   grupoProd        → gdpId, gdpNome            (mapeado como "Grupo")
//   subGrupoProd     → sgpId, sgpNome            (mapeado como "Categoria")
//   fabricante       → fabId, fabNome            (mapeado como "Marca")
//
// Cada linha de produto_empresa é uma POSIÇÃO (produto × filial). Em multilojas os
// valores são consolidados somando as posições das filiais selecionadas — custo e
// venda são próprios de cada filial, então a soma reflete o capital real por loja.
//
// Todas as agregações são feitas em SQL; o cliente recebe dados prontos. Os filtros
// de cross-filtering (marca, grupo, categoria, status, busca) são aplicados no
// servidor para que KPIs, rankings e tabela sejam sempre coerentes entre si.
// ─────────────────────────────────────────────────────────────────────────────

import { queryBridge, queryDev, type BridgeConfig } from "@/lib/mssql/client";

export const SEM_MARCA = "Sem marca";
export const SEM_GRUPO = "Sem grupo";
export const SEM_CATEGORIA = "Sem categoria";

export type StatusEstoque =
  | "abaixo"      // estoque < mínimo (mínimo informado)
  | "acima"       // estoque > mínimo (mínimo informado)
  | "semMin"      // mínimo não informado
  | "negativo"    // estoque < 0
  | "margemNeg"   // venda < custo
  | "regular";    // dentro do parâmetro

export interface ProdutosFilters {
  marca?: string | null;
  grupo?: string | null;
  categoria?: string | null;
  status?: StatusEstoque | null;
  busca?: string | null;
}

export interface RankItem {
  nome: string;
  custo: number;
  venda: number;
  qtd: number;
}

export interface ProblemaMargem {
  proId: number;
  nome: string;
  custo: number;
  venda: number;
  margemPct: number;
}

export interface ProblemaNegativo {
  proId: number;
  nome: string;
  marca: string;
  saldo: number;
}

export interface ProdutoAcao {
  proId: number;
  codigo: string | null;
  nome: string;
  marca: string;
  categoria: string;
  grupo: string;
  empId: number;
  estoqueAtual: number;
  estoqueMinimo: number | null;
  diferenca: number | null;
  custoUnit: number;
  vendaUnit: number;
  valorCusto: number;
  valorVenda: number;
  margemPct: number | null;
  status: StatusEstoque;
}

export interface ProdutosKpis {
  totalPosicoes: number;
  valorCusto: number;
  valorVenda: number;
  margemPotencial: number;
  abaixoMin: number;
  acimaMin: number;
  semMin: number;
  negativo: number;
  margemNeg: number;
  regular: number;
}

export interface ProdutosOverview {
  kpis: ProdutosKpis;
  topMarcasValor: RankItem[];
  porMarcaQtd: RankItem[];
  topCategoriasValor: RankItem[];
  porGrupoQtd: RankItem[];
  margemNegativa: ProblemaMargem[];
  estoqueNegativo: ProblemaNegativo[];
  exigeAcao: ProdutoAcao[];
}

// ── Execução: usa banco local (queryDev) em dev; bridge do cliente em produção ──

function runQuery<T>(cfg: BridgeConfig, sql: string, params?: Record<string, unknown>): Promise<T[]> {
  if (process.env.MSSQL_HOST) return queryDev<T>(sql, params);
  return queryBridge<T>(cfg, sql, params);
}

// ── Fragmento de filtro compartilhado por todas as queries ─────────────────────
// Retorna um pedaço de SQL (WHERE extra) + os parâmetros escalares associados.
// empList é uma lista de inteiros já sanitizada (fonte própria) — seguro inlinar.

function statusSql(status: StatusEstoque): string {
  switch (status) {
    case "abaixo":    return "AND pe.proEstoqueMin > 0 AND pe.proEstoqueAtual < pe.proEstoqueMin";
    case "acima":     return "AND pe.proEstoqueMin > 0 AND pe.proEstoqueAtual > pe.proEstoqueMin";
    case "semMin":    return "AND (pe.proEstoqueMin IS NULL OR pe.proEstoqueMin <= 0)";
    case "negativo":  return "AND pe.proEstoqueAtual < 0";
    case "margemNeg": return "AND pe.proVenda < pe.proCusto AND pe.proCusto > 0";
    case "regular":
      return (
        "AND pe.proEstoqueAtual >= 0 " +
        "AND NOT (pe.proVenda < pe.proCusto AND pe.proCusto > 0) " +
        "AND (pe.proEstoqueMin IS NULL OR pe.proEstoqueMin <= 0 OR pe.proEstoqueAtual >= pe.proEstoqueMin)"
      );
  }
}

function buildFilter(
  empList: string,
  f: ProdutosFilters,
): { where: string; params: Record<string, unknown> } {
  const parts: string[] = [
    `pe.empId IN (${empList})`,
    "p.proTipo = 'P'",
    "pe.proDesativaProd = 0",
  ];
  const params: Record<string, unknown> = {};

  if (f.marca) {
    if (f.marca === SEM_MARCA) parts.push("f.fabNome IS NULL");
    else { parts.push("f.fabNome = @marca"); params.marca = f.marca; }
  }
  if (f.grupo) {
    if (f.grupo === SEM_GRUPO) parts.push("g.gdpNome IS NULL");
    else { parts.push("g.gdpNome = @grupo"); params.grupo = f.grupo; }
  }
  if (f.categoria) {
    if (f.categoria === SEM_CATEGORIA) parts.push("s.sgpNome IS NULL");
    else { parts.push("s.sgpNome = @categoria"); params.categoria = f.categoria; }
  }
  if (f.status) parts.push(statusSql(f.status).replace(/^AND /, ""));
  if (f.busca) {
    parts.push("(p.proDescricao LIKE @busca OR pe.proCodigo LIKE @busca)");
    params.busca = `%${f.busca}%`;
  }

  return { where: parts.join(" AND "), params };
}

// JOINs presentes em todas as queries (dimensões usadas por filtro e rótulos)
const JOINS = `
  FROM produto_empresa pe
  INNER JOIN produto p       ON p.proId = pe.proId
  LEFT JOIN fabricante f     ON f.fabId = p.proFab
  LEFT JOIN grupoProd g      ON g.gdpId = p.proGrupo
  LEFT JOIN subGrupoProd s   ON s.sgpId = p.proSubGrupo`;

// ── Consulta principal ─────────────────────────────────────────────────────────

export async function getProdutosOverview(
  cfg: BridgeConfig,
  empIds: number[],
  filters: ProdutosFilters,
): Promise<ProdutosOverview> {
  const empList = empIds.filter(Number.isFinite).join(",");
  const { where, params } = buildFilter(empList, filters);
  const q = <T>(sql: string) => runQuery<T>(cfg, sql, params);

  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const [
    kpisRes,
    topMarcasValorRes,
    porMarcaQtdRes,
    topCategoriasValorRes,
    porGrupoQtdRes,
    margemNegRes,
    negativoRes,
    acaoRes,
  ] = await Promise.allSettled([

    // 1. KPIs consolidados
    q<Record<string, unknown>>(`
      SELECT
        COUNT(*) AS totalPosicoes,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float) * CAST(pe.proCusto AS float)), 0) AS valorCusto,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float) * CAST(pe.proVenda AS float)), 0) AS valorVenda,
        SUM(CASE WHEN pe.proEstoqueMin > 0 AND pe.proEstoqueAtual < pe.proEstoqueMin THEN 1 ELSE 0 END) AS abaixoMin,
        SUM(CASE WHEN pe.proEstoqueMin > 0 AND pe.proEstoqueAtual > pe.proEstoqueMin THEN 1 ELSE 0 END) AS acimaMin,
        SUM(CASE WHEN pe.proEstoqueMin IS NULL OR pe.proEstoqueMin <= 0 THEN 1 ELSE 0 END) AS semMin,
        SUM(CASE WHEN pe.proEstoqueAtual < 0 THEN 1 ELSE 0 END) AS negativo,
        SUM(CASE WHEN pe.proVenda < pe.proCusto AND pe.proCusto > 0 THEN 1 ELSE 0 END) AS margemNeg,
        SUM(CASE WHEN pe.proEstoqueAtual >= 0
                  AND NOT (pe.proVenda < pe.proCusto AND pe.proCusto > 0)
                  AND (pe.proEstoqueMin IS NULL OR pe.proEstoqueMin <= 0 OR pe.proEstoqueAtual >= pe.proEstoqueMin)
                 THEN 1 ELSE 0 END) AS regular
      ${JOINS}
      WHERE ${where}`),

    // 2. Top marcas por valor de custo
    q<Record<string, unknown>>(`
      SELECT TOP 8 ISNULL(f.fabNome, '${SEM_MARCA}') AS nome,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float) * CAST(pe.proCusto AS float)), 0) AS custo,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float) * CAST(pe.proVenda AS float)), 0) AS venda,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float)), 0) AS qtd
      ${JOINS}
      WHERE ${where} AND pe.proEstoqueAtual > 0
      GROUP BY f.fabNome
      ORDER BY custo DESC`),

    // 3. Quantidade em estoque por marca
    q<Record<string, unknown>>(`
      SELECT TOP 8 ISNULL(f.fabNome, '${SEM_MARCA}') AS nome,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float)), 0) AS qtd,
        0 AS custo, 0 AS venda
      ${JOINS}
      WHERE ${where} AND pe.proEstoqueAtual > 0
      GROUP BY f.fabNome
      ORDER BY qtd DESC`),

    // 4. Top categorias (subgrupo) por valor
    q<Record<string, unknown>>(`
      SELECT TOP 8 ISNULL(s.sgpNome, '${SEM_CATEGORIA}') AS nome,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float) * CAST(pe.proCusto AS float)), 0) AS custo,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float) * CAST(pe.proVenda AS float)), 0) AS venda,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float)), 0) AS qtd
      ${JOINS}
      WHERE ${where} AND pe.proEstoqueAtual > 0
      GROUP BY s.sgpNome
      ORDER BY custo DESC`),

    // 5. Quantidade em estoque por grupo
    q<Record<string, unknown>>(`
      SELECT TOP 8 ISNULL(g.gdpNome, '${SEM_GRUPO}') AS nome,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float)), 0) AS qtd,
        0 AS custo, 0 AS venda
      ${JOINS}
      WHERE ${where} AND pe.proEstoqueAtual > 0
      GROUP BY g.gdpNome
      ORDER BY qtd DESC`),

    // 6. Produtos com margem negativa (maior prejuízo %)
    q<Record<string, unknown>>(`
      SELECT TOP 12 p.proId AS proId, p.proDescricao AS nome,
        CAST(pe.proCusto AS float) AS custo, CAST(pe.proVenda AS float) AS venda,
        CASE WHEN pe.proCusto > 0
             THEN (CAST(pe.proVenda AS float) - CAST(pe.proCusto AS float)) / CAST(pe.proCusto AS float) * 100.0
             ELSE 0 END AS margemPct
      ${JOINS}
      WHERE ${where} AND pe.proVenda < pe.proCusto AND pe.proCusto > 0
      ORDER BY margemPct ASC`),

    // 7. Produtos com estoque negativo
    q<Record<string, unknown>>(`
      SELECT TOP 12 p.proId AS proId, p.proDescricao AS nome,
        ISNULL(f.fabNome, '${SEM_MARCA}') AS marca,
        CAST(pe.proEstoqueAtual AS float) AS saldo
      ${JOINS}
      WHERE ${where} AND pe.proEstoqueAtual < 0
      ORDER BY saldo ASC`),

    // 8. Produtos que exigem ação (tabela) — ordenados por severidade
    q<Record<string, unknown>>(`
      SELECT TOP 300 p.proId AS proId, pe.proCodigo AS codigo, p.proDescricao AS nome,
        ISNULL(f.fabNome, '${SEM_MARCA}') AS marca,
        ISNULL(s.sgpNome, '${SEM_CATEGORIA}') AS categoria,
        ISNULL(g.gdpNome, '${SEM_GRUPO}') AS grupo,
        pe.empId AS empId,
        CAST(pe.proEstoqueAtual AS float) AS estoqueAtual,
        CAST(pe.proEstoqueMin AS float) AS estoqueMinimo,
        CAST(pe.proCusto AS float) AS custoUnit,
        CAST(pe.proVenda AS float) AS vendaUnit,
        CASE
          WHEN pe.proEstoqueAtual < 0 THEN 1
          WHEN pe.proVenda < pe.proCusto AND pe.proCusto > 0 THEN 2
          WHEN pe.proEstoqueMin > 0 AND pe.proEstoqueAtual < pe.proEstoqueMin THEN 3
          WHEN pe.proEstoqueMin IS NULL OR pe.proEstoqueMin <= 0 THEN 4
          ELSE 5
        END AS sev
      ${JOINS}
      WHERE ${where}
        AND NOT (
          pe.proEstoqueAtual >= 0
          AND NOT (pe.proVenda < pe.proCusto AND pe.proCusto > 0)
          AND pe.proEstoqueMin > 0 AND pe.proEstoqueAtual >= pe.proEstoqueMin
        )
      ORDER BY sev ASC, pe.proEstoqueAtual ASC`),
  ]);

  const val = <T>(r: PromiseSettledResult<T[]>): T[] => (r.status === "fulfilled" ? r.value : []);

  const k = val(kpisRes)[0] ?? {};
  const kpis: ProdutosKpis = {
    totalPosicoes: num(k.totalPosicoes),
    valorCusto: num(k.valorCusto),
    valorVenda: num(k.valorVenda),
    margemPotencial: num(k.valorVenda) - num(k.valorCusto),
    abaixoMin: num(k.abaixoMin),
    acimaMin: num(k.acimaMin),
    semMin: num(k.semMin),
    negativo: num(k.negativo),
    margemNeg: num(k.margemNeg),
    regular: num(k.regular),
  };

  const rank = (rows: Record<string, unknown>[]): RankItem[] =>
    rows.map((r) => ({
      nome: String(r.nome ?? SEM_MARCA),
      custo: num(r.custo),
      venda: num(r.venda),
      qtd: num(r.qtd),
    }));

  const margemNegativa: ProblemaMargem[] = val(margemNegRes).map((r) => ({
    proId: num(r.proId),
    nome: String(r.nome ?? ""),
    custo: num(r.custo),
    venda: num(r.venda),
    margemPct: num(r.margemPct),
  }));

  const estoqueNegativo: ProblemaNegativo[] = val(negativoRes).map((r) => ({
    proId: num(r.proId),
    nome: String(r.nome ?? ""),
    marca: String(r.marca ?? SEM_MARCA),
    saldo: num(r.saldo),
  }));

  const exigeAcao: ProdutoAcao[] = val(acaoRes).map((r) => {
    const estoqueAtual = num(r.estoqueAtual);
    const min = r.estoqueMinimo == null ? null : num(r.estoqueMinimo);
    const custoUnit = num(r.custoUnit);
    const vendaUnit = num(r.vendaUnit);
    const temMin = min != null && min > 0;
    const status: StatusEstoque =
      estoqueAtual < 0 ? "negativo"
      : vendaUnit < custoUnit && custoUnit > 0 ? "margemNeg"
      : temMin && estoqueAtual < min ? "abaixo"
      : !temMin ? "semMin"
      : estoqueAtual > min ? "acima"
      : "regular";
    return {
      proId: num(r.proId),
      codigo: r.codigo == null ? null : String(r.codigo),
      nome: String(r.nome ?? ""),
      marca: String(r.marca ?? SEM_MARCA),
      categoria: String(r.categoria ?? SEM_CATEGORIA),
      grupo: String(r.grupo ?? SEM_GRUPO),
      empId: num(r.empId),
      estoqueAtual,
      estoqueMinimo: min,
      diferenca: temMin ? estoqueAtual - min : null,
      custoUnit,
      vendaUnit,
      valorCusto: estoqueAtual * custoUnit,
      valorVenda: estoqueAtual * vendaUnit,
      margemPct: custoUnit > 0 ? ((vendaUnit - custoUnit) / custoUnit) * 100 : null,
      status,
    };
  });

  return {
    kpis,
    topMarcasValor: rank(val(topMarcasValorRes)),
    porMarcaQtd: rank(val(porMarcaQtdRes)),
    topCategoriasValor: rank(val(topCategoriasValorRes)),
    porGrupoQtd: rank(val(porGrupoQtdRes)),
    margemNegativa,
    estoqueNegativo,
    exigeAcao,
  };
}
