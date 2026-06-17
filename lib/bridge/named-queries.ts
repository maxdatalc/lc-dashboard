/**
 * Named query registry — server-side only.
 *
 * SQL is hardcoded here; the frontend only ever sends a queryName string
 * plus typed params. This prevents SQL injection and free-query attacks.
 *
 * All SQL targets the BATAUTO (MaxData) SQL Server via the Bridge proxy.
 * Parameters use SQL Server @name syntax.
 *
 * Schema validated against BATAUTO on 2026-06-14.
 */

const SEARCH_PRODUCTS = `
SELECT TOP 20
  p.proId            AS proId,
  pe.proCodigo       AS proCodigo,
  p.proDescricao     AS proDescricao,
  pe.proEstoqueAtual AS proEstoqueAtual,
  p.proUn            AS proUn,
  pe.proVenda        AS proVenda
FROM produto p
INNER JOIN produto_empresa pe ON pe.proId = p.proId AND pe.empId = @empId
WHERE
  (pe.proDesativaProd IS NULL OR pe.proDesativaProd = 0)
  AND (
    @termoDesc = ''
    OR p.proDescricao LIKE @termoDesc
    OR p.proAplicacao LIKE @termoDesc
  )
  AND (
    (@termoCodigo = '' AND @termoCodigoId = 0)
    OR (@termoCodigoExato = 1 AND pe.proCodigo = @termoCodigo)
    OR (@termoCodigoId > 0 AND p.proId = @termoCodigoId)
  )
  AND (@grupo = '' OR p.proGrupo LIKE '%' + @grupo + '%')
ORDER BY p.proDescricao
`;

const GET_PRODUCT_PHYSICAL_STOCK = `
SELECT
  p.proId            AS proId,
  pe.proCodigo       AS proCodigo,
  p.proDescricao     AS proDescricao,
  pe.proEstoqueAtual AS proEstoqueAtual,
  p.proUn            AS proUn
FROM produto p
INNER JOIN produto_empresa pe ON pe.proId = p.proId AND pe.empId = @empId
WHERE p.proId = @proId
`;

const LIST_INVENTORIES = `
SELECT
  invId,
  CONVERT(VARCHAR(10), invData, 23) AS data,
  ISNULL(invObs, '')                AS obs
FROM Inventario
WHERE empId      = @empId
  AND invSuspenso = 0
ORDER BY invData DESC
`;

const GET_FISCAL_STOCK_COMPOSITION = `
WITH InventarioBase AS (
  SELECT TOP 1
    ii.iviProId       AS proId,
    ii.iviProEstoque  AS baseInv,
    i.invId,
    i.invData         AS dataInventario,
    i.empId
  FROM InventarioItem ii
  INNER JOIN Inventario i ON i.invId = ii.iviInvId
  WHERE ii.iviProId = @proId
    AND i.empId     = @empId
    AND (
          (@invId IS NULL AND i.invSuspenso = 0)
       OR (i.invId = @invId)
        )
  ORDER BY i.invData DESC
),
Entradas AS (
  SELECT COALESCE(SUM(ni.nfiQtde), 0) AS total
  FROM nfItem ni
  INNER JOIN nf n ON n.nfId = ni.nfiNf
  CROSS JOIN InventarioBase ib
  WHERE ni.nfiProd        = @proId
    AND n.empId           = @empId
    AND n.nfStatus        = 'F'
    AND n.nfTipoNf        = 'E'
    AND n.nfTipoNfSped   <> '01'
    AND ni.nfiCfop NOT IN (1202, 2202, 5202, 6202)
    AND n.nfDataEmissao   > ib.dataInventario
),
Saidas AS (
  SELECT COALESCE(SUM(ni.nfiQtde), 0) AS total
  FROM nfItem ni
  INNER JOIN nf n ON n.nfId = ni.nfiNf
  CROSS JOIN InventarioBase ib
  WHERE ni.nfiProd        = @proId
    AND n.empId           = @empId
    AND n.nfStatus        = 'F'
    AND n.nfTipoNf        = 'S'
    AND n.nfTipoNfSped   <> '01'
    AND n.nfDataEmissao   > ib.dataInventario
),
Devolucoes AS (
  SELECT COALESCE(SUM(ni.nfiQtde), 0) AS total
  FROM nfItem ni
  INNER JOIN nf n ON n.nfId = ni.nfiNf
  CROSS JOIN InventarioBase ib
  WHERE ni.nfiProd        = @proId
    AND n.empId           = @empId
    AND n.nfStatus        = 'F'
    AND n.nfTipoNfSped   <> '01'
    AND ni.nfiCfop        IN (1202, 2202)
    AND n.nfDataEmissao   > ib.dataInventario
),
Ajustes AS (
  SELECT COALESCE(SUM(pai.paiQtdInf - pai.paiProEstoque), 0) AS total
  FROM produtoAcertoEstoque pae
  INNER JOIN produtoAcertoEstoqueItem pai ON pai.paiPaeId = pae.paeId
  CROSS JOIN InventarioBase ib
  WHERE pai.paiProId           = @proId
    AND pae.empId              = @empId
    AND pae.paeStatus          = 'F'
    AND pae.paeDataOcorrencia  > ib.dataInventario
)
SELECT
  ib.proId              AS proId,
  ib.empId              AS empId,
  ib.invId              AS inventarioId,
  CONVERT(VARCHAR(23), ib.dataInventario, 126) AS dataInventario,
  ib.baseInv            AS estoqueBaseInventario,
  e.total               AS entradasFiscais,
  s.total               AS saidasFiscais,
  d.total               AS devolucoesFiscais,
  aj.total              AS ajustesEstoque,
  (ib.baseInv + e.total - s.total + d.total + aj.total) AS estoqueFiscal
FROM InventarioBase ib
CROSS JOIN Entradas e
CROSS JOIN Saidas s
CROSS JOIN Devolucoes d
CROSS JOIN Ajustes aj
`;

