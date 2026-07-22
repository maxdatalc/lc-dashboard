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
//   vendaItem/venda  → giro (velocidade de venda), usado para Curva ABC, produtos
//                      parados, ruptura ativa e sugestão de compra. Convenção de
//                      valor idêntica à já usada em app/api/dashboard/charts/route.ts
//                      (case "top-produtos"): vdiQtde*vdiValor, filtro
//                      vedStatus='F' AND vedTipo IN ('OS','VE') AND vedTotalNf>0 AND vdiCancel=0.
//                      Exclui vdiItemId=1 ("CURINGA" — item avulso lançado na venda,
//                      não valida/representa estoque real; confirmado com o cliente).
//
// Cada linha de produto_empresa é uma POSIÇÃO (produto × filial). Em multilojas os
// valores são consolidados somando as posições das filiais selecionadas — custo e
// venda são próprios de cada filial, então a soma reflete o capital real por loja.
//
// Todas as agregações são feitas em SQL; o cliente recebe dados prontos. Os filtros
// de cross-filtering (marca, grupo, categoria, status, classeAbc, parado, busca) são
// aplicados no servidor para que KPIs, rankings e tabela sejam sempre coerentes entre si.
// ─────────────────────────────────────────────────────────────────────────────

import { queryBridge, queryDev, type BridgeConfig } from "@/lib/mssql/client";
import { geraFinanceiroClause } from "@/lib/db/venda-filters";

export const SEM_MARCA = "Sem marca";
export const SEM_GRUPO = "Sem grupo";
export const SEM_CATEGORIA = "Sem categoria";

// Produto "coringa" do MaxManager — lançado avulso na venda, sem representar
// estoque real de um SKU específico. Excluído de todo cálculo de giro, KPI, margem
// e ranking (buildFilter).
//
// ATENÇÃO — isto é uma convenção observada num cliente específico (BATAUTO), não uma
// regra de schema do MaxManager: proId é autoincremento por banco, então proId=1 é só
// "o primeiro produto cadastrado" — em outro banco pode ser um produto real e relevante
// (confirmado: no bridge de testes SALES, proId=1 é um farol de verdade, não um coringa).
// Excluir esse ID sem reconfirmar por cliente pode descartar vendas/estoque reais
// silenciosamente. Antes de habilitar em produção para um tenant novo, confirmar com o
// cliente qual é o proId (ou nome) do produto coringa dele — idealmente evoluir para uma
// configuração por tenant em vez desta constante global.
const PRO_ID_CURINGA = 1;

export type StatusEstoque =
  | "abaixo"      // estoque < mínimo (mínimo informado)
  | "acima"       // estoque > mínimo (mínimo informado)
  | "semMin"      // mínimo não informado
  | "negativo"    // estoque < 0
  | "margemNeg"   // venda < custo
  | "regular";    // dentro do parâmetro

export type ClasseAbc = "A" | "B" | "C" | "semGiro";

export interface ProdutosFilters {
  marca?: string | null;
  grupo?: string | null;
  categoria?: string | null;
  status?: StatusEstoque | null;
  classeAbc?: ClasseAbc | null;
  parado?: boolean;
  busca?: string | null;
}

export interface RankItem {
  nome: string;
  custo: number;
  venda: number;
  qtd: number;
}

export interface AbcResumo {
  classe: ClasseAbc;
  qtdProdutos: number;
  faturamento: number;
  pctFaturamento: number;
}

export interface ProdutoParadoItem {
  proId: number;
  nome: string;
  marca: string;
  estoqueAtual: number;
  valorParado: number;
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
  // Giro (janela de @dias selecionada)
  velocidadeDiaria: number;       // unidades vendidas / dia, na janela
  giroDias: number | null;        // cobertura em dias = estoqueAtual / velocidadeDiaria (null se sem giro)
  parado: boolean;                // estoqueAtual > 0 e zero vendas na janela
  rupturaAtiva: boolean;          // estoqueAtual <= 0 e vendeu na janela (ruptura real, não erro cadastral)
  sugestaoCompra: number | null;  // gap até o mínimo, quando informado e abaixo dele
  valorSugestao: number | null;   // sugestaoCompra * custoUnit
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
  parados: number;
  valorParado: number;
  rupturaAtiva: number;
}

