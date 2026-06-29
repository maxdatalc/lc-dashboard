import { NextRequest, NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
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
      taxaRecorrencia: number;
      perfilDominante: "PJ" | "PF";
      perfilPercent: number;
      maiorCliente: { nome: string; valor: number } | null;
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
  custo: number;
  totalClientes: number;
}

interface RecorrenciaRow {
  novos: number;
  recorrentes: number;
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
  nome: string;
  valor: number;
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

const SQL_KPI = `
  SELECT
    ISNULL(SUM(v.vedTotalNf), 0)                             AS faturamento,
    COUNT(v.vedId)                                            AS totalVendas,
    ISNULL(SUM(vi.vdiQtde * vi.vdiProCustoFinal), 0)        AS custo,
    COUNT(DISTINCT NULLIF(v.vedClienteId, 0))                AS totalClientes
  FROM venda v
  LEFT JOIN vendaItem vi ON vi.vdiVedId = v.vedId AND vi.vdiCancel = 0
  WHERE v.empId = @empId
    AND v.vedStatus = 'F'
    AND v.vedTipo IN ('OS', 'VE')
    AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end`;

const SQL_RECORRENCIA = `
  WITH curPeriodo AS (
    SELECT DISTINCT vedClienteId
    FROM venda
    WHERE empId = @empId AND vedStatus = 'F' AND vedTipo IN ('OS','VE')
      AND CONVERT(date, vedFechamento) BETWEEN @start AND @end
      AND vedClienteId IS NOT NULL AND vedClienteId <> 0
  ),
  histPeriodo AS (
    SELECT DISTINCT vedClienteId
    FROM venda
    WHERE empId = @empId AND vedStatus = 'F' AND vedTipo IN ('OS','VE')
      AND CONVERT(date, vedFechamento) < @start
      AND CONVERT(date, vedFechamento) >= DATEADD(year, -10, @start)
      AND vedClienteId IS NOT NULL AND vedClienteId <> 0
  )
  SELECT
    COUNT(DISTINCT CASE WHEN h.vedClienteId IS NULL     THEN c.vedClienteId END) AS novos,
    COUNT(DISTINCT CASE WHEN h.vedClienteId IS NOT NULL THEN c.vedClienteId END) AS recorrentes
  FROM curPeriodo c
  LEFT JOIN histPeriodo h ON h.vedClienteId = c.vedClienteId`;

const SQL_VE_ABERTO = `
  SELECT COUNT(DISTINCT v.vedId) AS qtd,
         ISNULL(SUM(vi.vdiValor), 0) AS valorTotal
  FROM venda v
  LEFT JOIN vendaItem vi ON vi.vdiVedId = v.vedId AND vi.vdiCancel = 0
  WHERE v.vedStatus = 'O'
    AND v.vedTipo = 'VE'
    AND v.empId = @empId`;

const SQL_OS_ABERTO = `
  SELECT COUNT(DISTINCT v.vedId) AS qtd,
         ISNULL(SUM(vi.vdiValor), 0) AS valorTotal
  FROM venda v
  INNER JOIN tipoAtend ta ON ta.tatId = CAST(v.vedTipoAtend AS INT)
  LEFT JOIN vendaItem vi ON vi.vdiVedId = v.vedId AND vi.vdiCancel = 0
  WHERE v.vedStatus = 'O'
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

const SQL_VENDEDORES = `
  SELECT TOP 5
    c.cliNome AS nome,
    ISNULL(SUM(v.vedTotalNf), 0) AS valor
  FROM venda v
  JOIN cliente c ON v.vedAtendente = c.cliId
  WHERE v.vedStatus = 'F' AND v.vedTipo IN ('OS','VE')
    AND v.vedTotalNf > 0 AND v.empId = @empId
    AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
  GROUP BY c.cliId, c.cliNome
  ORDER BY valor DESC`;

const SQL_FORMA_PRINCIPAL = `
  SELECT TOP 1
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

const SQL_TOP_PRODUTOS = `
  SELECT TOP 3
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

const SQL_MAIOR_CLIENTE = `
  SELECT TOP 1
    c.cliNome AS nome,
    ISNULL(SUM(v.vedTotalNf), 0) AS valor
  FROM venda v
  JOIN cliente c ON v.vedClienteId = c.cliId
  WHERE v.empId = @empId AND v.vedStatus = 'F' AND v.vedTipo IN ('OS','VE')
    AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
    AND v.vedClienteId IS NOT NULL AND v.vedClienteId <> 0
  GROUP BY v.vedClienteId, c.cliNome
  ORDER BY valor DESC`;

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

  const guard = await requireTenantAccess(lojaIds);
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
  let faturamento    = 0, totalVendas   = 0, custo    = 0, totalClientes  = 0;
  let faturamentoAnt = 0, totalVendasAnt = 0, custoAnt = 0;
  let clientesNovos  = 0, clientesRecorrentes = 0;
  let qtdVendas = 0, qtdOs = 0, valorAbertoVe = 0, valorAbertoOs = 0;
  let metaValor = 0;
  let qtdPf = 0, qtdPj = 0;
  let totalPagto = 0;

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
      recorrenciaRows,
      veAbertoRows, osAbertoRows,
      metaRows,
      vendedoresRows,
      formaPrincipalRows, totalPagtoRows,
      perfilRows,
      topProdutosRows,
      maiorClienteRows,
    ] = await Promise.all([
      safe(queryBridge<KpiRow>(config, SQL_KPI, { ...ep, ...sp }), []),
      safe(queryBridge<KpiRow>(config, SQL_KPI, { ...ep, ...spa }), []),
      safe(queryBridge<RecorrenciaRow>(config, SQL_RECORRENCIA, { ...ep, ...sp }), []),
      safe(queryBridge<EmAbertoRow>(config, SQL_VE_ABERTO, ep), []),
      safe(queryBridge<EmAbertoRow>(config, SQL_OS_ABERTO, ep), []),
      safe(queryBridge<MetaRow>(config, SQL_META, ep), []),
      safe(queryBridge<VendedorRow>(config, SQL_VENDEDORES, { ...ep, ...sp }), []),
      safe(queryBridge<FormaPagtoRow>(config, SQL_FORMA_PRINCIPAL, { ...ep, ...sp }), []),
      safe(queryBridge<TotalPagtoRow>(config, SQL_TOTAL_PAGTO, { ...ep, ...sp }), []),
      safe(queryBridge<PerfilRow>(config, SQL_PERFIL, { ...ep, ...sp }), []),
      safe(queryBridge<ProdutoRow>(config, SQL_TOP_PRODUTOS, { ...ep, ...sp }), []),
      safe(queryBridge<MaiorClienteRow>(config, SQL_MAIOR_CLIENTE, { ...ep, ...sp }), []),
    ]);

    const kpi    = kpiRows[0]    ?? { faturamento: 0, totalVendas: 0, custo: 0, totalClientes: 0 };
    const kpiAnt = kpiAntRows[0] ?? { faturamento: 0, totalVendas: 0, custo: 0, totalClientes: 0 };

    faturamento     += Number(kpi.faturamento    ?? 0);
    totalVendas     += Number(kpi.totalVendas    ?? 0);
    custo           += Number(kpi.custo          ?? 0);
    totalClientes   += Number(kpi.totalClientes  ?? 0);
    faturamentoAnt  += Number(kpiAnt.faturamento ?? 0);
    totalVendasAnt  += Number(kpiAnt.totalVendas ?? 0);
    custoAnt        += Number(kpiAnt.custo       ?? 0);

    const recorrencia = recorrenciaRows[0] ?? { novos: 0, recorrentes: 0 };
    clientesNovos       += Number(recorrencia.novos       ?? 0);
    clientesRecorrentes += Number(recorrencia.recorrentes ?? 0);

    qtdVendas      += Number(veAbertoRows[0]?.qtd        ?? 0);
    qtdOs          += Number(osAbertoRows[0]?.qtd        ?? 0);
    valorAbertoVe  += Number(veAbertoRows[0]?.valorTotal ?? 0);
    valorAbertoOs  += Number(osAbertoRows[0]?.valorTotal ?? 0);

    metaValor += Number(metaRows[0]?.metaTotal ?? 0);

    const perfil = perfilRows[0] ?? { pf: 0, pj: 0 };
    qtdPf += Number(perfil.pf ?? 0);
    qtdPj += Number(perfil.pj ?? 0);

    totalPagto += Number(totalPagtoRows[0]?.totalGeral ?? 0);

    for (const v of vendedoresRows) allVendedores.push({ nome: v.nome, valor: Number(v.valor ?? 0) });
    for (const p of topProdutosRows) allProdutos.push({ nome: p.nome, valor: Number(p.valor ?? 0), qtde: Number(p.qtde ?? 0) });
    if (maiorClienteRows[0]) allClientes.push({ nome: maiorClienteRows[0].nome, valor: Number(maiorClienteRows[0].valor ?? 0) });
    if (formaPrincipalRows[0]) allFormas.push({ forma: formaPrincipalRows[0].forma, total: Number(formaPrincipalRows[0].total ?? 0) });
  }

  if (!bridgeFound) {
    return NextResponse.json(
      { error: "Bridge SQL não configurada para esta loja. Acesse Admin → Empresas → Lojas → Bridge." },
      { status: 503 }
    );
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

  // Maior cliente
  const maiorCliente = allClientes.sort((a, b) => b.valor - a.valor)[0] ?? null;

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
        taxaRecorrencia,
        perfilDominante,
        perfilPercent,
        maiorCliente,
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