const GET_FISCAL_STOCK_NO_BASE = `
WITH
Entradas AS (
  SELECT COALESCE(SUM(ni.nfiQtde), 0) AS total
  FROM nfItem ni
  INNER JOIN nf n ON n.nfId = ni.nfiNf
  WHERE ni.nfiProd        = @proId
    AND n.empId           = @empId
    AND n.nfStatus        = 'F'
    AND n.nfTipoNf        = 'E'
    AND n.nfTipoNfSped   <> '01'
    AND ni.nfiCfop NOT IN (1202, 2202, 5202, 6202)
),
Saidas AS (
  SELECT COALESCE(SUM(ni.nfiQtde), 0) AS total
  FROM nfItem ni
  INNER JOIN nf n ON n.nfId = ni.nfiNf
  WHERE ni.nfiProd        = @proId
    AND n.empId           = @empId
    AND n.nfStatus        = 'F'
    AND n.nfTipoNf        = 'S'
    AND n.nfTipoNfSped   <> '01'
),
Devolucoes AS (
  SELECT COALESCE(SUM(ni.nfiQtde), 0) AS total
  FROM nfItem ni
  INNER JOIN nf n ON n.nfId = ni.nfiNf
  WHERE ni.nfiProd        = @proId
    AND n.empId           = @empId
    AND n.nfStatus        = 'F'
    AND n.nfTipoNfSped   <> '01'
    AND ni.nfiCfop        IN (1202, 2202)
),
Ajustes AS (
  SELECT COALESCE(SUM(pai.paiQtdInf - pai.paiProEstoque), 0) AS total
  FROM produtoAcertoEstoque pae
  INNER JOIN produtoAcertoEstoqueItem pai ON pai.paiPaeId = pae.paeId
  WHERE pai.paiProId  = @proId
    AND pae.empId     = @empId
    AND pae.paeStatus = 'F'
)
SELECT
  @proId AS proId,
  @empId AS empId,
  NULL   AS inventarioId,
  NULL   AS dataInventario,
  0      AS estoqueBaseInventario,
  e.total  AS entradasFiscais,
  s.total  AS saidasFiscais,
  d.total  AS devolucoesFiscais,
  aj.total AS ajustesEstoque,
  (e.total - s.total + d.total + aj.total) AS estoqueFiscal
FROM Entradas e
CROSS JOIN Saidas s
CROSS JOIN Devolucoes d
CROSS JOIN Ajustes aj
`;

