import { NextRequest, NextResponse } from "next/server";
import { requireFeatureWithLojas } from "@/lib/api/plan-guard";
import { getLojaDbConfig } from "@/lib/db/tenants";
import { queryBridge, BridgeError } from "@/lib/mssql/client";

export const dynamic = "force-dynamic";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface HomeSummaryResponse {
  periodo: { start: string; end: string; label: string };
  kpis: {
    faturamento: number;
    faturamentoVar: number | null;
    lucroLiquido: number;
    lucroVar: number | null;
    margemLucro: number;
    ticketMedio: number;
    ticketMedioVar: number | null;
    totalClientes: number;
    clientesNovos: number;
    clientesRecorrentes: number;
    totalVendas: number;
    totalVendasAnt: number;
    vendasVar: number | null;
  };
  emAberto: { qtd: number; valorTotal: number; qtdOs: number; qtdVendas: number };
  meta: {
    valor: number;
    percentAtingido: number | null;
    projecao: number;
    projecaoPercentMeta: number | null;
  };
  diasUteis: {
    trabalhados: number;
    restantes: number;
    total: number;
    percentual: number;
  };
  modulos: {
    vendas: {
      faturamento: number;
      ticketMedio: number;
      melhorVendedor: { nome: string; valor: number } | null;
      metaPercent: number | null;
      insight: string | null;
    };
    financeiro: {
      lucroLiquido: number;
      margemLucro: number;
      custoReceita: number;
      custoStatus: "ok" | "alert" | "danger";
      formaPrincipalPagto: string | null;
      formaPrincipalPercent: number;
      insight: string | null;
    };
    clientes: {
      total: number;
      /** total de clientes distintos, excluindo o(s) cadastro(s) genérico(s) de consumidor final (ver consumidorFinal) */
      identificados: number;
      taxaRecorrencia: number;
      perfilDominante: "PJ" | "PF";
      perfilPercent: number;
      /** Maior cliente do período em valor — pode ser o cadastro genérico de consumidor final, se ele de fato liderar. */
      maiorCliente: { nome: string; valor: number } | null;
      /** Maior cliente do período excluindo cadastros genéricos de consumidor final — calculado
       *  a partir do mesmo dado completo de maiorCliente, não uma estimativa. null apenas se
       *  100% das vendas do período foram para cadastros genéricos. */
      maiorClienteIdentificado: { nome: string; valor: number } | null;
      /** Vendas de balcão/venda rápida atribuídas ao(s) cadastro(s) genérico(s) de consumidor
       *  final. Detecção: cliId = 1 (observação de campo, não flag documentada do schema) OU
       *  nome contendo "CONSUMIDOR" ou "BALC" — ver SQL_CONSUMIDOR_FINAL. Representa uma
       *  operação comercial válida (venda rápida/balcão), não um erro de cadastro. */
      consumidorFinal: { valor: number; qtd: number; clientesDistintos: number; percentFaturamento: number };
      insight: string | null;
    };
    produtos: {
      topProdutos: Array<{ nome: string; valor: number; qtde: number; percent: number }>;
      insight: string | null;
    };
  };
  rankingVendedores: Array<{ nome: string; valor: number; percent: number }>;
}

// ── Interfaces auxiliares ─────────────────────────────────────────────────────

interface KpiRow {
  faturamento: number;
  totalVendas: number;
}

interface CustoRow {
  custo: number;
}

interface ClienteStatsRow {
  clienteId: number;
  n: number;
}

interface EmAbertoRow {
  qtd: number;
  valorTotal: number;
}

interface MetaRow {
  metaTotal: number;
}

interface VendedorRow {
  nome: string;
  valor: number;
}

interface FormaPagtoRow {
  forma: string;
  total: number;
}

interface TotalPagtoRow {
  totalGeral: number;
}

interface PerfilRow {
  pf: number;
  pj: number;
}

interface ProdutoRow {
  nome: string;
  valor: number;
  qtde: number;
}

interface MaiorClienteRow {
  cliId: number;
  nome: string;
  valor: number;
}

interface ConsumidorFinalRow {
  valor: number;
  clientesDistintos: number;
  qtd: number;
}

// ── Período anterior ──────────────────────────────────────────────────────────

function periodoAnterior(
  period: string,
  currentStart: string,
  currentEnd: string
): { start: string; end: string } {
  function parseUtc(s: string): Date {
    const [y, mo, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, mo - 1, d));
  }
  function fmtUtc(d: Date): string {
    return d.toISOString().split("T")[0];
  }
  function shiftDays(d: Date, n: number): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
  }

  const start    = parseUtc(currentStart);
  const end      = parseUtc(currentEnd);
  const spanDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const sy = start.getUTCFullYear();
  const sm = start.getUTCMonth();

  switch (period) {
    case "today":
      return { start: fmtUtc(shiftDays(start, -1)), end: fmtUtc(shiftDays(start, -1)) };
    case "7d":
      return { start: fmtUtc(shiftDays(start, -7)), end: fmtUtc(shiftDays(end, -7)) };
    case "month":
      return {
        start: fmtUtc(new Date(Date.UTC(sy, sm - 1, 1))),
        end:   fmtUtc(new Date(Date.UTC(sy, sm,     0))),
      };
    case "3m":
      return {
        start: fmtUtc(new Date(Date.UTC(sy, sm - 3, 1))),
        end:   fmtUtc(new Date(Date.UTC(sy, sm,     0))),
      };
    case "year":
      return { start: `${sy - 1}-01-01`, end: `${sy - 1}-12-31` };
    case "prev-year":
      return { start: `${sy - 1}-01-01`, end: `${sy - 1}-12-31` };
    case "custom":
      return {
        start: fmtUtc(shiftDays(start, -spanDays)),
        end:   fmtUtc(shiftDays(start, -1)),
      };
    default:
      return {
        start: fmtUtc(new Date(Date.UTC(sy, sm - 1, 1))),
        end:   fmtUtc(new Date(Date.UTC(sy, sm,     0))),
      };
  }
}

