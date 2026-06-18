import { NextRequest, NextResponse } from "next/server";
import { getDateRange } from "@/lib/utils/format";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojaDbConfig } from "@/lib/db/tenants";
import { queryBridge, BridgeError } from "@/lib/mssql/client";

export const dynamic = "force-dynamic";

const NOMES_MES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

async function getConfig(lojaIds: string[]) {
  for (const id of lojaIds) {
    try {
      const cfg = await getLojaDbConfig(id);
      if (cfg) return cfg;
    } catch {}
  }
  return null;
}

// shorthand para usar em todos os queryBridge desta rota
function ep(config: NonNullable<Awaited<ReturnType<typeof getConfig>>>) {
  return { empId: config.empId };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const lojaIdsParam = searchParams.get("lojaIds");
  const lojaId = searchParams.get("lojaId");
  const period = searchParams.get("period") ?? "month";
  const type = searchParams.get("type");
  const vendedorIdRaw = searchParams.get("vendedorId");
  const vendedorId = vendedorIdRaw ? parseInt(vendedorIdRaw) : null;
  const vClause  = vendedorId ? "AND vedAtendente = @vendedorId" : "";
  const vClauseJ = vendedorId ? "AND v.vedAtendente = @vendedorId" : "";
  const vp = vendedorId ? { vendedorId } : {};

  const clienteNomeRaw = searchParams.get("clienteNome");
  const produtoNomeRaw = searchParams.get("produtoNome");
  const cClause  = clienteNomeRaw ? "AND vedClienteId IN (SELECT cliId FROM cliente WHERE cliNome = @clienteNome AND empId = @empId)" : "";
  const cClauseJ = clienteNomeRaw ? "AND v.vedClienteId IN (SELECT cliId FROM cliente WHERE cliNome = @clienteNome AND empId = @empId)" : "";
  const pClause  = produtoNomeRaw ? "AND vedId IN (SELECT vdiVedId FROM vendaItem WHERE vdiProNome = @produtoNome AND vdiCancel = 0)" : "";
  const pClauseJ = produtoNomeRaw ? "AND v.vedId IN (SELECT vdiVedId FROM vendaItem WHERE vdiProNome = @produtoNome AND vdiCancel = 0)" : "";
  const cp = {
    ...(clienteNomeRaw ? { clienteNome: clienteNomeRaw } : {}),
    ...(produtoNomeRaw ? { produtoNome: produtoNomeRaw } : {}),
  };

  const lojaIds = lojaIdsParam
    ? lojaIdsParam.split(",").filter(Boolean)
    : lojaId
    ? [lojaId]
    : [];

  if (lojaIds.length === 0 || !type) {
    return NextResponse.json({ error: "lojaId/lojaIds e type são obrigatórios" }, { status: 400 });
  }

  const guard = await requireTenantAccess(lojaIds);
  if (guard instanceof NextResponse) return guard;

  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const { start, end } =
    startParam && endParam
      ? { start: startParam, end: endParam }
      : getDateRange(period);

  const config = await getConfig(lojaIds);
  if (!config) {
    return NextResponse.json(
      { error: "Bridge SQL não configurada para esta loja." },
      { status: 503 }
    );
  }

  try {
    switch (type) {
      case "faturamento-mensal": {
        const endDate = new Date(end + "T12:00:00");
        const startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 11);
        startDate.setDate(1);
        const inicio12m = startDate.toISOString().split("T")[0];

        const [rowsVendas, rowsDev] = await Promise.all([
          queryBridge<{ mes: string; total: number }>(
            config,
            `SELECT
              FORMAT(vedFechamento, 'yyyy-MM')   AS mes,
              ISNULL(SUM(vedTotalNf), 0)         AS total
            FROM venda
            WHERE vedStatus = 'F'
              AND vedTipo IN ('OS','VE')
              AND vedTotalNf > 0
              AND empId = @empId
              AND vedFechamento >= DATEADD(month, -11, DATEFROMPARTS(YEAR(@start), MONTH(@start), 1))
              AND CONVERT(date, vedFechamento) <= @end
              ${vClause}${cClause}${pClause}
            GROUP BY FORMAT(vedFechamento, 'yyyy-MM')
            ORDER BY mes`,
            { start: inicio12m, end, ...ep(config), ...vp, ...cp }
          ),
          queryBridge<{ mes: string; total: number }>(
            config,
            `SELECT
              FORMAT(vedFechamento, 'yyyy-MM')   AS mes,
              ISNULL(SUM(vedTotalNf), 0)         AS total
            FROM venda
            WHERE vedStatus = 'F'
              AND vedTipo = 'DV'
              AND vedTotalNf > 0
              AND empId = @empId
              AND vedFechamento >= DATEADD(month, -11, DATEFROMPARTS(YEAR(@start), MONTH(@start), 1))
              AND CONVERT(date, vedFechamento) <= @end
            GROUP BY FORMAT(vedFechamento, 'yyyy-MM')
            ORDER BY mes`,
            { start: inicio12m, end, ...ep(config) }
          ),
        ]);

        const vendasMap = new Map<string, number>();
        const devMap    = new Map<string, number>();
        const cursor = new Date(startDate);
        while (cursor <= endDate) {
          const key = cursor.toISOString().slice(0, 7);
          vendasMap.set(key, 0);
          devMap.set(key, 0);
          cursor.setMonth(cursor.getMonth() + 1);
        }
        for (const r of rowsVendas) vendasMap.set(r.mes, Number(r.total));
        for (const r of rowsDev)    devMap.set(r.mes,    Number(r.total));

        const resultado = Array.from(vendasMap.keys())
          .sort()
          .map((mesKey) => {
            const [ano, mes] = mesKey.split("-");
            const vendas     = vendasMap.get(mesKey) ?? 0;
            const devolucoes = devMap.get(mesKey)    ?? 0;
            return {
              mes: `${NOMES_MES[parseInt(mes) - 1]}/${ano.slice(2)}`,
              mesCompleto: `${NOMES_MES[parseInt(mes) - 1]}/${ano}`,
              vendas,
              devolucoes,
              vendaLiquidaDevolucao: vendas - devolucoes,
            };
          });

        return NextResponse.json(resultado);
      }

      case "top-produtos": {
        const rows = await queryBridge<{
          nome: string; valor: number; quantidade: number;
          codigo: string | null; fabricante: string | null; grupo: string | null;
          custoMedio: number; margem: number; proTipo: string | null;
        }>(
          config,
          `SELECT TOP 50
            vi.vdiProNome                                                           AS nome,
            MIN(p.zzz_proCodigo)                                                   AS codigo,
            MIN(f.fabNome)                                                         AS fabricante,
            MIN(gp.gdpNome)                                                        AS grupo,
            MIN(p.proTipo)                                                         AS proTipo,
            ISNULL(SUM(vi.vdiQtde * vi.vdiValor), 0)                             AS valor,
            ISNULL(SUM(vi.vdiQtde), 0)                                            AS quantidade,
            ISNULL(AVG(vi.vdiProCustoFinal), 0)                                   AS custoMedio,
            CASE WHEN SUM(vi.vdiQtde * vi.vdiValor) > 0
              THEN (SUM(vi.vdiQtde * vi.vdiValor) - SUM(vi.vdiQtde * vi.vdiProCustoFinal))
                   / SUM(vi.vdiQtde * vi.vdiValor) * 100
              ELSE 0 END                                                            AS margem
          FROM vendaItem vi
          JOIN venda v ON vi.vdiVedId = v.vedId
          LEFT JOIN produto p ON vi.vdiItemId = p.proId
          LEFT JOIN fabricante f ON p.proFab = f.fabId
          LEFT JOIN grupoProd gp ON p.proGrupo = gp.gdpId
          WHERE v.vedStatus = 'F'
            AND v.vedTipo IN ('OS','VE')
            AND v.vedTotalNf > 0
            AND v.empId = @empId
            AND vi.vdiCancel = 0
            AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
            ${vClauseJ}${cClauseJ}${pClauseJ}
          GROUP BY vi.vdiProNome
          ORDER BY valor DESC`,
          { start, end, ...ep(config), ...vp, ...cp }
        );

        return NextResponse.json(
          rows.map((r) => ({
            nome: r.nome,
            valor: Number(r.valor),
            quantidade: Number(r.quantidade),
            externalId: null,
            codigo: r.codigo || null,
            grupoNome: r.grupo || null,
            subGrupo: null,
            fabricante: r.fabricante || null,
            precoVenda: null,
            valorCusto: Number(r.custoMedio) || null,
            margem: Number(r.margem),
            estoqueAtual: null,
            proTipo: (r.proTipo as "P" | "S" | null) || null,
          }))
        );
      }

      case "top-fabricantes": {
        const rows = await queryBridge<{ nome: string; valor: number; quantidade: number }>(
          config,
          `SELECT TOP 20
            f.fabNome                                  AS nome,
            ISNULL(SUM(vi.vdiQtde * vi.vdiValor), 0) AS valor,
            ISNULL(SUM(vi.vdiQtde), 0)               AS quantidade
          FROM vendaItem vi
          JOIN venda v ON vi.vdiVedId = v.vedId
          JOIN produto p ON vi.vdiItemId = p.proId
          JOIN fabricante f ON p.proFab = f.fabId
          WHERE v.vedStatus = 'F'
            AND v.vedTipo IN ('OS','VE')
            AND v.vedTotalNf > 0
            AND v.empId = @empId
            AND vi.vdiCancel = 0
            AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
            ${vClauseJ}${cClauseJ}${pClauseJ}
          GROUP BY f.fabNome
          ORDER BY valor DESC`,
          { start, end, ...ep(config), ...vp, ...cp }
        );

        return NextResponse.json(
          rows.map((r) => ({
            nome: r.nome,
            valor: Number(r.valor),
            quantidade: Number(r.quantidade),
          }))
        );
      }

      case "top-clientes": {
        const rows = await queryBridge<{
          nome: string; total: number; compras: number;
          ultimaCompra: string; tipoCad: number;
          cidade: string | null; estado: string | null;
          email: string | null; fone: string | null; cpfCgc: string | null;
          mesesAtivos: number; devolucoes: number; margemCliente: number | null;
        }>(
          config,
          `SELECT TOP 50
            c.cliNome                                AS nome,
            ISNULL(SUM(v.vedTotalNf), 0)            AS total,
            COUNT(*)                                 AS compras,
            MAX(v.vedFechamento)                     AS ultimaCompra,
            c.cliTipoCad                             AS tipoCad,
            MIN(c.cliFatCidade)                      AS cidade,
            MIN(c.cliFatUf)                          AS estado,
            MIN(c.cliEmail)                          AS email,
            MIN(c.cliFone)                           AS fone,
            MIN(c.cliCpfCgc)                         AS cpfCgc,
            COUNT(DISTINCT YEAR(v.vedFechamento) * 100 + MONTH(v.vedFechamento)) AS mesesAtivos,
            ISNULL((
              SELECT COUNT(*) FROM venda vd
              WHERE vd.vedClienteId = c.cliId
                AND vd.vedStatus = 'F' AND vd.vedTipo = 'DV' AND vd.empId = @empId
                AND CONVERT(date, vd.vedFechamento) BETWEEN @start AND @end
            ), 0) AS devolucoes,
            (
              SELECT CASE WHEN SUM(vi2.vdiQtde * vi2.vdiValor) > 0
                THEN CAST(
                  (SUM(vi2.vdiQtde * vi2.vdiValor) - SUM(vi2.vdiQtde * vi2.vdiProCustoFinal))
                  / SUM(vi2.vdiQtde * vi2.vdiValor) * 100 AS decimal(10,2))
                ELSE NULL END
              FROM vendaItem vi2
              JOIN venda v2 ON vi2.vdiVedId = v2.vedId
              WHERE v2.vedClienteId = c.cliId
                AND v2.vedStatus = 'F' AND v2.vedTipo IN ('OS','VE') AND v2.vedTotalNf > 0
                AND v2.empId = @empId
                AND CONVERT(date, v2.vedFechamento) BETWEEN @start AND @end
                AND vi2.vdiCancel = 0
            ) AS margemCliente
          FROM venda v
          JOIN cliente c ON v.vedClienteId = c.cliId
          WHERE v.vedStatus = 'F'
            AND v.vedTipo IN ('OS','VE')
            AND v.vedTotalNf > 0
            AND v.empId = @empId
            AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
            ${vClauseJ}${cClauseJ}${pClauseJ}
          GROUP BY c.cliNome, c.cliTipoCad, c.cliId
          ORDER BY total DESC`,
          { start, end, ...ep(config), ...vp, ...cp }
        );

        return NextResponse.json(
          rows.map((r) => ({
            nome: r.nome,
            total: Number(r.total),
            compras: Number(r.compras),
            ticketMedio: Number(r.compras) > 0 ? Number(r.total) / Number(r.compras) : 0,
            ultimaCompra: r.ultimaCompra
              ? new Date(r.ultimaCompra).toISOString().split("T")[0]
              : "",
            tipoPessoa: (Number(r.tipoCad) === 1 ? "PF" : "PJ") as "PF" | "PJ",
            cidade: r.cidade || null,
            estado: r.estado || null,
            email: r.email || null,
            telefone: r.fone || null,
            cnpjCpf: r.cpfCgc || null,
            mesesAtivos: Number(r.mesesAtivos),
            devolucoes: Number(r.devolucoes),
            margemCliente: r.margemCliente != null ? Number(r.margemCliente) : null,
          }))
        );
      }

      case "top-vendedores": {
        const rows = await queryBridge<{
          vendedorId: number;
          nome: string;
          valor: number;
          quantidade: number;
        }>(
          config,
          `SELECT TOP 10
            c.cliId                             AS vendedorId,
            c.cliNome                           AS nome,
            ISNULL(SUM(v.vedTotalNf), 0)       AS valor,
            COUNT(*)                            AS quantidade
          FROM venda v
          JOIN cliente c ON v.vedAtendente = c.cliId
          WHERE v.vedStatus = 'F'
            AND v.vedTipo IN ('OS','VE')
            AND v.vedTotalNf > 0
            AND v.empId = @empId
            AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
            ${cClauseJ}${pClauseJ}
          GROUP BY c.cliId, c.cliNome
          ORDER BY valor DESC`,
          { start, end, ...ep(config), ...cp }
        );

        return NextResponse.json(
          rows.map((r) => ({
            vendedorId: Number(r.vendedorId),
            nome: r.nome,
            valor: Number(r.valor),
            quantidade: Number(r.quantidade),
            ticketMedio: Number(r.quantidade) > 0 ? Number(r.valor) / Number(r.quantidade) : 0,
          }))
        );
      }

      case "vendas-tipo-cliente": {
        const rows = await queryBridge<{ tipoCad: number; total: number; qtd: number }>(
          config,
          `SELECT
            c.cliTipoCad                        AS tipoCad,
            ISNULL(SUM(v.vedTotalNf), 0)       AS total,
            COUNT(*)                            AS qtd
          FROM venda v
          JOIN cliente c ON v.vedClienteId = c.cliId
          WHERE v.vedStatus = 'F'
            AND v.vedTipo IN ('OS','VE')
            AND v.vedTotalNf > 0
            AND v.empId = @empId
            AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
            ${cClauseJ}${pClauseJ}
          GROUP BY c.cliTipoCad`,
          { start, end, ...ep(config), ...cp }
        );

        let pfTotal = 0, pfCount = 0, pjTotal = 0, pjCount = 0;
        for (const r of rows) {
          if (Number(r.tipoCad) === 1) {
            pfTotal += Number(r.total);
            pfCount += Number(r.qtd);
          } else {
            pjTotal += Number(r.total);
            pjCount += Number(r.qtd);
          }
        }

        return NextResponse.json({
          pf: { total: pfTotal, clientes: pfCount },
          pj: { total: pjTotal, clientes: pjCount },
        });
      }

      case "formas-pagamento": {
        const rows = await queryBridge<{ forma: string; total: number; qtdVendas: number }>(
          config,
          `SELECT
            ISNULL(vp.pgtTipoDesc, 'Outros')        AS forma,
            ISNULL(SUM(vp.pgtValor), 0)             AS total,
            COUNT(DISTINCT vp.pgtVendaId)           AS qtdVendas
          FROM vendaPgto vp
          JOIN venda v ON vp.pgtVendaId = v.vedId
          WHERE v.vedStatus = 'F'
            AND v.vedTipo IN ('OS','VE')
            AND v.vedTotalNf > 0
            AND v.empId = @empId
            AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
            ${vClauseJ}${cClauseJ}${pClauseJ}
          GROUP BY vp.pgtTipoDesc
          ORDER BY total DESC`,
          { start, end, ...ep(config), ...vp, ...cp }
        );

        const totalGeral = rows.reduce((s, r) => s + Number(r.total), 0);
        return NextResponse.json(
          rows.map((r) => ({
            nome: r.forma,
            valor: Number(r.total),
            percentual: totalGeral > 0 ? (Number(r.total) / totalGeral) * 100 : 0,
            qtdVendas: Number(r.qtdVendas),
          }))
        );
      }

      case "clientes-retencao": {
        const rows = await queryBridge<{
          novos: number;
          recorrentes: number;
          faturamentoNovos: number;
          faturamentoRecorrentes: number;
        }>(
          config,
          `WITH compras_periodo AS (
            SELECT vedClienteId, ISNULL(SUM(vedTotalNf), 0) AS valor
            FROM venda
            WHERE vedStatus = 'F'
              AND vedTipo IN ('OS','VE')
              AND vedTotalNf > 0
              AND empId = @empId
              AND CONVERT(date, vedFechamento) BETWEEN @start AND @end
              AND vedClienteId != 0
            GROUP BY vedClienteId
          ),
          primeira_compra AS (
            SELECT vedClienteId, MIN(CONVERT(date, vedFechamento)) AS primeira
            FROM venda
            WHERE vedStatus = 'F'
              AND vedTipo IN ('OS','VE')
              AND vedTotalNf > 0
              AND empId = @empId
              AND vedClienteId != 0
            GROUP BY vedClienteId
          )
          SELECT
            SUM(CASE WHEN pc.primeira >= @start THEN 1 ELSE 0 END)        AS novos,
            SUM(CASE WHEN pc.primeira < @start  THEN 1 ELSE 0 END)        AS recorrentes,
            ISNULL(SUM(CASE WHEN pc.primeira >= @start THEN cp.valor ELSE 0 END), 0) AS faturamentoNovos,
            ISNULL(SUM(CASE WHEN pc.primeira < @start  THEN cp.valor ELSE 0 END), 0) AS faturamentoRecorrentes
          FROM compras_periodo cp
          JOIN primeira_compra pc ON cp.vedClienteId = pc.vedClienteId`,
          { start, end, ...ep(config) }
        );

        const r = rows[0] ?? { novos: 0, recorrentes: 0, faturamentoNovos: 0, faturamentoRecorrentes: 0 };
        return NextResponse.json({
          novos:                   Number(r.novos),
          recorrentes:             Number(r.recorrentes),
          faturamentoNovos:        Number(r.faturamentoNovos),
          faturamentoRecorrentes:  Number(r.faturamentoRecorrentes),
        });
      }

      default:
        return NextResponse.json({ error: "type inválido" }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof BridgeError ? e.message : String(e instanceof Error ? e.message : e);
    console.error(`[charts/${type}] bridge error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