const LIST_SERVICE_ORDERS = `
SELECT TOP 200
  v.vedId                                             AS vedId,
  v.vedClienteId                                      AS cliId,
  COALESCE(c.cliNome, v.vedCliNome, '')               AS clienteNome,
  COALESCE(ve.veiPlaca, '')                           AS placa,
  v.vedStatus                                         AS status,
  CONVERT(VARCHAR(23), v.vedAbertura, 126)            AS dataAbertura,
  CONVERT(VARCHAR(23), v.vedFechamento, 126)          AS dataFechamento,
  ISNULL(v.vedEquipamento, '')                        AS equipamento,
  ISNULL(v.vedMarca, '')                              AS marca,
  ISNULL(v.vedDefeito, '')                            AS defeito,
  ISNULL(v.vedObs, '')                                AS obs,
  ISNULL(v.vedTotalNf, 0)                             AS valorTotal,
  v.vedTipoAtend                                      AS tipoAtendId,
  ISNULL(tat.tatDesc, '')                             AS tipoAtendDesc,
  ISNULL(tat.tatCorDestaqueTexto, '')                 AS tipoAtendCor,
  ISNULL(tat.tatCorDestaqueFundo, '')                 AS tipoAtendCorFundo,
  ISNULL(tat.tatProGeraFinanceiro, 0)                 AS tipoAtendGeraFin,
  ISNULL(v.vedOsPrisma, '')                           AS prisma
FROM venda v
LEFT JOIN cliente c   ON c.cliId   = v.vedClienteId
LEFT JOIN veiculo ve  ON ve.veiId  = v.vedVeiculoId
LEFT JOIN tipoAtend tat ON tat.tatId = v.vedTipoAtend
WHERE v.empId    = @empId
  AND v.vedTipo  = 'OS'
  AND v.vedStatus NOT IN ('Z')
  AND (@statusFilter = '' OR v.vedStatus = @statusFilter)
  AND (@clienteNome  = '' OR COALESCE(c.cliNome, v.vedCliNome, '') LIKE @clienteNome)
  AND (@tipoAtend    = 0  OR v.vedTipoAtend = @tipoAtend)
  AND (@osNum        = 0  OR v.vedId = @osNum)
  AND (@placa        = '' OR COALESCE(ve.veiPlaca, '') LIKE @placa)
  AND (@marca        = '' OR ISNULL(v.vedMarca, '') LIKE @marca)
  AND (@prisma       = '' OR ISNULL(v.vedOsPrisma, '') LIKE @prisma)
  AND (@dtAbertIni   = '' OR CONVERT(DATE, v.vedAbertura) >= @dtAbertIni)
  AND (@dtAbertFim   = '' OR CONVERT(DATE, v.vedAbertura) <= @dtAbertFim)
ORDER BY v.vedAbertura DESC
`;

const LIST_TIPOS_ATENDIMENTO = `
SELECT tatId, tatDesc, tatCorDestaqueTexto, tatCorDestaqueFundo, tatProGeraFinanceiro
FROM tipoAtend
ORDER BY tatDesc
`;

const GET_OS_RESERVATIONS = `
SELECT COALESCE(SUM(vdi.vdiQtde), 0) AS reservado
FROM vendaItem vdi
INNER JOIN venda v ON v.vedId = vdi.vdiVedId
WHERE @tatIds <> ''
  AND vdi.vdiItemId  = @proId
  AND v.empId        = @empId
  AND v.vedTipo      = 'OS'
  AND v.vedStatus   NOT IN ('F', 'C', 'Z')
  AND vdi.vdiCancel  = 0
  AND v.vedTipoAtend IN (
      SELECT TRY_CAST(value AS INT)
      FROM   STRING_SPLIT(@tatIds, ',')
      WHERE  TRY_CAST(value AS INT) IS NOT NULL
  )
`;

const GET_SERVICE_ORDER_DETAIL = `
SELECT
  v.vedId              AS vedId,
  v.vedClienteId       AS clienteId,
  COALESCE(c.cliNome, v.vedCliNome) AS clienteNome,
  COALESCE(ve.veiPlaca, '')          AS placa,
  v.vedStatus          AS status,
  CONVERT(VARCHAR(23), v.vedAbertura, 126) AS dataAbertura,
  v.vedEquipamento     AS equipamento,
  v.vedMarca           AS marca,
  v.vedDefeito         AS defeito,
  v.vedObs             AS obs,
  v.vedLaudoTec        AS laudoTec
FROM venda v
LEFT JOIN cliente c  ON c.cliId  = v.vedClienteId
LEFT JOIN veiculo ve ON ve.veiId = v.vedVeiculoId
WHERE v.vedId = @osId
  AND v.empId  = @empId
  AND v.vedTipo = 'OS'
`;