// ── Helpers — Dias Úteis ─────────────────────────────────────────────────────

function calcDiasUteis(ano: number, mes: number): {
  trabalhados: number;
  restantes: number;
  total: number;
  percentual: number;
} {
  const hoje = new Date();
  const hojeAno  = hoje.getFullYear();
  const hojesMes = hoje.getMonth() + 1;
  const hojesDia = hoje.getDate();

  let total = 0;
  let trabalhados = 0;
  const ultimoDia = new Date(ano, mes, 0).getDate();

  for (let dia = 1; dia <= ultimoDia; dia++) {
    const d = new Date(ano, mes - 1, dia);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    total++;
    if (ano < hojeAno || (ano === hojeAno && mes < hojesMes)) {
      trabalhados++;
    } else if (ano === hojeAno && mes === hojesMes && dia <= hojesDia) {
      trabalhados++;
    }
  }

  const restantes = total - trabalhados;
  const percentual = total > 0 ? Math.round((trabalhados / total) * 100) : 0;
  return { trabalhados, restantes, total, percentual };
}

// ── Helpers — Insights ───────────────────────────────────────────────────────

function insightFinanceiro(custoReceita: number): string | null {
  if (custoReceita > 75) return "⚠ Custo acima de 75% — atenção à margem";
  if (custoReceita > 65) return "⚠ Custo acima do ideal (65%)";
  return null;
}

function insightClientes(taxaRecorrencia: number): string | null {
  if (taxaRecorrencia > 50) return "✓ Taxa de fidelização acima da média do segmento";
  return null;
}

function insightProdutos(topPercent: number): string | null {
  if (topPercent > 40) return "⚠ Produto principal concentra mais de 40% do faturamento";
  if (topPercent > 25) return "⚠ Alta dependência do produto principal";
  return null;
}

function insightVendas(metaPercent: number | null): string | null {
  if (metaPercent === null) return null;
  if (metaPercent >= 100) return "✓ Meta do período superada!";
  if (metaPercent >= 78) return "✓ Faturamento acima da média dos últimos 3 meses";
  return null;
}

function variacaoPercent(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return parseFloat(((atual - anterior) / anterior * 100).toFixed(2));
}

// ── SQL Queries ───────────────────────────────────────────────────────────────

// vedTotalNf > 0 alinha com /api/dashboard/kpis (buildSqlKpis): exclui documentos de
// valor zero/negativo da contagem de vendas e do faturamento, mesmo critério usado
// no Dashboard de Vendas — antes a Home contava esses documentos e o Dashboard não.
const SQL_KPI = `
  SELECT
    ISNULL(SUM(vedTotalNf), 0)                   AS faturamento,
    COUNT(*)                                       AS totalVendas
  FROM venda
  WHERE empId = @empId
    AND vedStatus = 'F'
    AND vedTipo IN ('OS', 'VE')
    AND vedTotalNf > 0
    AND CONVERT(date, vedFechamento) BETWEEN @start AND @end`;

// vedTotalNf > 0 no JOIN de venda alinha com /api/dashboard/kpis (buildSqlCusto).
const SQL_CUSTO = `
  SELECT ISNULL(SUM(vi.vdiQtde * vi.vdiProCustoFinal), 0) AS custo
  FROM vendaItem vi
  JOIN venda v ON vi.vdiVedId = v.vedId
  WHERE v.empId = @empId
    AND v.vedStatus = 'F'
    AND v.vedTipo IN ('OS', 'VE')
    AND v.vedTotalNf > 0
    AND vi.vdiCancel = 0
    AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end`;

