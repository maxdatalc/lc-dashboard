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

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const lojaIdsParam = searchParams.get("lojaIds");
  const lojaId = searchParams.get("lojaId");
  const period = searchParams.get("period") ?? "month";
  const type = searchParams.get("type");

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
              AND vedFechamento >= DATEADD(month, -11, DATEFROMPARTS(YEAR(@start), MONTH(@start), 1))
              AND CONVERT(date, vedFechamento) <= @end
            GROUP BY FORMAT(vedFechamento, 'yyyy-MM')
            ORDER BY mes`,
            { start: inicio12m, end }
          ),
          queryBridge<{ mes: string; total: number }>(
            config,
            `SELECT
              FORMAT(vedFechamento, 'yyyy-MM')   AS mes,
              ISNULL(SUM(vedTotalNf), 0)         AS total
            FROM venda
            WHERE vedStatus = 'F'
              AND vedTipo = 'DV'
              AND vedFechamento >= DATEADD(month, -11, DATEFROMPARTS(YEAR(@start), MONTH(@start), 1))
              AND CONVERT(date, vedFechamento) <= @end
            GROUP BY FORMAT(vedFechamento, 'yyyy-MM')
            ORDER BY mes`,
            { start: inicio12m, end }
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
        const rows = await queryBridge<{ nome: string; valor: number; quantidade: number }>(
          config,
          `SELECT TOP 50
            vi.vdiProNome                              AS nome,
            ISNULL(SUM(vi.vdiQtde * vi.vdiValor), 0) AS valor,
            ISNULL(SUM(vi.vdiQtde), 0)               AS quantidade
          FROM vendaItem vi
          JOIN venda v ON vi.vdiVedId = v.vedId
          WHERE v.vedStatus = 'F'
            AND v.vedTipo IN ('OS','VE')
            AND vi.vdiCancel = 0
            AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
          GROUP BY vi.vdiProNome
          ORDER BY valor DESC`,
          { start, end }
        );

        return NextResponse.json(
          rows.map((r) => ({
            nome: r.nome,
            valor: Number(r.valor),
            quantidade: Number(r.quantidade),
            externalId: null,
            codigo: null,
            grupoNome: null,
            subGrupo: null,
            fabricante: null,
            precoVenda: null,
            valorCusto: null,
            margem: null,
            estoqueAtual: null,
          }))
        );
      }

      case "top-grupos": {
        const rows = await queryBridge<{ nome: string; valor: number; quantidade: number }>(
          config,
          `SELECT TOP 20
            gp.gdpNome                                 AS nome,
            ISNULL(SUM(vi.vdiQtde * vi.vdiValor), 0) AS valor,
            ISNULL(SUM(vi.vdiQtde), 0)               AS quantidade
          FROM vendaItem vi
          JOIN venda v ON vi.vdiVedId = v.vedId
          JOIN produto p ON vi.vdiItemId = p.proId
          JOIN grupoProd gp ON p.proGrupo = gp.gdpId
          WHERE v.vedStatus = 'F'
            AND v.vedTipo IN ('OS','VE')
            AND vi.vdiCancel = 0
            AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
          GROUP BY gp.gdpNome
          ORDER BY valor DESC`,
          { start, end }
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
          nome: string;
          total: number;
          compras: number;
          ultimaCompra: string;
          tipoCad: number;
        }>(
          config,
          `SELECT TOP 50
            c.cliNome                           AS nome,
            ISNULL(SUM(v.vedTotalNf), 0)       AS total,
            COUNT(*)                            AS compras,
            MAX(v.vedFechamento)                AS ultimaCompra,
            c.cliTipoCad                        AS tipoCad
          FROM venda v
          JOIN cliente c ON v.vedClienteId = c.cliId
          WHERE v.vedStatus = 'F'
            AND v.vedTipo IN ('OS','VE')
            AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
          GROUP BY c.cliNome, c.cliTipoCad
          ORDER BY total DESC`,
          { start, end }
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
            tipoPessoa: (Number(r.tipoCad) === 1 ? "PJ" : "PF") as "PF" | "PJ",
            cidade: null,
            estado: null,
            email: null,
            telefone: null,
            cnpjCpf: null,
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
            AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
          GROUP BY c.cliId, c.cliNome
          ORDER BY valor DESC`,
          { start, end }
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
            AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
          GROUP BY c.cliTipoCad`,
          { start, end }
        );

        let pfTotal = 0, pfCount = 0, pjTotal = 0, pjCount = 0;
        for (const r of rows) {
          if (Number(r.tipoCad) === 1) {
            pjTotal += Number(r.total);
            pjCount += Number(r.qtd);
          } else {
            pfTotal += Number(r.total);
            pfCount += Number(r.qtd);
          }
        }

        return NextResponse.json({
          pf: { total: pfTotal, clientes: pfCount },
          pj: { total: pjTotal, clientes: pjCount },
        });
      }

      case "formas-pagamento": {
        const rows = await queryBridge<{ forma: string; total: number }>(
          config,
          `SELECT
            cv.cavPgtTipoDesc                   AS forma,
            ISNULL(SUM(cv.cavPgtValor), 0)     AS total
          FROM caixaVendas cv
          JOIN venda v ON cv.cavVedId = v.vedId
          WHERE v.vedStatus = 'F'
            AND v.vedTipo IN ('OS','VE')
            AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
          GROUP BY cv.cavPgtTipoDesc
          ORDER BY total DESC`,
          { start, end }
        );

        const totalGeral = rows.reduce((s, r) => s + Number(r.total), 0);
        return NextResponse.json(
          rows.map((r) => ({
            nome: r.forma,
            valor: Number(r.total),
            percentual: totalGeral > 0 ? (Number(r.total) / totalGeral) * 100 : 0,
          }))
        );
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
