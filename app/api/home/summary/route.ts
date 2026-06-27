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
    margemLucro: number;
    ticketMedio: number;
    totalClientes: number;
    clientesNovos: number;
    clientesRecorrentes: number;
    totalVendas: number;
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
      insight: string | null;
    };
    produtos: {
      topFabricante: { nome: string; percent: number; valor: number } | null;
      fabricantesAtivos: number;
      concentracaoTop3: number;
      insight: string | null;
    };
  };
  rankingVendedores: Array<{ nome: string; valor: number; percent: number }>;
}

// ── Interfaces auxiliares para rows SQL ──────────────────────────────────────

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

interface FabricanteRow {
  nome: string;
  valor: number;
}

// ── Helpers — Dias Úteis ─────────────────────────────────────────────────────

function calcDiasUteis(ano: number, mes: number): {
  trabalhados: number;
  restantes: number;
  total: number;
  percentual: number;
} {
  const hoje = new Date();
  const hojeAno = hoje.getFullYear();
  const hojesMes = hoje.getMonth() + 1; // 1-based
  const hojesDia = hoje.getDate();

  let total = 0;
  let trabalhados = 0;

  // Último dia do mês
  const ultimoDia = new Date(ano, mes, 0).getDate();

  for (let dia = 1; dia <= ultimoDia; dia++) {
    const d = new Date(ano, mes - 1, dia);
    const dow = d.getDay(); // 0=Dom, 6=Sab
    if (dow === 0 || dow === 6) continue;

    total++;

    // Considera trabalhado se é o mês/ano atual e o dia já passou (inclusive hoje)
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

function insightProdutos(concentracaoTop3: number): string | null {
  if (concentracaoTop3 > 60) return "⚠ Alta concentração em fabricantes — diversificar reduz risco";
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

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const lojaId = searchParams.get("lojaId");

  if (!lojaId) {
    return NextResponse.json({ error: "lojaId é obrigatório" }, { status: 400 });
  }

  const guard = await requireTenantAccess([lojaId]);
  if (guard instanceof NextResponse) return guard;

  const config = await getLojaDbConfig(lojaId).catch(() => null);
  if (!config) {
    return NextResponse.json({ error: "Loja não encontrada ou Bridge não configurada" }, { status: 404 });
  }

  // ── Período: mês atual ────────────────────────────────────────────────────
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1; // 1-based
  const mesStr = String(mes).padStart(2, "0");
  const startStr = `${ano}-${mesStr}-01`;
  const endStr = agora.toISOString().slice(0, 10); // hoje

  // Período anterior = mesmo mês do ano anterior
  const startAnterior = `${ano - 1}-${mesStr}-01`;
  const endAnterior = `${ano - 1}-${mesStr}-${String(agora.getDate()).padStart(2, "0")}`;

  const periodoLabel = `${agora.toLocaleString("pt-BR", { month: "long" })} ${ano}`;

  const empId = config.empId;

  // ── SQL Queries ───────────────────────────────────────────────────────────

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

  const SQL_KPI_ANTERIOR = `
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
    WITH primeira_compra AS (
      SELECT vedClienteId, MIN(CONVERT(date, vedFechamento)) AS dt
      FROM venda
      WHERE empId = @empId AND vedStatus = 'F' AND vedTipo IN ('OS','VE')
        AND vedClienteId IS NOT NULL AND vedClienteId <> 0
      GROUP BY vedClienteId
    )
    SELECT
      SUM(CASE WHEN pc.dt >= @start THEN 1 ELSE 0 END) AS novos,
      SUM(CASE WHEN pc.dt <  @start THEN 1 ELSE 0 END) AS recorrentes
    FROM venda v
    JOIN primeira_compra pc ON pc.vedClienteId = v.vedClienteId
    WHERE v.empId = @empId AND v.vedStatus = 'F' AND v.vedTipo IN ('OS','VE')
      AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
      AND v.vedClienteId IS NOT NULL AND v.vedClienteId <> 0`;

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
    JOIN venda v ON vp.pgtVedId = v.vedId
    WHERE v.empId = @empId AND v.vedStatus = 'F'
      AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
    GROUP BY pgtTipoDesc
    ORDER BY total DESC`;

  const SQL_TOTAL_PAGTO = `
    SELECT ISNULL(SUM(pgtValor), 0) AS totalGeral
    FROM vendaPgto vp
    JOIN venda v ON vp.pgtVedId = v.vedId
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

  const SQL_FABRICANTES = `
    SELECT TOP 3
      f.fabNome AS nome,
      ISNULL(SUM(vi.vdiValor), 0) AS valor
    FROM vendaItem vi
    JOIN venda v ON v.vedId = vi.vdiVedId
    JOIN produto p ON p.proId = vi.vdiProId
    JOIN fabricante f ON f.fabId = p.proFab
    WHERE vi.vdiCancel = 0 AND v.vedStatus = 'F'
      AND v.empId = @empId
      AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
    GROUP BY f.fabId, f.fabNome
    ORDER BY valor DESC`;

  // ── Execução paralela com fallback individual ─────────────────────────────

  const safe = <T>(promise: Promise<T[]>, fallback: T[]): Promise<T[]> =>
    promise.catch((e) => {
      const msg = e instanceof BridgeError ? e.message : String(e instanceof Error ? e.message : e);
      console.error("[home/summary] query error:", msg);
      return fallback;
    });

  const [
    kpiRows,
    kpiAnteriorRows,
    recorrenciaRows,
    veAbertoRows,
    osAbertoRows,
    metaRows,
    vendedoresRows,
    formaPrincipalRows,
    totalPagtoRows,
    perfilRows,
    fabricantesRows,
  ] = await Promise.all([
    safe(queryBridge<KpiRow>(config, SQL_KPI, { empId, start: startStr, end: endStr }), []),
    safe(queryBridge<KpiRow>(config, SQL_KPI_ANTERIOR, { empId, start: startAnterior, end: endAnterior }), []),
    safe(queryBridge<RecorrenciaRow>(config, SQL_RECORRENCIA, { empId, start: startStr, end: endStr }), []),
    safe(queryBridge<EmAbertoRow>(config, SQL_VE_ABERTO, { empId }), []),
    safe(queryBridge<EmAbertoRow>(config, SQL_OS_ABERTO, { empId }), []),
    safe(queryBridge<MetaRow>(config, SQL_META, { empId }), []),
    safe(queryBridge<VendedorRow>(config, SQL_VENDEDORES, { empId, start: startStr, end: endStr }), []),
    safe(queryBridge<FormaPagtoRow>(config, SQL_FORMA_PRINCIPAL, { empId, start: startStr, end: endStr }), []),
    safe(queryBridge<TotalPagtoRow>(config, SQL_TOTAL_PAGTO, { empId, start: startStr, end: endStr }), []),
    safe(queryBridge<PerfilRow>(config, SQL_PERFIL, { empId, start: startStr, end: endStr }), []),
    safe(queryBridge<FabricanteRow>(config, SQL_FABRICANTES, { empId, start: startStr, end: endStr }), []),
  ]);

  // ── Extração de valores ───────────────────────────────────────────────────

  const kpi = kpiRows[0] ?? { faturamento: 0, totalVendas: 0, custo: 0, totalClientes: 0 };
  const kpiAnt = kpiAnteriorRows[0] ?? { faturamento: 0, totalVendas: 0, custo: 0, totalClientes: 0 };

  const faturamento = Number(kpi.faturamento ?? 0);
  const totalVendas = Number(kpi.totalVendas ?? 0);
  const custo = Number(kpi.custo ?? 0);
  const totalClientes = Number(kpi.totalClientes ?? 0);
  const faturamentoAnterior = Number(kpiAnt.faturamento ?? 0);

  const lucroLiquido = faturamento - custo;
  const margemLucro = faturamento > 0 ? parseFloat(((lucroLiquido / faturamento) * 100).toFixed(2)) : 0;
  const custoReceita = faturamento > 0 ? parseFloat(((custo / faturamento) * 100).toFixed(2)) : 0;
  const ticketMedio = totalVendas > 0 ? parseFloat((faturamento / totalVendas).toFixed(2)) : 0;
  const faturamentoVar = variacaoPercent(faturamento, faturamentoAnterior);

  const recorrencia = recorrenciaRows[0] ?? { novos: 0, recorrentes: 0 };
  const clientesNovos = Number(recorrencia.novos ?? 0);
  const clientesRecorrentes = Number(recorrencia.recorrentes ?? 0);
  const totalRecorrencia = clientesNovos + clientesRecorrentes;
  const taxaRecorrencia = totalRecorrencia > 0
    ? parseFloat(((clientesRecorrentes / totalRecorrencia) * 100).toFixed(2))
    : 0;

  const qtdVendas = Number(veAbertoRows[0]?.qtd ?? 0);
  const qtdOs = Number(osAbertoRows[0]?.qtd ?? 0);
  const valorAbertoVe = Number(veAbertoRows[0]?.valorTotal ?? 0);
  const valorAbertoOs = Number(osAbertoRows[0]?.valorTotal ?? 0);

  const metaValor = Number(metaRows[0]?.metaTotal ?? 0);

  // ── Dias úteis (JavaScript) ───────────────────────────────────────────────

  const diasUteis = calcDiasUteis(ano, mes);
  const diasTrabalhados = diasUteis.trabalhados;

  // ── Projeção ──────────────────────────────────────────────────────────────

  const projecao = diasTrabalhados > 0
    ? parseFloat(((faturamento / diasTrabalhados) * diasUteis.total).toFixed(2))
    : 0;

  const percentAtingido = metaValor > 0
    ? parseFloat(((faturamento / metaValor) * 100).toFixed(2))
    : null;

  const projecaoPercentMeta = metaValor > 0
    ? parseFloat(((projecao / metaValor) * 100).toFixed(2))
    : null;

  // ── Ranking de vendedores ─────────────────────────────────────────────────

  const totalVendedores = vendedoresRows.reduce((acc, v) => acc + Number(v.valor ?? 0), 0);
  const rankingVendedores = vendedoresRows.map((v) => ({
    nome: v.nome,
    valor: Number(v.valor ?? 0),
    percent: totalVendedores > 0
      ? parseFloat(((Number(v.valor ?? 0) / totalVendedores) * 100).toFixed(2))
      : 0,
  }));

  const melhorVendedor = rankingVendedores.length > 0
    ? { nome: rankingVendedores[0].nome, valor: rankingVendedores[0].valor }
    : null;

  // ── Forma de pagamento principal ──────────────────────────────────────────

  const formaPrincipal = formaPrincipalRows[0] ?? null;
  const totalPagto = Number(totalPagtoRows[0]?.totalGeral ?? 0);
  const formaPrincipalPagto = formaPrincipal?.forma ?? null;
  const formaPrincipalPercent = formaPrincipal && totalPagto > 0
    ? parseFloat(((Number(formaPrincipal.total) / totalPagto) * 100).toFixed(2))
    : 0;

  // ── Perfil PJ/PF ─────────────────────────────────────────────────────────

  const perfil = perfilRows[0] ?? { pf: 0, pj: 0 };
  const qtdPf = Number(perfil.pf ?? 0);
  const qtdPj = Number(perfil.pj ?? 0);
  const totalPerfil = qtdPf + qtdPj;
  const perfilDominante: "PJ" | "PF" = qtdPj >= qtdPf ? "PJ" : "PF";
  const perfilPercent = totalPerfil > 0
    ? parseFloat((((perfilDominante === "PJ" ? qtdPj : qtdPf) / totalPerfil) * 100).toFixed(2))
    : 0;

  // ── Fabricantes ───────────────────────────────────────────────────────────

  const totalFaturamentoFab = fabricantesRows.reduce((acc, f) => acc + Number(f.valor ?? 0), 0);
  const concentracaoTop3 = faturamento > 0
    ? parseFloat(((totalFaturamentoFab / faturamento) * 100).toFixed(2))
    : 0;

  const topFabricante = fabricantesRows.length > 0
    ? {
        nome: fabricantesRows[0].nome,
        valor: Number(fabricantesRows[0].valor ?? 0),
        percent: faturamento > 0
          ? parseFloat(((Number(fabricantesRows[0].valor ?? 0) / faturamento) * 100).toFixed(2))
          : 0,
      }
    : null;

  const fabricantesAtivos = fabricantesRows.length;

  // ── Insights ──────────────────────────────────────────────────────────────

  const metaPercentVendas = percentAtingido;

  // ── Montagem da resposta ──────────────────────────────────────────────────

  const response: HomeSummaryResponse = {
    periodo: {
      start: startStr,
      end: endStr,
      label: periodoLabel,
    },
    kpis: {
      faturamento,
      faturamentoVar,
      lucroLiquido,
      margemLucro,
      ticketMedio,
      totalClientes,
      clientesNovos,
      clientesRecorrentes,
      totalVendas,
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
        insight: insightClientes(taxaRecorrencia),
      },
      produtos: {
        topFabricante,
        fabricantesAtivos,
        concentracaoTop3,
        insight: insightProdutos(concentracaoTop3),
      },
    },
    rankingVendedores,
  };

  return NextResponse.json(response);
}