// Regra de recorrência alinhada à do Dashboard de Clientes (/api/dashboard/clientes/overview,
// query "Taxa de recorrência"): recorrente = cliente com MAIS DE 1 compra finalizada em toda
// a vida do cadastro (contagem all-time), não "comprou antes do início deste período". É uma
// definição diferente da usada em /api/dashboard/charts?type=clientes-retencao (que conta
// "primeira compra antes do período") — essa era a regra que a Home usava até esta revisão,
// e por isso batia com o widget de retenção do Dashboard de Vendas, mas não com o Dashboard
// de Clientes. Escolhemos aqui bater com o Dashboard de Clientes por ser o destino nomeado
// nesta revisão; isso significa que a Home agora DIVERGE do widget de retenção do Dashboard
// de Vendas — um mesmo termo ("cliente recorrente") com três regras diferentes já convivia
// no código antes desta mudança (Home antiga, Dashboard de Vendas, Dashboard de Clientes);
// unificar as três exigiria alterar também as outras duas telas, fora do escopo desta revisão.
//
// Diferença deliberada e documentada em relação à query original do Dashboard de Clientes:
// aqui excluímos vedClienteId = 0 (sentinela de "sem cliente identificado"), que a query
// original não exclui — sem essa exclusão, vendas sem cliente identificado seriam contadas
// como se fossem repetidas compras de um único "cliente" (id 0), inflando artificialmente a
// contagem de recorrentes.
//
// IMPORTANTE (correção 2026-07-06): a classificação novo/recorrente NÃO é feita mais dentro
// desta query. Antes ela rodava uma vez por loja e já devolvia "novos"/"recorrentes" prontos,
// que o chamador somava entre lojas — isso conta errado um cliente que compra em mais de uma
// loja selecionada (ex.: 1 compra na loja A + 1 compra na loja B = deveria ser "recorrente"
// no total, mas cada loja isoladamente via só 1 compra e classificava como "novo" duas vezes).
// Agora esta query só devolve, por cliente, a contagem all-time de compras NESTA loja; o
// chamador soma essa contagem entre lojas da MESMA bridge (mesmo banco = mesmo cliId) antes
// de decidir novo (n<=1) vs recorrente (n>1) — ver consolidação após o loop.
const SQL_CLIENTES_STATS = `
  WITH compras AS (
    SELECT vedClienteId, COUNT(*) AS n
    FROM venda
    WHERE empId = @empId AND vedStatus = 'F' AND vedTipo IN ('OS','VE')
      AND vedFechamento IS NOT NULL
      AND vedClienteId IS NOT NULL AND vedClienteId <> 0
    GROUP BY vedClienteId
  )
  SELECT DISTINCT cp.vedClienteId AS clienteId, cp.n AS n
  FROM compras cp
  WHERE EXISTS (
    SELECT 1 FROM venda v
    WHERE v.vedClienteId = cp.vedClienteId AND v.empId = @empId
      AND v.vedStatus = 'F' AND v.vedTipo IN ('OS','VE')
      AND v.vedFechamento IS NOT NULL
      AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
  )`;

// Aguardando supervisão (tela 113 do MaxManager = vedStatus 'S'), não 'O' —
// 'O' são vendas abandonadas, confirmado no bridge de testes (SALES) em 2026-07-11.
// vdiValor é preço unitário, não total da linha — multiplicar por vdiQtde.
const SQL_VE_ABERTO = `
  SELECT COUNT(DISTINCT v.vedId) AS qtd,
         ISNULL(SUM(vi.vdiQtde * vi.vdiValor), 0) AS valorTotal
  FROM venda v
  LEFT JOIN vendaItem vi ON vi.vdiVedId = v.vedId AND vi.vdiCancel = 0
  WHERE v.vedStatus = 'S'
    AND v.vedTipo = 'VE'
    AND v.empId = @empId`;

const SQL_OS_ABERTO = `
  SELECT COUNT(DISTINCT v.vedId) AS qtd,
         ISNULL(SUM(vi.vdiQtde * vi.vdiValor), 0) AS valorTotal
  FROM venda v
  INNER JOIN tipoAtend ta ON ta.tatId = CAST(v.vedTipoAtend AS INT)
  LEFT JOIN vendaItem vi ON vi.vdiVedId = v.vedId AND vi.vdiCancel = 0
  WHERE v.vedStatus = 'S'
    AND v.vedTipo = 'OS'
    AND ta.tatServGeraFinanceiro = 1
    AND v.empId = @empId`;

const SQL_META = `
  SELECT ISNULL(SUM(
    CASE MONTH(GETDATE())
      WHEN 1  THEN ummValorMetaMes01 WHEN 2  THEN ummValorMetaMes02
      WHEN 3  THEN ummValorMetaMes03 WHEN 4  THEN ummValorMetaMes04
      WHEN 5  THEN ummValorMetaMes05 WHEN 6  THEN ummValorMetaMes06
      WHEN 7  THEN ummValorMetaMes07 WHEN 8  THEN ummValorMetaMes08
      WHEN 9  THEN ummValorMetaMes09 WHEN 10 THEN ummValorMetaMes10
      WHEN 11 THEN ummValorMetaMes11 WHEN 12 THEN ummValorMetaMes12
    END
  ), 0) AS metaTotal
  FROM usuarioMetaMensal
  WHERE empId = @empId AND ummAno = YEAR(GETDATE())`;

