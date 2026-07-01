import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojasBridge } from "@/lib/db/tenants";
import { queryBridge } from "@/lib/mssql/client";

export const dynamic = "force-dynamic";

function isDate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
function toStr(d: Date)    { return d.toISOString().split("T")[0]; }

/**
 * Endpoint consolidado do Dashboard Clientes.
 * Uma única chamada retorna tudo que a tela precisa, com dimensões granulares
 * (mês × tipo × cidade) para permitir cross-filtering client-side.
 *
 * Fontes de dados no MaxManager (BATAUTO):
 *  - Base de clientes (ativos/inativos/PF-PJ/limite) → `cliente`, escopo de filial
 *    via EXISTS em `cliente_empresa` (cliId × empId). Ativo = cliDesativa=0.
 *  - Cidade/UF da base → cliFatCidade / cliFatUf (cliFatCep disponível p/ mapa futuro).
 *  - Limite de crédito → cliente.cliLimitCred (zero neste banco migrado; acende em produção).
 *  - Cadastro por período → cliente_empresa.cliDatCad (fallback DataInclusao).
 *  - Receita / recorrência / 1ª compra → `venda` (vedStatus='F', vedTotalNf).
 *    "Gera financeiro" via tipoAtend (vedTipoAtend → tatProGeraFinanceiro / tatServGeraFinanceiro);
 *    DV (devoluções) sempre subtraem. Recorrente = > 1 compra finalizada (all-time).
 *
 * Observações de dado (documentadas):
 *  - `cliente` não tem coluna de filial; a segmentação por filial vem de cliente_empresa.
 *    Neste banco migrado cliente_empresa é um cross-join (todo cliente em toda filial),
 *    então localmente as filiais mostram números idênticos — o padrão é correto e
 *    segmenta em produção.
 *  - Só ~1,9% da base tem histórico de compra neste banco → widgets derivados de compra
 *    ficam esparsos aqui e densos em produção.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lojaIds = (searchParams.get("lojaIds") ?? "").split(",").filter(Boolean);
  if (lojaIds.length === 0) return NextResponse.json({ error: "lojaIds obrigatório" }, { status: 400 });

  const auth = await requireTenantAccess(lojaIds);
  if (auth instanceof NextResponse) return auth;

  const start = searchParams.get("start") ?? "";
  const end   = searchParams.get("end")   ?? "";
  if (!isDate(start) || !isDate(end)) {
    return NextResponse.json({ error: "start e end obrigatórios (YYYY-MM-DD)" }, { status: 400 });
  }

  const cfg = await getLojasBridge(lojaIds);
  if (!cfg) return NextResponse.json({ error: "Bridge não configurada" }, { status: 404 });

  const { bridgeUrl, token, empresas } = cfg;

  // Lista de empIds sanitizada (inteiros de fonte própria — seguro inlinar no SQL)
  const empIds = empresas.map((e) => e.empId).filter(Number.isFinite);
  if (empIds.length === 0) return NextResponse.json({ error: "Sem filiais válidas" }, { status: 404 });
  const empList = empIds.join(",");

  // Período anterior (mesma duração) para variação dos KPIs
  const startMs   = new Date(start + "T12:00:00").getTime();
  const endMs     = new Date(end   + "T12:00:00").getTime();
  const prevEnd   = toStr(new Date(startMs - 86400000));
  const prevStart = toStr(new Date(startMs - 86400000 - (endMs - startMs)));

  // Janela de 12 meses terminando em `end` para as séries mensais
  const endDate      = new Date(end + "T12:00:00");
  const base12mDate  = new Date(endDate);
  base12mDate.setMonth(base12mDate.getMonth() - 11);
  base12mDate.setDate(1);
  const base12m = toStr(base12mDate);

  // Expressão reutilizada: cidade normalizada ('' quando nula/vazia → "Sem cidade" no cliente)
  const CIDADE = "ISNULL(NULLIF(LTRIM(RTRIM(c.cliFatCidade)),''),'')";
  const UF     = "ISNULL(c.cliFatUf,'')";
  const EXISTS_FILIAL = `EXISTS (SELECT 1 FROM cliente_empresa ce WHERE ce.cliId = c.cliId AND ce.empId IN (${empList}))`;
  // Vendas que geram financeiro: DV sempre conta; demais dependem do tipoAtend
  const GERA_FIN = "(v.vedTipo = 'DV' OR ta.tatProGeraFinanceiro = 1 OR ta.tatServGeraFinanceiro = 1)";

  const q = <T>(sql: string, params?: Record<string, unknown>) =>
    queryBridge<T>({ bridgeUrl, token }, sql, params);

  const [
    baseRes,          // 1. base de clientes: cidade × uf × tipo(PF/PJ) × status + limite
    inativos90Res,    // 2. churn: clientes que compraram mas não nos últimos 90 dias
    cadastrosSerieRes,// 3. novos cadastros por mês × cidade (12m)
    cadastrosKpiRes,  // 4. novos cadastros no período atual/anterior
    primeiraSerieRes, // 5. 1ª compra por mês × cidade (12m)
    primeiraKpiRes,   // 6. 1ª compra no período atual/anterior
    receitaRes,       // 7. receita líquida por mês × tipo(recorrente) × cidade (12m)
    compradoresRes,   // 8. compradores únicos por mês × tipo × cidade (12m)
    recorrenciaKpiRes,// 9. taxa de recorrência período atual/anterior
    limitesRes,       // 10. top clientes por limite de crédito
  ] = await Promise.allSettled([

    // 1. Base de clientes (escopo de filial via cliente_empresa). Uma linha por
    //    cidade × uf × cliTipo × cliDesativa, com contagem e soma de limite.
    q<{ cidade: string; uf: string; cliTipo: number; cliDesativa: number; qtde: number; limiteSoma: number; comLimite: number }>(`
      SELECT ${CIDADE} AS cidade, ${UF} AS uf, c.cliTipo, c.cliDesativa,
        COUNT(*) AS qtde,
        ISNULL(SUM(c.cliLimitCred),0) AS limiteSoma,
        COUNT(CASE WHEN c.cliLimitCred > 0 THEN 1 END) AS comLimite
      FROM cliente c
      WHERE ${EXISTS_FILIAL}
      GROUP BY ${CIDADE}, ${UF}, c.cliTipo, c.cliDesativa
    `),

    // 2. Clientes ativos com histórico de compra cuja última compra passou de 90 dias
    q<{ semCompra90: number }>(`
      SELECT COUNT(DISTINCT u.vedClienteId) AS semCompra90
      FROM (
        SELECT v.vedClienteId, MAX(CONVERT(date, v.vedFechamento)) AS ult
        FROM venda v
        WHERE v.empId IN (${empList}) AND v.vedStatus='F' AND v.vedTipo IN ('OS','VE')
          AND v.vedFechamento IS NOT NULL
        GROUP BY v.vedClienteId
      ) u
      WHERE u.ult < DATEADD(day, -90, CONVERT(date, GETDATE()))
    `),

    // 3. Novos cadastros por mês × cidade (12m) — cliDatCad com fallback DataInclusao
    q<{ mes: string; cidade: string; qtde: number }>(`
      SELECT FORMAT(x.dt,'yyyy-MM') AS mes, ${CIDADE} AS cidade, COUNT(DISTINCT x.cliId) AS qtde
      FROM (
        SELECT ce.cliId, CONVERT(date, COALESCE(ce.cliDatCad, ce.DataInclusao)) AS dt
        FROM cliente_empresa ce
        WHERE ce.empId IN (${empList}) AND COALESCE(ce.cliDatCad, ce.DataInclusao) IS NOT NULL
      ) x
      JOIN cliente c ON c.cliId = x.cliId
      WHERE x.dt >= @base12m
      GROUP BY FORMAT(x.dt,'yyyy-MM'), ${CIDADE}
    `, { base12m }),

    // 4. Novos cadastros — período atual e anterior
    q<{ atual: number; anterior: number }>(`
      SELECT
        COUNT(DISTINCT CASE WHEN x.dt BETWEEN @start AND @end THEN x.cliId END) AS atual,
        COUNT(DISTINCT CASE WHEN x.dt BETWEEN @prevStart AND @prevEnd THEN x.cliId END) AS anterior
      FROM (
        SELECT ce.cliId, CONVERT(date, COALESCE(ce.cliDatCad, ce.DataInclusao)) AS dt
        FROM cliente_empresa ce
        WHERE ce.empId IN (${empList})
      ) x
    `, { start, end, prevStart, prevEnd }),

    // 5. Primeira compra por mês × cidade (12m)
    q<{ mes: string; cidade: string; qtde: number }>(`
      WITH pc AS (
        SELECT v.vedClienteId, MIN(CONVERT(date, v.vedFechamento)) AS primeira
        FROM venda v
        WHERE v.vedStatus='F' AND v.vedTipo IN ('OS','VE') AND v.vedFechamento IS NOT NULL
        GROUP BY v.vedClienteId
      )
      SELECT FORMAT(pc.primeira,'yyyy-MM') AS mes, ${CIDADE} AS cidade, COUNT(DISTINCT pc.vedClienteId) AS qtde
      FROM pc
      JOIN venda v ON v.vedClienteId = pc.vedClienteId AND CONVERT(date, v.vedFechamento) = pc.primeira
        AND v.vedStatus='F' AND v.empId IN (${empList})
      LEFT JOIN cliente c ON c.cliId = pc.vedClienteId
      WHERE pc.primeira >= @base12m
      GROUP BY FORMAT(pc.primeira,'yyyy-MM'), ${CIDADE}
    `, { base12m }),

    // 6. Primeira compra — período atual e anterior
    q<{ atual: number; anterior: number }>(`
      WITH pc AS (
        SELECT v.vedClienteId, MIN(CONVERT(date, v.vedFechamento)) AS primeira, MIN(v.empId) AS empId
        FROM venda v
        WHERE v.vedStatus='F' AND v.vedTipo IN ('OS','VE') AND v.vedFechamento IS NOT NULL
        GROUP BY v.vedClienteId
      )
      SELECT
        COUNT(DISTINCT CASE WHEN pc.primeira BETWEEN @start AND @end THEN pc.vedClienteId END) AS atual,
        COUNT(DISTINCT CASE WHEN pc.primeira BETWEEN @prevStart AND @prevEnd THEN pc.vedClienteId END) AS anterior
      FROM pc
      WHERE pc.empId IN (${empList})
    `, { start, end, prevStart, prevEnd }),

    // 7. Receita líquida por mês × tipo(recorrente) × cidade (12m)
    q<{ mes: string; tipo: string; cidade: string; receita: number }>(`
      WITH compras AS (
        SELECT v.vedClienteId, COUNT(*) AS n
        FROM venda v
        WHERE v.vedStatus='F' AND v.vedTipo IN ('OS','VE') AND v.vedFechamento IS NOT NULL
        GROUP BY v.vedClienteId
      )
      SELECT FORMAT(v.vedFechamento,'yyyy-MM') AS mes,
        CASE WHEN cp.n > 1 THEN 'R' ELSE 'N' END AS tipo,
        ${CIDADE} AS cidade,
        ISNULL(SUM(CASE WHEN v.vedTipo='DV' THEN -v.vedTotalNf ELSE v.vedTotalNf END),0) AS receita
      FROM venda v
      LEFT JOIN tipoAtend ta ON ta.tatId = v.vedTipoAtend
      LEFT JOIN compras cp ON cp.vedClienteId = v.vedClienteId
      LEFT JOIN cliente c ON c.cliId = v.vedClienteId
      WHERE v.empId IN (${empList}) AND v.vedStatus='F' AND v.vedTipo IN ('OS','VE','DV')
        AND v.vedFechamento IS NOT NULL AND CONVERT(date, v.vedFechamento) >= @base12m
        AND ${GERA_FIN}
      GROUP BY FORMAT(v.vedFechamento,'yyyy-MM'), CASE WHEN cp.n > 1 THEN 'R' ELSE 'N' END, ${CIDADE}
    `, { base12m }),

    // 8. Compradores únicos por mês × tipo × cidade (12m)
    q<{ mes: string; tipo: string; cidade: string; qtde: number }>(`
      WITH compras AS (
        SELECT v.vedClienteId, COUNT(*) AS n
        FROM venda v
        WHERE v.vedStatus='F' AND v.vedTipo IN ('OS','VE') AND v.vedFechamento IS NOT NULL
        GROUP BY v.vedClienteId
      )
      SELECT FORMAT(v.vedFechamento,'yyyy-MM') AS mes,
        CASE WHEN cp.n > 1 THEN 'R' ELSE 'N' END AS tipo,
        ${CIDADE} AS cidade,
        COUNT(DISTINCT v.vedClienteId) AS qtde
      FROM venda v
      LEFT JOIN compras cp ON cp.vedClienteId = v.vedClienteId
      LEFT JOIN cliente c ON c.cliId = v.vedClienteId
      WHERE v.empId IN (${empList}) AND v.vedStatus='F' AND v.vedTipo IN ('OS','VE')
        AND v.vedFechamento IS NOT NULL AND CONVERT(date, v.vedFechamento) >= @base12m
      GROUP BY FORMAT(v.vedFechamento,'yyyy-MM'), CASE WHEN cp.n > 1 THEN 'R' ELSE 'N' END, ${CIDADE}
    `, { base12m }),

    // 9. Taxa de recorrência — período atual e anterior
    q<{ totalComp: number; recorrentes: number; totalPrev: number; recorrentesPrev: number }>(`
      WITH compras AS (
        SELECT v.vedClienteId, COUNT(*) AS n
        FROM venda v
        WHERE v.vedStatus='F' AND v.vedTipo IN ('OS','VE') AND v.vedFechamento IS NOT NULL
        GROUP BY v.vedClienteId
      )
      SELECT
        COUNT(DISTINCT CASE WHEN CONVERT(date,v.vedFechamento) BETWEEN @start AND @end THEN v.vedClienteId END) AS totalComp,
        COUNT(DISTINCT CASE WHEN CONVERT(date,v.vedFechamento) BETWEEN @start AND @end AND cp.n > 1 THEN v.vedClienteId END) AS recorrentes,
        COUNT(DISTINCT CASE WHEN CONVERT(date,v.vedFechamento) BETWEEN @prevStart AND @prevEnd THEN v.vedClienteId END) AS totalPrev,
        COUNT(DISTINCT CASE WHEN CONVERT(date,v.vedFechamento) BETWEEN @prevStart AND @prevEnd AND cp.n > 1 THEN v.vedClienteId END) AS recorrentesPrev
      FROM venda v
      LEFT JOIN compras cp ON cp.vedClienteId = v.vedClienteId
      WHERE v.empId IN (${empList}) AND v.vedStatus='F' AND v.vedTipo IN ('OS','VE')
        AND v.vedFechamento IS NOT NULL
        AND CONVERT(date,v.vedFechamento) BETWEEN @prevStart AND @end
    `, { start, end, prevStart, prevEnd }),

    // 10. Top clientes por limite de crédito (base ativa, escopo de filial)
    q<{ cliId: number; cliNome: string | null; valor: number; cidade: string; uf: string }>(`
      SELECT TOP 50 c.cliId, c.cliNome, c.cliLimitCred AS valor, ${CIDADE} AS cidade, ${UF} AS uf
      FROM cliente c
      WHERE c.cliDesativa = 0 AND c.cliLimitCred > 0 AND ${EXISTS_FILIAL}
      ORDER BY c.cliLimitCred DESC
    `),
  ]);

  const val = <T>(r: PromiseSettledResult<T[]>): T[] => (r.status === "fulfilled" ? r.value : []);
  const one = <T>(r: PromiseSettledResult<T[]>): T | null => (r.status === "fulfilled" ? (r.value[0] ?? null) : null);

  const base = val(baseRes).map((r) => ({
    cidade: r.cidade || "",
    uf: r.uf || "",
    cliTipo: Number(r.cliTipo),               // 0 = PF, 1 = PJ
    ativo: Number(r.cliDesativa) === 0,       // cliDesativa 0 = ativo, -1 = inativo
    qtde: Number(r.qtde),
    limite: Number(r.limiteSoma),
    comLimite: Number(r.comLimite),
  }));

  const semCompra90 = Number(one(inativos90Res)?.semCompra90 ?? 0);

  const cadastros = val(cadastrosSerieRes).map((r) => ({ mes: r.mes, cidade: r.cidade || "", qtde: Number(r.qtde) }));
  const cadastrosKpi = { atual: Number(one(cadastrosKpiRes)?.atual ?? 0), anterior: Number(one(cadastrosKpiRes)?.anterior ?? 0) };

  const primeira = val(primeiraSerieRes).map((r) => ({ mes: r.mes, cidade: r.cidade || "", qtde: Number(r.qtde) }));
  const primeiraKpi = { atual: Number(one(primeiraKpiRes)?.atual ?? 0), anterior: Number(one(primeiraKpiRes)?.anterior ?? 0) };

  const receita = val(receitaRes).map((r) => ({ mes: r.mes, tipo: r.tipo as "R" | "N", cidade: r.cidade || "", receita: Number(r.receita) }));
  const compradores = val(compradoresRes).map((r) => ({ mes: r.mes, tipo: r.tipo as "R" | "N", cidade: r.cidade || "", qtde: Number(r.qtde) }));

  const rk = one(recorrenciaKpiRes);
  const recorrenciaKpi = {
    totalComp: Number(rk?.totalComp ?? 0),
    recorrentes: Number(rk?.recorrentes ?? 0),
    totalPrev: Number(rk?.totalPrev ?? 0),
    recorrentesPrev: Number(rk?.recorrentesPrev ?? 0),
  };

  const limites = val(limitesRes).map((r) => ({
    cliId: Number(r.cliId),
    nome: r.cliNome ?? `Cliente ${r.cliId}`,
    valor: Number(r.valor),
    cidade: r.cidade || "",
    uf: r.uf || "",
  }));

  // Lista completa de meses (12m) — preenche lacunas no cliente
  const meses: string[] = [];
  const cursor = new Date(base12mDate);
  while (cursor <= endDate) {
    meses.push(cursor.toISOString().slice(0, 7));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return NextResponse.json({
    filiais: empresas,
    meses,
    periodo: { start, end, prevStart, prevEnd },
    base,
    semCompra90,
    cadastros,
    cadastrosKpi,
    primeira,
    primeiraKpi,
    receita,
    compradores,
    recorrenciaKpi,
    limites,
  });
}