const LIST_ERP_USERS = `
SELECT TOP 100
  c.cliId                AS cliId,
  c.cliNome              AS cliNome,
  ISNULL(c.cliEmail, '') AS cliEmail
FROM cliente c
WHERE c.empId = @empId
  AND c.cliUsuarioUsaSistema = 1
ORDER BY c.cliNome
`;

const GET_SERVICE_ORDER_ITEMS = `
SELECT
  vdi.vdiId            AS itemId,
  vdi.vdiItemId        AS proId,
  COALESCE(pe.proCodigo, '') AS proCodigo,
  vdi.vdiProNome       AS proDescricao,
  vdi.vdiProUn         AS proUn,
  vdi.vdiQtde          AS qtde,
  vdi.vdiValor         AS precoUnitario,
  (vdi.vdiQtde * vdi.vdiValor) AS totalItem,
  vdi.vdiCancel        AS cancelado
FROM vendaItem vdi
LEFT JOIN produto_empresa pe ON pe.proId = vdi.vdiItemId AND pe.empId = @empId
WHERE vdi.vdiVedId = @osId
  AND vdi.vdiCancel = 0
ORDER BY vdi.vdiId
`;

type QueryDef = {
  sql: string;
  allowedParams: string[];
};

const REGISTRY: Record<string, QueryDef> = {
  SEARCH_PRODUCTS: {
    sql: SEARCH_PRODUCTS,
    allowedParams: ["empId", "termoDesc", "termoCodigo", "termoCodigoExato", "termoCodigoId", "grupo"],
  },
  GET_PRODUCT_PHYSICAL_STOCK: {
    sql: GET_PRODUCT_PHYSICAL_STOCK,
    allowedParams: ["empId", "proId"],
  },
  LIST_INVENTORIES: {
    sql: LIST_INVENTORIES,
    allowedParams: ["empId"],
  },
  GET_FISCAL_STOCK_COMPOSITION: {
    sql: GET_FISCAL_STOCK_COMPOSITION,
    allowedParams: ["empId", "proId", "invId"],
  },
  GET_FISCAL_STOCK_NO_BASE: {
    sql: GET_FISCAL_STOCK_NO_BASE,
    allowedParams: ["empId", "proId"],
  },
  LIST_SERVICE_ORDERS: {
    sql: LIST_SERVICE_ORDERS,
    allowedParams: [
      "empId", "statusFilter", "clienteNome", "tipoAtend",
      "osNum", "placa", "marca", "prisma", "dtAbertIni", "dtAbertFim",
    ],
  },
  LIST_TIPOS_ATENDIMENTO: {
    sql: LIST_TIPOS_ATENDIMENTO,
    allowedParams: [],
  },
  GET_OS_RESERVATIONS: {
    sql: GET_OS_RESERVATIONS,
    allowedParams: ["empId", "proId", "tatIds"],
  },
  GET_SERVICE_ORDER_DETAIL: {
    sql: GET_SERVICE_ORDER_DETAIL,
    allowedParams: ["empId", "osId"],
  },
  GET_SERVICE_ORDER_ITEMS: {
    sql: GET_SERVICE_ORDER_ITEMS,
    allowedParams: ["osId", "empId"],
  },
  LIST_ERP_USERS: {
    sql: LIST_ERP_USERS,
    allowedParams: ["empId"],
  },
};

export type NamedQueryKey = keyof typeof REGISTRY;

export function resolveNamedQuery(
  queryName: NamedQueryKey,
  rawParams: Record<string, unknown>,
): { sql: string; params: Record<string, unknown> } {
  const def = REGISTRY[queryName];
  if (!def) {
    throw new Error(`Named query desconhecida: "${String(queryName)}"`);
  }
  const params: Record<string, unknown> = {};
  for (const key of def.allowedParams) {
    if (key in rawParams) params[key] = rawParams[key];
  }
  return { sql: def.sql, params };
}