// Sem TOP: a Home consulta cada loja selecionada separadamente e mescla os resultados
// no JS (ver loop abaixo). Qualquer TOP aplicado aqui, por maior que seja, corta
// candidatos ANTES da consolidação multi-loja — um vendedor pode ficar fora do TOP N
// de cada loja individualmente e ainda assim ser o maior ao somar todas as lojas
// selecionadas (ex.: 51º em cada uma das 2 lojas, mas 1º ao consolidar). Só é seguro
// aplicar corte DEPOIS de somar por nome entre lojas — o que já é feito mais abaixo
// (allVendedores → vendedorMap → rankingVendedores, corte final em 5). O volume desta
// consulta é por natureza pequeno (um vendedor por linha, tipicamente dezenas por
// loja), então remover o TOP não tem custo de performance perceptível aqui. Se algum
// dia o volume crescer a ponto de doer, a alternativa correta é migrar para uma única
// consulta com `empId IN (...)` via getLojasBridge (como /api/dashboard/charts já faz),
// que hoje não é usada nesta rota porque cada loja pode ter uma bridge SQL distinta.
const SQL_VENDEDORES = `
  SELECT
    c.cliNome AS nome,
    ISNULL(SUM(v.vedTotalNf), 0) AS valor
  FROM venda v
  JOIN cliente c ON v.vedAtendente = c.cliId
  WHERE v.vedStatus = 'F' AND v.vedTipo IN ('OS','VE')
    AND v.vedTotalNf > 0 AND v.empId = @empId
    AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
  GROUP BY c.cliId, c.cliNome
  ORDER BY valor DESC`;

// Sem TOP: retorna todas as formas de pagamento da loja (tipicamente poucas dezenas de
// linhas). Antes só trazia a líder de CADA loja (TOP 1), então ao combinar lojas a
// forma realmente dominante podia nunca ser capturada se fosse a 2ª em todas elas.
// A agregação por nome (allFormas → formaMap, mais abaixo) já soma corretamente
// entre lojas — só precisava receber o conjunto completo, não só o topo de cada uma.
const SQL_FORMA_PRINCIPAL = `
  SELECT
    pgtTipoDesc AS forma,
    SUM(pgtValor) AS total
  FROM vendaPgto vp
  JOIN venda v ON vp.pgtVendaId = v.vedId
  WHERE v.empId = @empId AND v.vedStatus = 'F'
    AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
  GROUP BY pgtTipoDesc
  ORDER BY total DESC`;

const SQL_TOTAL_PAGTO = `
  SELECT ISNULL(SUM(pgtValor), 0) AS totalGeral
  FROM vendaPgto vp
  JOIN venda v ON vp.pgtVendaId = v.vedId
  WHERE v.empId = @empId AND v.vedStatus = 'F'
    AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end`;

const SQL_PERFIL = `
  SELECT
    SUM(CASE WHEN LEN(REPLACE(REPLACE(REPLACE(c.cliCpfCgc,'.',''),'-',''),'/','')) = 11 THEN 1 ELSE 0 END) AS pf,
    SUM(CASE WHEN LEN(REPLACE(REPLACE(REPLACE(c.cliCpfCgc,'.',''),'-',''),'/','')) <> 11 THEN 1 ELSE 0 END) AS pj
  FROM venda v
  JOIN cliente c ON v.vedClienteId = c.cliId
  WHERE v.empId = @empId AND v.vedStatus = 'F' AND v.vedTipo IN ('OS','VE')
    AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
    AND v.vedClienteId IS NOT NULL AND v.vedClienteId <> 0`;

// Sem TOP, pelo mesmo motivo de SQL_VENDEDORES: qualquer corte por loja antes da
// consolidação multi-loja pode esconder o produto líder real do conjunto combinado.
// O corte final (top 3) só é aplicado depois de somar por nome entre lojas, mais abaixo.
const SQL_TOP_PRODUTOS = `
  SELECT
    vi.vdiProNome                              AS nome,
    ISNULL(SUM(vi.vdiQtde * vi.vdiValor), 0)  AS valor,
    ISNULL(SUM(vi.vdiQtde), 0)                AS qtde
  FROM vendaItem vi
  JOIN venda v ON vi.vdiVedId = v.vedId
  WHERE vi.vdiCancel = 0 AND v.vedStatus = 'F'
    AND v.vedTipo IN ('OS','VE')
    AND v.empId = @empId
    AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
  GROUP BY vi.vdiProNome
  ORDER BY valor DESC`;

// Sem TOP (antes TOP 1, depois TOP 50) — nenhum corte antes da consolidação multi-loja.
// Um cliente que compra em várias lojas tem o valor somado por nome no JS (ver "Maior
// cliente" mais abaixo) antes de escolher o maior, e sem TOP não há como "sumir" um
// candidato: todo cliente com pelo menos 1 compra no período retorna nesta consulta.
// Inclui c.cliId para permitir excluir corretamente o cadastro genérico de consumidor
// final (cliId = 1, ver SQL_CONSUMIDOR_FINAL) do "maior cliente identificado", sem
// depender só do nome.
const SQL_MAIOR_CLIENTE = `
  SELECT
    c.cliId AS cliId,
    c.cliNome AS nome,
    ISNULL(SUM(v.vedTotalNf), 0) AS valor
  FROM venda v
  JOIN cliente c ON v.vedClienteId = c.cliId
  WHERE v.empId = @empId AND v.vedStatus = 'F' AND v.vedTipo IN ('OS','VE')
    AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
    AND v.vedClienteId IS NOT NULL AND v.vedClienteId <> 0
  GROUP BY v.vedClienteId, c.cliId, c.cliNome
  ORDER BY valor DESC`;