export interface ProdutosOverview {
  kpis: ProdutosKpis;
  topMarcasValor: RankItem[];
  porMarcaQtd: RankItem[];
  topCategoriasValor: RankItem[];
  porGrupoQtd: RankItem[];
  curvaAbc: AbcResumo[];
  produtosParados: ProdutoParadoItem[];
  exigeAcao: ProdutoAcao[];
}

// ── Execução: usa banco local (queryDev) em dev; bridge do cliente em produção ──

function runQuery<T>(cfg: BridgeConfig, sql: string, params?: Record<string, unknown>): Promise<T[]> {
  if (process.env.MSSQL_HOST) return queryDev<T>(sql, params);
  return queryBridge<T>(cfg, sql, params);
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ── CTE de vendas na janela selecionada ─────────────────────────────────────────
// Nome não pode ser "Venda" — colide (case-insensitive) com a tabela real `venda`
// e o SQL Server interpreta a CTE como recursiva sem UNION ALL, gerando erro.

function vendaJanelaCte(empList: string): string {
  return `
    WITH VendaJanela AS (
      SELECT vi.vdiItemId AS proId, v.empId,
        SUM(vi.vdiQtde) AS qtd,
        SUM(vi.vdiQtde * vi.vdiValor) AS faturamento
      FROM vendaItem vi
      INNER JOIN venda v ON v.vedId = vi.vdiVedId
      WHERE v.vedStatus = 'F' AND v.vedTipo IN ('OS','VE') AND v.vedTotalNf > 0
        AND vi.vdiCancel = 0 AND vi.vdiItemId <> ${PRO_ID_CURINGA}
        AND v.empId IN (${empList})
        AND v.vedFechamento >= DATEADD(day, -@dias, GETDATE())
        ${geraFinanceiroClause("v")}
      GROUP BY vi.vdiItemId, v.empId
    )`;
}

// ── Fragmento de filtro compartilhado por todas as queries ─────────────────────
// Retorna um pedaço de SQL (WHERE extra) + os parâmetros escalares associados.
// empList é uma lista de inteiros já sanitizada (fonte própria) — seguro inlinar.
// proIdsIn/proIdsNotIn também são inteiros gerados internamente (nunca vindos do
// usuário) — seguros para inlinar diretamente no SQL.

function statusSql(status: StatusEstoque): string {
  switch (status) {
    // "abaixo"/"semMin" excluem estoque negativo (>= 0) para não se sobrepor com "negativo" —
    // uma posição com estoque negativo E mínimo informado batia em "negativo" E "abaixo" ao
    // mesmo tempo antes desta correção (mesma classe de bug do "regular", achada ao validar
    // a correção acima contra o bridge de testes).
    case "abaixo":    return "pe.proEstoqueAtual >= 0 AND pe.proEstoqueMin > 0 AND pe.proEstoqueAtual < pe.proEstoqueMin";
    case "acima":     return "pe.proEstoqueMin > 0 AND pe.proEstoqueAtual > pe.proEstoqueMin";
    case "semMin":    return "pe.proEstoqueAtual >= 0 AND (pe.proEstoqueMin IS NULL OR pe.proEstoqueMin <= 0)";
    case "negativo":  return "pe.proEstoqueAtual < 0";
    case "margemNeg": return "pe.proVenda < pe.proCusto AND pe.proCusto > 0";
    case "regular":
      // Mutuamente exclusivo com abaixo/acima/semMin/negativo/margemNeg — espelha a cadeia
      // de prioridade usada na classificação em JS (exigeAcao, mais abaixo): só é "regular"
      // quando o mínimo está informado E o estoque bate exatamente nele. A definição antiga
      // ("sem mínimo OU no/acima do mínimo") sobrepunha quase todo o catálogo com "semMin" e
      // "acima", fazendo os segmentos do donut de saúde somarem quase 2x o total de posições.
      return (
        "pe.proEstoqueAtual >= 0 " +
        "AND NOT (pe.proVenda < pe.proCusto AND pe.proCusto > 0) " +
        "AND pe.proEstoqueMin > 0 AND pe.proEstoqueAtual = pe.proEstoqueMin"
      );
  }
}

// "Parado" via NOT EXISTS autocontido (não depende da CTE VendaJanela — pode ser
// usado em queries que não a declaram).
function paradoSql(): string {
  return `pe.proEstoqueAtual > 0 AND NOT EXISTS (
    SELECT 1 FROM vendaItem vi2
    INNER JOIN venda v2 ON v2.vedId = vi2.vdiVedId
    WHERE vi2.vdiItemId = pe.proId AND v2.empId = pe.empId
      AND v2.vedStatus = 'F' AND v2.vedTipo IN ('OS','VE') AND v2.vedTotalNf > 0
      AND vi2.vdiCancel = 0 AND vi2.vdiItemId <> ${PRO_ID_CURINGA}
      AND v2.vedFechamento >= DATEADD(day, -@dias, GETDATE())
      ${geraFinanceiroClause("v2")}
  )`;
}

interface FilterOptions {
  proIdsIn?: number[];    // restringe a este conjunto (usado pelo cross-filter de classe ABC)
  proIdsNotIn?: number[]; // exclui este conjunto (classe "semGiro")
}

function buildFilter(
  empList: string,
  f: ProdutosFilters,
  opts: FilterOptions = {},
): { where: string; params: Record<string, unknown> } {
  const parts: string[] = [
    `pe.empId IN (${empList})`,
    "p.proTipo = 'P'",
    "pe.proDesativaProd = 0",
    `p.proId <> ${PRO_ID_CURINGA}`,
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
  if (f.status) parts.push(statusSql(f.status));
  if (f.parado) parts.push(paradoSql());
  if (f.busca) {
    parts.push("(p.proDescricao LIKE @busca OR pe.proCodigo LIKE @busca)");
    params.busca = `%${f.busca}%`;
  }
  if (opts.proIdsIn) {
    parts.push(opts.proIdsIn.length > 0 ? `p.proId IN (${opts.proIdsIn.join(",")})` : "1=0");
  }
  if (opts.proIdsNotIn && opts.proIdsNotIn.length > 0) {
    parts.push(`p.proId NOT IN (${opts.proIdsNotIn.join(",")})`);
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

// ── Curva ABC — classificação a partir do faturamento por proId ────────────────
// A = até 80% do faturamento acumulado, B = até 95%, C = resto. Calculado em JS
// (evita depender de window functions na bridge SQL).

function classificarAbc(
  vendasPorProduto: { proId: number; faturamento: number }[],
  totalProdutosDistintos: number,
): { classeMap: Map<number, ClasseAbc>; resumo: AbcResumo[] } {
  const ordenado = [...vendasPorProduto].sort((a, b) => b.faturamento - a.faturamento);
  const totalFaturamento = ordenado.reduce((s, v) => s + v.faturamento, 0);

  const classeMap = new Map<number, ClasseAbc>();
  const buckets: Record<ClasseAbc, { qtd: number; fat: number }> = {
    A: { qtd: 0, fat: 0 }, B: { qtd: 0, fat: 0 }, C: { qtd: 0, fat: 0 }, semGiro: { qtd: 0, fat: 0 },
  };

  let acumulado = 0;
  for (const v of ordenado) {
    acumulado += v.faturamento;
    const pctAcumulado = totalFaturamento > 0 ? (acumulado / totalFaturamento) * 100 : 100;
    const classe: ClasseAbc = pctAcumulado <= 80 ? "A" : pctAcumulado <= 95 ? "B" : "C";
    classeMap.set(v.proId, classe);
    buckets[classe].qtd += 1;
    buckets[classe].fat += v.faturamento;
  }

  const semGiroQtd = Math.max(0, totalProdutosDistintos - ordenado.length);
  buckets.semGiro.qtd = semGiroQtd;

  const resumo: AbcResumo[] = (["A", "B", "C", "semGiro"] as ClasseAbc[])
    .map((classe) => ({
      classe,
      qtdProdutos: buckets[classe].qtd,
      faturamento: buckets[classe].fat,
      pctFaturamento: totalFaturamento > 0 ? (buckets[classe].fat / totalFaturamento) * 100 : 0,
    }))
    .filter((r) => r.qtdProdutos > 0);

  return { classeMap, resumo };
}

// ── Consulta principal ─────────────────────────────────────────────────────────

export async function getProdutosOverview(
  cfg: BridgeConfig,
  empIds: number[],
  filters: ProdutosFilters,
  dias: number,
): Promise<ProdutosOverview> {
  const empList = empIds.filter(Number.isFinite).join(",");
  const q = <T>(sql: string, params: Record<string, unknown>) => runQuery<T>(cfg, sql, params);

  // ── Passo 1: Curva ABC (roda antes do resto — precisa existir para virar filtro) ──
  // Faturamento por proId respeitando marca/grupo/categoria/busca/status/parado,
  // mas NUNCA classeAbc (senão o filtro se torna circular).
  const filtrosSemClasse: ProdutosFilters = { ...filters, classeAbc: undefined };
  const { where: whereBase, params: paramsBase } = buildFilter(empList, filtrosSemClasse);
  const paramsComDias = { ...paramsBase, dias };

  const [faturamentoRows, totalDistintosRows] = await Promise.all([
    q<{ proId: number; faturamento: number }>(`
      ${vendaJanelaCte(empList)}
      SELECT p.proId, SUM(ve.faturamento) AS faturamento
      ${JOINS}
      INNER JOIN VendaJanela ve ON ve.proId = pe.proId AND ve.empId = pe.empId
      WHERE ${whereBase}
      GROUP BY p.proId`, paramsComDias
    ).catch(() => []),
    q<{ total: number }>(`
      SELECT COUNT(DISTINCT p.proId) AS total
      ${JOINS}
      WHERE ${whereBase}`, paramsBase
    ).catch(() => [{ total: 0 }]),
  ]);

  const { classeMap, resumo: curvaAbc } = classificarAbc(
    faturamentoRows.map((r) => ({ proId: num(r.proId), faturamento: num(r.faturamento) })),
    num(totalDistintosRows[0]?.total),
  );

  // Resolve o cross-filter de classe ABC em um conjunto de proIds para o restante das queries
  let filterOpts: FilterOptions = {};
  if (filters.classeAbc === "semGiro") {
    filterOpts = { proIdsNotIn: [...classeMap.keys()] };
  } else if (filters.classeAbc) {
    const ids = [...classeMap.entries()].filter(([, c]) => c === filters.classeAbc).map(([id]) => id);
    filterOpts = { proIdsIn: ids };
  }

  const { where, params } = buildFilter(empList, filters, filterOpts);
  const paramsFull = { ...params, dias };

  // ── Passo 2: restante das queries em paralelo ───────────────────────────────
  const [
    kpisRes,
    topMarcasValorRes,
    porMarcaQtdRes,
    topCategoriasValorRes,
    porGrupoQtdRes,
    paradosRes,
    acaoRes,
  ] = await Promise.allSettled([

    // 1. KPIs consolidados (inclui parados/valorParado via LEFT JOIN da CTE de giro)
    q<Record<string, unknown>>(`
      ${vendaJanelaCte(empList)}
      SELECT
        COUNT(*) AS totalPosicoes,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float) * CAST(pe.proCusto AS float)), 0) AS valorCusto,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float) * CAST(pe.proVenda AS float)), 0) AS valorVenda,
        SUM(CASE WHEN pe.proEstoqueAtual >= 0 AND pe.proEstoqueMin > 0 AND pe.proEstoqueAtual < pe.proEstoqueMin THEN 1 ELSE 0 END) AS abaixoMin,
        SUM(CASE WHEN pe.proEstoqueMin > 0 AND pe.proEstoqueAtual > pe.proEstoqueMin THEN 1 ELSE 0 END) AS acimaMin,
        SUM(CASE WHEN pe.proEstoqueAtual >= 0 AND (pe.proEstoqueMin IS NULL OR pe.proEstoqueMin <= 0) THEN 1 ELSE 0 END) AS semMin,
        SUM(CASE WHEN pe.proEstoqueAtual < 0 THEN 1 ELSE 0 END) AS negativo,
        SUM(CASE WHEN pe.proVenda < pe.proCusto AND pe.proCusto > 0 THEN 1 ELSE 0 END) AS margemNeg,
        SUM(CASE WHEN pe.proEstoqueAtual >= 0
                  AND NOT (pe.proVenda < pe.proCusto AND pe.proCusto > 0)
                  AND pe.proEstoqueMin > 0 AND pe.proEstoqueAtual = pe.proEstoqueMin
                 THEN 1 ELSE 0 END) AS regular,
        SUM(CASE WHEN pe.proEstoqueAtual > 0 AND ve.qtd IS NULL THEN 1 ELSE 0 END) AS parados,
        SUM(CASE WHEN pe.proEstoqueAtual > 0 AND ve.qtd IS NULL
                 THEN CAST(pe.proEstoqueAtual AS float)*CAST(pe.proCusto AS float) ELSE 0 END) AS valorParado,
        SUM(CASE WHEN pe.proEstoqueAtual <= 0 AND ve.qtd > 0 THEN 1 ELSE 0 END) AS rupturaAtiva
      ${JOINS}
      LEFT JOIN VendaJanela ve ON ve.proId = pe.proId AND ve.empId = pe.empId
      WHERE ${where}`, paramsFull),

    // 2. Top marcas por valor de custo
    q<Record<string, unknown>>(`
      SELECT TOP 8 ISNULL(f.fabNome, '${SEM_MARCA}') AS nome,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float) * CAST(pe.proCusto AS float)), 0) AS custo,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float) * CAST(pe.proVenda AS float)), 0) AS venda,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float)), 0) AS qtd
      ${JOINS}
      WHERE ${where} AND pe.proEstoqueAtual > 0
      GROUP BY f.fabNome
      ORDER BY custo DESC`, params),

    // 3. Quantidade em estoque por marca
    q<Record<string, unknown>>(`
      SELECT TOP 8 ISNULL(f.fabNome, '${SEM_MARCA}') AS nome,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float)), 0) AS qtd,
        0 AS custo, 0 AS venda
      ${JOINS}
      WHERE ${where} AND pe.proEstoqueAtual > 0
      GROUP BY f.fabNome
      ORDER BY qtd DESC`, params),

    // 4. Top categorias (subgrupo) por valor
    q<Record<string, unknown>>(`
      SELECT TOP 8 ISNULL(s.sgpNome, '${SEM_CATEGORIA}') AS nome,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float) * CAST(pe.proCusto AS float)), 0) AS custo,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float) * CAST(pe.proVenda AS float)), 0) AS venda,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float)), 0) AS qtd
      ${JOINS}
      WHERE ${where} AND pe.proEstoqueAtual > 0
      GROUP BY s.sgpNome
      ORDER BY custo DESC`, params),

    // 5. Quantidade em estoque por grupo
    q<Record<string, unknown>>(`
      SELECT TOP 8 ISNULL(g.gdpNome, '${SEM_GRUPO}') AS nome,
        ISNULL(SUM(CAST(pe.proEstoqueAtual AS float)), 0) AS qtd,
        0 AS custo, 0 AS venda
      ${JOINS}
      WHERE ${where} AND pe.proEstoqueAtual > 0
      GROUP BY g.gdpNome
      ORDER BY qtd DESC`, params),

    // 6. Produtos parados — TOP 12 por valor de custo parado
    q<Record<string, unknown>>(`
      ${vendaJanelaCte(empList)}
      SELECT TOP 12 p.proId AS proId, p.proDescricao AS nome, ISNULL(f.fabNome, '${SEM_MARCA}') AS marca,
        SUM(CAST(pe.proEstoqueAtual AS float)) AS estoqueAtual,
        SUM(CAST(pe.proEstoqueAtual AS float) * CAST(pe.proCusto AS float)) AS valorParado
      ${JOINS}
      LEFT JOIN VendaJanela ve ON ve.proId = pe.proId AND ve.empId = pe.empId
      WHERE ${where} AND pe.proEstoqueAtual > 0 AND ve.qtd IS NULL
      GROUP BY p.proId, p.proDescricao, f.fabNome
      ORDER BY valorParado DESC`, paramsFull),

    // 7. Produtos que exigem ação (tabela) — ordenados por severidade, com giro
    q<Record<string, unknown>>(`
      ${vendaJanelaCte(empList)}
      SELECT TOP 300 p.proId AS proId, pe.proCodigo AS codigo, p.proDescricao AS nome,
        ISNULL(f.fabNome, '${SEM_MARCA}') AS marca,
        ISNULL(s.sgpNome, '${SEM_CATEGORIA}') AS categoria,
        ISNULL(g.gdpNome, '${SEM_GRUPO}') AS grupo,
        pe.empId AS empId,
        CAST(pe.proEstoqueAtual AS float) AS estoqueAtual,
        CAST(pe.proEstoqueMin AS float) AS estoqueMinimo,
        CAST(pe.proCusto AS float) AS custoUnit,
        CAST(pe.proVenda AS float) AS vendaUnit,
        ISNULL(ve.qtd, 0) AS qtdVendida,
        CASE
          WHEN pe.proEstoqueAtual < 0 THEN 1
          WHEN pe.proVenda < pe.proCusto AND pe.proCusto > 0 THEN 2
          WHEN pe.proEstoqueMin > 0 AND pe.proEstoqueAtual < pe.proEstoqueMin THEN 3
          WHEN pe.proEstoqueMin IS NULL OR pe.proEstoqueMin <= 0 THEN 4
          ELSE 5
        END AS sev
      ${JOINS}
      LEFT JOIN VendaJanela ve ON ve.proId = pe.proId AND ve.empId = pe.empId
      WHERE ${where}
        AND NOT (
          pe.proEstoqueAtual >= 0
          AND NOT (pe.proVenda < pe.proCusto AND pe.proCusto > 0)
          AND pe.proEstoqueMin > 0 AND pe.proEstoqueAtual >= pe.proEstoqueMin
        )
      ORDER BY sev ASC, pe.proEstoqueAtual ASC`, paramsFull),
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
    parados: num(k.parados),
    valorParado: num(k.valorParado),
    rupturaAtiva: num(k.rupturaAtiva),
  };

  const rank = (rows: Record<string, unknown>[]): RankItem[] =>
    rows.map((r) => ({
      nome: String(r.nome ?? SEM_MARCA),
      custo: num(r.custo),
      venda: num(r.venda),
      qtd: num(r.qtd),
    }));

  const produtosParados: ProdutoParadoItem[] = val(paradosRes).map((r) => ({
    proId: num(r.proId),
    nome: String(r.nome ?? ""),
    marca: String(r.marca ?? SEM_MARCA),
    estoqueAtual: num(r.estoqueAtual),
    valorParado: num(r.valorParado),
  }));

  const exigeAcao: ProdutoAcao[] = val(acaoRes).map((r) => {
    const estoqueAtual = num(r.estoqueAtual);
    const min = r.estoqueMinimo == null ? null : num(r.estoqueMinimo);
    const custoUnit = num(r.custoUnit);
    const vendaUnit = num(r.vendaUnit);
    const qtdVendida = num(r.qtdVendida);
    const temMin = min != null && min > 0;
    const status: StatusEstoque =
      estoqueAtual < 0 ? "negativo"
      : vendaUnit < custoUnit && custoUnit > 0 ? "margemNeg"
      : temMin && estoqueAtual < min ? "abaixo"
      : !temMin ? "semMin"
      : estoqueAtual > min ? "acima"
      : "regular";

    const velocidadeDiaria = qtdVendida / dias;
    const giroDias = velocidadeDiaria > 0 ? estoqueAtual / velocidadeDiaria : null;
    const sugestaoCompra = temMin && estoqueAtual < (min as number) ? (min as number) - estoqueAtual : null;

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
      diferenca: temMin ? estoqueAtual - (min as number) : null,
      custoUnit,
      vendaUnit,
      valorCusto: estoqueAtual * custoUnit,
      valorVenda: estoqueAtual * vendaUnit,
      margemPct: custoUnit > 0 ? ((vendaUnit - custoUnit) / custoUnit) * 100 : null,
      status,
      velocidadeDiaria,
      giroDias,
      parado: estoqueAtual > 0 && qtdVendida === 0,
      rupturaAtiva: estoqueAtual <= 0 && qtdVendida > 0,
      sugestaoCompra,
      valorSugestao: sugestaoCompra != null ? sugestaoCompra * custoUnit : null,
    };
  });

  return {
    kpis,
    topMarcasValor: rank(val(topMarcasValorRes)),
    porMarcaQtd: rank(val(porMarcaQtdRes)),
    topCategoriasValor: rank(val(topCategoriasValorRes)),
    porGrupoQtd: rank(val(porGrupoQtdRes)),
    curvaAbc,
    produtosParados,
    exigeAcao,
  };
}