// Vendas de balcão para o cadastro genérico "consumidor final" — uma operação comercial
// válida (ex.: NFC-e de venda rápida), não um erro de cadastro.
//
// Detecção (heurística, sem flag dedicada no schema acessível a este projeto):
//  1. c.cliId = 1 — sinal PRIMÁRIO. Observação de campo (não uma garantia documentada do
//     MaxManager): o cadastro genérico de consumidor final tende a ocupar sempre o cliId=1
//     de cada loja/empId, o mesmo padrão já visto em produto (proId=1 é o "curinga" — ver
//     memória do projeto). Ainda assim é uma convenção observada, não uma regra de schema.
//  2. Nome contém "CONSUMIDOR" — cobre "CONSUMIDOR", "CONSUMIDOR FINAL", "CLIENTE CONSUMIDOR".
//  3. Nome contém "BALC" — cobre "CLIENTE BALCÃO"/"CLIENTE BALCAO" e "VENDA BALCÃO"/"VENDA
//     BALCAO" (substring comum às duas grafias, com e sem acento).
// Usada tanto para o agregado de "vendas para consumidor final" quanto (via cliId/nome, ver
// isGenericConsumidor mais abaixo) para excluir esse cadastro do "maior cliente identificado".
// clientesDistintos permite abater esse(s) cadastro(s) de "clientes atendidos" para chegar
// em "clientes identificados" sem alterar o total bruto.
const SQL_CONSUMIDOR_FINAL = `
  SELECT
    ISNULL(SUM(v.vedTotalNf), 0)        AS valor,
    COUNT(*)                             AS qtd,
    COUNT(DISTINCT v.vedClienteId)       AS clientesDistintos
  FROM venda v
  JOIN cliente c ON v.vedClienteId = c.cliId
  WHERE v.empId = @empId AND v.vedStatus = 'F' AND v.vedTipo IN ('OS','VE')
    AND v.vedTotalNf > 0
    AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
    AND (c.cliId = 1 OR c.cliNome LIKE '%CONSUMIDOR%' OR c.cliNome LIKE '%BALC%')`;

// Mesma heurística de SQL_CONSUMIDOR_FINAL, aplicada no JS sobre as linhas de
// SQL_MAIOR_CLIENTE (que já trazem cliId) para decidir o "maior cliente identificado".
function isGenericConsumidor(nome: string, cliId: number): boolean {
  if (cliId === 1) return true;
  return /consumidor|balc/i.test(nome);
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;

  // Suporte a lojaIds (multi) ou lojaId (legado single)
  const lojaIdsParam = searchParams.get("lojaIds");
  const lojaIdParam  = searchParams.get("lojaId");
  const lojaIds = lojaIdsParam
    ? lojaIdsParam.split(",").filter(Boolean)
    : lojaIdParam
    ? [lojaIdParam]
    : [];

  if (lojaIds.length === 0) {
    return NextResponse.json({ error: "lojaId ou lojaIds é obrigatório" }, { status: 400 });
  }

  const guard = await requireFeatureWithLojas("dashboard_visao_geral", lojaIds);
  if (guard instanceof NextResponse) return guard;

  // Período — usa parâmetros do cliente se fornecidos, senão mês atual
  const agora   = new Date();
  const ano     = agora.getFullYear();
  const mes     = agora.getMonth() + 1;
  const mesStr  = String(mes).padStart(2, "0");
  const diaStr   = String(agora.getDate()).padStart(2, "0");
  const period   = searchParams.get("period") ?? "month";
  const startStr = searchParams.get("start") ?? `${ano}-${mesStr}-01`;
  const endStr   = searchParams.get("end")   ?? `${ano}-${mesStr}-${diaStr}`;

  const anterior = periodoAnterior(period, startStr, endStr);

  // Dias úteis e meta sempre usam mês atual como referência de progresso
  const diasUteis = calcDiasUteis(ano, mes);

  const safe = <T>(promise: Promise<T[]>, fallback: T[]): Promise<T[]> =>
    promise.catch((e) => {
      const msg = e instanceof BridgeError ? e.message : String(e instanceof Error ? e.message : e);
      console.error("[home/summary] query error:", msg);
      return fallback;
    });

  // Acumuladores para multi-loja
  let faturamento    = 0, totalVendas    = 0, custo    = 0;
  let faturamentoAnt = 0, totalVendasAnt = 0, custoAnt = 0;
  let qtdVendas = 0, qtdOs = 0, valorAbertoVe = 0, valorAbertoOs = 0;
  let metaValor = 0;
  let qtdPf = 0, qtdPj = 0;
  let totalPagto = 0;
  let valorConsumidorFinal = 0, qtdConsumidorFinal = 0, clientesDistintosConsumidorFinal = 0;

  // Estatísticas de cliente (contagem all-time de compras) consolidadas entre lojas antes de
  // classificar novo/recorrente — chave inclui a bridge porque cliId só é comparável dentro do
  // mesmo banco. Ver comentário em SQL_CLIENTES_STATS para o motivo da correção.
  const clienteStatsMap = new Map<string, number>();

  // Listas para qualitativo (top vendedores, topProdutos, etc.)
  const allVendedores: VendedorRow[] = [];
  const allProdutos:   ProdutoRow[]  = [];
  const allClientes:   MaiorClienteRow[] = [];
  const allFormas:     FormaPagtoRow[] = [];

  let bridgeFound = false;

  for (const id of lojaIds) {
    const config = await getLojaDbConfig(id).catch(() => null);
    if (!config) continue;
    bridgeFound = true;

    const ep  = { empId: config.empId };
    const sp  = { start: startStr, end: endStr };
    const spa = { start: anterior.start, end: anterior.end };

    const [
      kpiRows, kpiAntRows,
      custoRows, custoAntRows,
      clienteStatsRows,
      veAbertoRows, osAbertoRows,
      metaRows,
      vendedoresRows,
      formaPrincipalRows, totalPagtoRows,
      perfilRows,
      topProdutosRows,
      maiorClienteRows,
      consumidorFinalRows,
    ] = await Promise.all([
      safe(queryBridge<KpiRow>(config, SQL_KPI, { ...ep, ...sp }), []),
      safe(queryBridge<KpiRow>(config, SQL_KPI, { ...ep, ...spa }), []),
      safe(queryBridge<CustoRow>(config, SQL_CUSTO, { ...ep, ...sp }), []),
      safe(queryBridge<CustoRow>(config, SQL_CUSTO, { ...ep, ...spa }), []),
      safe(queryBridge<ClienteStatsRow>(config, SQL_CLIENTES_STATS, { ...ep, ...sp }), []),
      safe(queryBridge<EmAbertoRow>(config, SQL_VE_ABERTO, ep), []),
      safe(queryBridge<EmAbertoRow>(config, SQL_OS_ABERTO, ep), []),
      safe(queryBridge<MetaRow>(config, SQL_META, ep), []),
      safe(queryBridge<VendedorRow>(config, SQL_VENDEDORES, { ...ep, ...sp }), []),
      safe(queryBridge<FormaPagtoRow>(config, SQL_FORMA_PRINCIPAL, { ...ep, ...sp }), []),
      safe(queryBridge<TotalPagtoRow>(config, SQL_TOTAL_PAGTO, { ...ep, ...sp }), []),
      safe(queryBridge<PerfilRow>(config, SQL_PERFIL, { ...ep, ...sp }), []),
      safe(queryBridge<ProdutoRow>(config, SQL_TOP_PRODUTOS, { ...ep, ...sp }), []),
      safe(queryBridge<MaiorClienteRow>(config, SQL_MAIOR_CLIENTE, { ...ep, ...sp }), []),
      safe(queryBridge<ConsumidorFinalRow>(config, SQL_CONSUMIDOR_FINAL, { ...ep, ...sp }), []),
    ]);

    const kpi    = kpiRows[0]    ?? { faturamento: 0, totalVendas: 0 };
    const kpiAnt = kpiAntRows[0] ?? { faturamento: 0, totalVendas: 0 };

    faturamento     += Number(kpi.faturamento    ?? 0);
    totalVendas     += Number(kpi.totalVendas    ?? 0);
    custo           += Number(custoRows[0]?.custo    ?? 0);
    faturamentoAnt  += Number(kpiAnt.faturamento ?? 0);
    totalVendasAnt  += Number(kpiAnt.totalVendas ?? 0);
    custoAnt        += Number(custoAntRows[0]?.custo ?? 0);

    for (const row of clienteStatsRows) {
      const key = `${config.bridgeUrl}::${row.clienteId}`;
      clienteStatsMap.set(key, (clienteStatsMap.get(key) ?? 0) + Number(row.n ?? 0));
    }

    qtdVendas      += Number(veAbertoRows[0]?.qtd        ?? 0);
    qtdOs          += Number(osAbertoRows[0]?.qtd        ?? 0);
    valorAbertoVe  += Number(veAbertoRows[0]?.valorTotal ?? 0);
    valorAbertoOs  += Number(osAbertoRows[0]?.valorTotal ?? 0);

    metaValor += Number(metaRows[0]?.metaTotal ?? 0);

    const perfil = perfilRows[0] ?? { pf: 0, pj: 0 };
    qtdPf += Number(perfil.pf ?? 0);
    qtdPj += Number(perfil.pj ?? 0);

    totalPagto += Number(totalPagtoRows[0]?.totalGeral ?? 0);

    const consumidorFinal = consumidorFinalRows[0] ?? { valor: 0, qtd: 0, clientesDistintos: 0 };
    valorConsumidorFinal              += Number(consumidorFinal.valor ?? 0);
    qtdConsumidorFinal                += Number(consumidorFinal.qtd ?? 0);
    clientesDistintosConsumidorFinal  += Number(consumidorFinal.clientesDistintos ?? 0);

    for (const v of vendedoresRows) allVendedores.push({ nome: v.nome, valor: Number(v.valor ?? 0) });
    for (const p of topProdutosRows) allProdutos.push({ nome: p.nome, valor: Number(p.valor ?? 0), qtde: Number(p.qtde ?? 0) });
    // Coleta todas as linhas (não só a [0]) — a agregação por nome abaixo soma o
    // mesmo cliente/forma de pagamento entre lojas antes de escolher o maior.
    for (const c of maiorClienteRows) allClientes.push({ cliId: Number(c.cliId), nome: c.nome, valor: Number(c.valor ?? 0) });
    for (const f of formaPrincipalRows) allFormas.push({ forma: f.forma, total: Number(f.total ?? 0) });
  }

  if (!bridgeFound) {
    return NextResponse.json(
      { error: "Bridge SQL não configurada para esta loja. Acesse Admin → Empresas → Lojas → Bridge." },
      { status: 503 }
    );
  }

  // Classifica novo/recorrente só agora, depois de consolidar a contagem all-time de compras
  // por cliente entre todas as lojas selecionadas da mesma bridge (ver SQL_CLIENTES_STATS).
  let totalClientes = 0, clientesNovos = 0, clientesRecorrentes = 0;
  for (const n of clienteStatsMap.values()) {
    totalClientes++;
    if (n > 1) clientesRecorrentes++; else clientesNovos++;
  }

  // ── Cálculos derivados ────────────────────────────────────────────────────

  const lucroLiquido   = faturamento - custo;
  const lucroLiquidoAnt = faturamentoAnt - custoAnt;
  const margemLucro    = faturamento > 0 ? parseFloat(((lucroLiquido / faturamento) * 100).toFixed(2)) : 0;
  const custoReceita   = faturamento > 0 ? parseFloat(((custo / faturamento) * 100).toFixed(2)) : 0;
  const ticketMedio    = totalVendas > 0 ? parseFloat((faturamento / totalVendas).toFixed(2)) : 0;
  const ticketMedioAnt = totalVendasAnt > 0 ? parseFloat((faturamentoAnt / totalVendasAnt).toFixed(2)) : 0;

  const faturamentoVar = variacaoPercent(faturamento, faturamentoAnt);
  const lucroVar       = variacaoPercent(lucroLiquido, lucroLiquidoAnt);
  const ticketMedioVar = variacaoPercent(ticketMedio, ticketMedioAnt);
  const vendasVar      = variacaoPercent(totalVendas, totalVendasAnt);

  const totalRecorrencia = clientesNovos + clientesRecorrentes;
  const taxaRecorrencia  = totalRecorrencia > 0
    ? parseFloat(((clientesRecorrentes / totalRecorrencia) * 100).toFixed(2))
    : 0;

  // Ranking vendedores: agrupa por nome, soma valor, ordena
  const vendedorMap = new Map<string, number>();
  for (const v of allVendedores) {
    vendedorMap.set(v.nome, (vendedorMap.get(v.nome) ?? 0) + v.valor);
  }
  const rankingVendedoresRaw = Array.from(vendedorMap.entries())
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);
  const totalVendedores = rankingVendedoresRaw.reduce((s, v) => s + v.valor, 0);
  const rankingVendedores = rankingVendedoresRaw.map((v) => ({
    nome: v.nome,
    valor: v.valor,
    percent: totalVendedores > 0 ? parseFloat(((v.valor / totalVendedores) * 100).toFixed(2)) : 0,
  }));
  const melhorVendedor = rankingVendedores[0] ? { nome: rankingVendedores[0].nome, valor: rankingVendedores[0].valor } : null;

  // Top produtos: agrupa por nome, soma valor+qtde, ordena
  const prodMap = new Map<string, { valor: number; qtde: number }>();
  for (const p of allProdutos) {
    const cur = prodMap.get(p.nome) ?? { valor: 0, qtde: 0 };
    prodMap.set(p.nome, { valor: cur.valor + p.valor, qtde: cur.qtde + p.qtde });
  }
  const topProdutosRaw = Array.from(prodMap.entries())
    .map(([nome, { valor, qtde }]) => ({ nome, valor, qtde }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 3);
  const topProdutos = topProdutosRaw.map((p) => ({
    nome: p.nome,
    valor: p.valor,
    qtde: p.qtde,
    percent: faturamento > 0 ? parseFloat(((p.valor / faturamento) * 100).toFixed(2)) : 0,
  }));

  // Maior cliente: agrupa por nome antes de escolher o maior — um cliente que compra
  // em mais de uma loja selecionada tem o valor somado entre elas (ver SQL_MAIOR_CLIENTE,
  // que agora não tem TOP — todo cliente do período entra nesta agregação, sem exceção).
  const clienteMap = new Map<string, { valor: number; generico: boolean }>();
  for (const c of allClientes) {
    const cur = clienteMap.get(c.nome) ?? { valor: 0, generico: false };
    clienteMap.set(c.nome, {
      valor: cur.valor + c.valor,
      generico: cur.generico || isGenericConsumidor(c.nome, c.cliId),
    });
  }
  const clienteEntries = Array.from(clienteMap.entries())
    .map(([nome, v]) => ({ nome, valor: v.valor, generico: v.generico }))
    .sort((a, b) => b.valor - a.valor);

  // Maior cliente (geral) — pode ser o cadastro genérico de consumidor final, se ele
  // de fato concentrar o maior volume do período.
  const maiorClienteTop = clienteEntries[0];
  const maiorCliente = maiorClienteTop ? { nome: maiorClienteTop.nome, valor: maiorClienteTop.valor } : null;

  // Maior cliente IDENTIFICADO — calculado a partir do mesmo conjunto completo de dados
  // (não uma estimativa à parte), apenas excluindo os cadastros genéricos identificados
  // por isGenericConsumidor. Só fica null se TODAS as vendas do período foram para
  // cadastros genéricos — nesse caso não há dado para apurar um cliente real "maior".
  const maiorClienteIdentificadoTop = clienteEntries.find((c) => !c.generico) ?? null;
  const maiorClienteIdentificado = maiorClienteIdentificadoTop
    ? { nome: maiorClienteIdentificadoTop.nome, valor: maiorClienteIdentificadoTop.valor }
    : null;

  // Forma principal de pagamento
  const formaMap = new Map<string, number>();
  for (const f of allFormas) {
    formaMap.set(f.forma, (formaMap.get(f.forma) ?? 0) + f.total);
  }
  const formaTop = Array.from(formaMap.entries()).sort((a, b) => b[1] - a[1])[0];
  const formaPrincipalPagto = formaTop?.[0] ?? null;
  const formaPrincipalPercent = formaPrincipalPagto && totalPagto > 0
    ? parseFloat((((formaTop?.[1] ?? 0) / totalPagto) * 100).toFixed(2))
    : 0;

  // Perfil PJ/PF
  const totalPerfil = qtdPf + qtdPj;
  const perfilDominante: "PJ" | "PF" = qtdPj >= qtdPf ? "PJ" : "PF";
  const perfilPercent = totalPerfil > 0
    ? parseFloat((((perfilDominante === "PJ" ? qtdPj : qtdPf) / totalPerfil) * 100).toFixed(2))
    : 0;

  // Meta e projeção (sempre mês atual)
  const percentAtingido = metaValor > 0
    ? parseFloat(((faturamento / metaValor) * 100).toFixed(2))
    : null;
  const diasTrabalhados = diasUteis.trabalhados;
  const projecao = diasTrabalhados > 0
    ? parseFloat(((faturamento / diasTrabalhados) * diasUteis.total).toFixed(2))
    : 0;
  const projecaoPercentMeta = metaValor > 0
    ? parseFloat(((projecao / metaValor) * 100).toFixed(2))
    : null;

  const metaPercentVendas = percentAtingido;

  // Consumidor final: "clientes identificados" abate do total os cadastros genéricos
  // de consumidor final detectados (heurística por nome — ver SQL_CONSUMIDOR_FINAL).
  const clientesIdentificados = Math.max(totalClientes - clientesDistintosConsumidorFinal, 0);
  const consumidorFinalPercent = faturamento > 0
    ? parseFloat(((valorConsumidorFinal / faturamento) * 100).toFixed(2))
    : 0;

  // Label do período
  const periodoLabel = period === "month"
    ? `${agora.toLocaleString("pt-BR", { month: "long" })} ${ano}`
    : `${startStr} — ${endStr}`;

  const response: HomeSummaryResponse = {
    periodo: { start: startStr, end: endStr, label: periodoLabel },
    kpis: {
      faturamento,
      faturamentoVar,
      lucroLiquido,
      lucroVar,
      margemLucro,
      ticketMedio,
      ticketMedioVar,
      totalClientes,
      clientesNovos,
      clientesRecorrentes,
      totalVendas,
      totalVendasAnt,
      vendasVar,
    },
    emAberto: {
      qtd: qtdVendas + qtdOs,
      valorTotal: valorAbertoVe + valorAbertoOs,
      qtdOs,
      qtdVendas,
    },
    meta: {
      valor: metaValor,
      percentAtingido,
      projecao,
      projecaoPercentMeta,
    },
    diasUteis,
    modulos: {
      vendas: {
        faturamento,
        ticketMedio,
        melhorVendedor,
        metaPercent: metaPercentVendas,
        insight: insightVendas(metaPercentVendas),
      },
      financeiro: {
        lucroLiquido,
        margemLucro,
        custoReceita,
        custoStatus: custoReceita > 75 ? "danger" : custoReceita > 65 ? "alert" : "ok",
        formaPrincipalPagto,
        formaPrincipalPercent,
        insight: insightFinanceiro(custoReceita),
      },
      clientes: {
        total: totalClientes,
        identificados: clientesIdentificados,
        taxaRecorrencia,
        perfilDominante,
        perfilPercent,
        maiorCliente,
        maiorClienteIdentificado,
        consumidorFinal: {
          valor: valorConsumidorFinal,
          qtd: qtdConsumidorFinal,
          clientesDistintos: clientesDistintosConsumidorFinal,
          percentFaturamento: consumidorFinalPercent,
        },
        insight: insightClientes(taxaRecorrencia),
      },
      produtos: {
        topProdutos,
        insight: insightProdutos(topProdutos[0]?.percent ?? 0),
      },
    },
    rankingVendedores,
  };

  return NextResponse.json(response);
}
