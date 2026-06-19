import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojaDbConfig } from "@/lib/db/tenants";
import { queryBridge } from "@/lib/mssql/client";

export const dynamic = "force-dynamic";

async function getConfig(lojaIds: string[]) {
  for (const id of lojaIds) {
    const cfg = await getLojaDbConfig(id);
    if (cfg) return cfg;
  }
  return null;
}

export async function GET(request: Request) {
  const auth = await requireTenantAccess();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const lojaIds = (searchParams.get("lojaIds") ?? "").split(",").filter(Boolean);
  const type    = searchParams.get("type") ?? "";
  const aging   = searchParams.get("aging") ?? "";

  if (lojaIds.length === 0) return NextResponse.json({ error: "lojaIds obrigatório" }, { status: 400 });

  const cfg = await getConfig(lojaIds);
  if (!cfg) return NextResponse.json({ error: "Bridge não configurada" }, { status: 404 });

  const { bridgeUrl, token, empId } = cfg;
  const q = <T>(sql: string) => queryBridge<T>({ bridgeUrl, token }, sql, { empId });

  // Base de 12 meses: primeiro dia de 11 meses atrás até hoje
  const base12m = `DATEADD(MONTH,-11, DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1))`;

  switch (type) {
    case "faturamento-recebimentos": {
      const [fatRows, recRows] = await Promise.all([
        q<{ mes: string; faturamento: number; qtd: number }>(`
          SELECT FORMAT(vedFechamento,'yyyy-MM') AS mes,
                 SUM(vedTotalNf) AS faturamento,
                 COUNT(*) AS qtd
          FROM venda
          WHERE vedStatus='F' AND vedTipo IN ('OS','VE') AND vedTotalNf>0 AND empId=@empId
            AND vedFechamento >= ${base12m}
          GROUP BY FORMAT(vedFechamento,'yyyy-MM')
          ORDER BY mes
        `),
        q<{ mes: string; recebido: number; qtd: number }>(`
          SELECT FORMAT(pgtDataQuitou,'yyyy-MM') AS mes,
                 SUM(pgtValor) AS recebido,
                 COUNT(*) AS qtd
          FROM vendaPgto
          WHERE pgtPago='S' AND empId=@empId AND pgtDataQuitou IS NOT NULL
            AND pgtDataQuitou >= ${base12m}
          GROUP BY FORMAT(pgtDataQuitou,'yyyy-MM')
          ORDER BY mes
        `),
      ]);

      // Mescla por mês
      const mesMap = new Map<string, { mes: string; faturamento: number; recebido: number; qtdVendas: number; qtdRec: number }>();
      for (const r of fatRows) {
        mesMap.set(r.mes, { mes: r.mes, faturamento: Number(r.faturamento), recebido: 0, qtdVendas: Number(r.qtd), qtdRec: 0 });
      }
      for (const r of recRows) {
        const existing = mesMap.get(r.mes);
        if (existing) {
          existing.recebido = Number(r.recebido);
          existing.qtdRec   = Number(r.qtd);
        } else {
          mesMap.set(r.mes, { mes: r.mes, faturamento: 0, recebido: Number(r.recebido), qtdVendas: 0, qtdRec: Number(r.qtd) });
        }
      }
      return NextResponse.json(Array.from(mesMap.values()).sort((a, b) => a.mes.localeCompare(b.mes)));
    }

    case "fluxo-caixa": {
      const rows = await q<{ mes: string; entradas: number; saidas: number }>(`
        SELECT FORMAT(ctmData,'yyyy-MM') AS mes,
               ISNULL(SUM(CASE WHEN ctmSinal='+' THEN ctmValor ELSE 0 END),0) AS entradas,
               ISNULL(SUM(CASE WHEN ctmSinal='-' THEN ABS(ctmValor) ELSE 0 END),0) AS saidas
        FROM contaMov
        WHERE empId=@empId AND ctmTipoMov IN ('CP','CR')
          AND ctmData >= ${base12m}
        GROUP BY FORMAT(ctmData,'yyyy-MM')
        ORDER BY mes
      `);
      // Calcula saldo acumulado
      let acumulado = 0;
      const result = rows.map((r) => {
        const saldo = Number(r.entradas) - Number(r.saidas);
        acumulado += saldo;
        return { mes: r.mes, entradas: Number(r.entradas), saidas: Number(r.saidas), saldo, acumulado };
      });
      return NextResponse.json(result);
    }

    case "margem": {
      const rows = await q<{ mes: string; receita: number; custo: number }>(`
        SELECT FORMAT(v.vedFechamento,'yyyy-MM') AS mes,
               ISNULL(SUM(vi.vdiQtde*vi.vdiValor),0) AS receita,
               ISNULL(SUM(vi.vdiQtde*vi.vdiProCustoFinal),0) AS custo
        FROM vendaItem vi JOIN venda v ON vi.vdiVedId=v.vedId
        WHERE v.vedStatus='F' AND v.vedTipo IN ('OS','VE') AND v.empId=@empId
          AND vi.vdiProCustoFinal>0
          AND v.vedFechamento >= ${base12m}
        GROUP BY FORMAT(v.vedFechamento,'yyyy-MM')
        ORDER BY mes
      `);
      return NextResponse.json(rows.map((r) => {
        const receita = Number(r.receita);
        const custo   = Number(r.custo);
        const lucro   = receita - custo;
        return {
          mes: r.mes,
          receita,
          custo,
          lucro,
          margemPct: receita > 0 ? Math.round((lucro / receita) * 10000) / 100 : 0,
        };
      }));
    }

    case "aging": {
      const rows = await q<{ faixa: string; qtd: number; valor: number }>(`
        SELECT
          CASE
            WHEN DATEDIFF(DAY,pgtVecmto,GETDATE()) BETWEEN 1  AND 30 THEN '01-30d'
            WHEN DATEDIFF(DAY,pgtVecmto,GETDATE()) BETWEEN 31 AND 60 THEN '31-60d'
            WHEN DATEDIFF(DAY,pgtVecmto,GETDATE()) BETWEEN 61 AND 90 THEN '61-90d'
            ELSE '+90d'
          END AS faixa,
          COUNT(*) AS qtd,
          ISNULL(SUM(pgtValor),0) AS valor
        FROM vendaPgto
        WHERE empId=@empId AND pgtPago IN ('N','F') AND pgtVecmto < CONVERT(date,GETDATE())
        GROUP BY
          CASE
            WHEN DATEDIFF(DAY,pgtVecmto,GETDATE()) BETWEEN 1  AND 30 THEN '01-30d'
            WHEN DATEDIFF(DAY,pgtVecmto,GETDATE()) BETWEEN 31 AND 60 THEN '31-60d'
            WHEN DATEDIFF(DAY,pgtVecmto,GETDATE()) BETWEEN 61 AND 90 THEN '61-90d'
            ELSE '+90d'
          END
        ORDER BY faixa
      `);
      const labels: Record<string, string> = {
        "01-30d": "1–30 dias",
        "31-60d": "31–60 dias",
        "61-90d": "61–90 dias",
        "+90d":   "+90 dias",
      };
      const order = ["01-30d", "31-60d", "61-90d", "+90d"];
      const mapped = rows.map((r) => ({ faixa: r.faixa, label: labels[r.faixa] ?? r.faixa, qtd: Number(r.qtd), valor: Number(r.valor) }));
      return NextResponse.json(order.map((k) => mapped.find((r) => r.faixa === k) ?? { faixa: k, label: labels[k], qtd: 0, valor: 0 }));
    }

    case "top-devedores": {
      let agingWhere = "";
      if (aging === "01-30d") agingWhere = "AND DATEDIFF(DAY,pgtVecmto,GETDATE()) BETWEEN 1 AND 30";
      else if (aging === "31-60d") agingWhere = "AND DATEDIFF(DAY,pgtVecmto,GETDATE()) BETWEEN 31 AND 60";
      else if (aging === "61-90d") agingWhere = "AND DATEDIFF(DAY,pgtVecmto,GETDATE()) BETWEEN 61 AND 90";
      else if (aging === "+90d") agingWhere = "AND DATEDIFF(DAY,pgtVecmto,GETDATE()) > 90";

      const rows = await q<{ cliente: string; qtd: number; valor: number; mais_antigo: string; max_dias: number }>(`
        SELECT TOP 15
          pgtCliNome AS cliente,
          COUNT(*) AS qtd,
          ISNULL(SUM(pgtValor),0) AS valor,
          MIN(pgtVecmto) AS mais_antigo,
          MAX(DATEDIFF(DAY,pgtVecmto,GETDATE())) AS max_dias
        FROM vendaPgto
        WHERE empId=@empId AND pgtPago IN ('N','F') AND pgtVecmto < CONVERT(date,GETDATE())
          ${agingWhere}
        GROUP BY pgtCliNome
        ORDER BY valor DESC
      `);
      return NextResponse.json(rows.map((r) => ({
        cliente:    r.cliente,
        qtd:        Number(r.qtd),
        valor:      Number(r.valor),
        maisAntigo: r.mais_antigo,
        maxDias:    Number(r.max_dias),
      })));
    }

    case "tipo-operacao": {
      const rows = await q<{ tipo: string; qtd: number; valor: number }>(`
        SELECT
          CASE pgtTipoOpr
            WHEN 'OS' THEN 'Ordem de Serviço'
            WHEN 'VE' THEN 'Venda'
            WHEN 'FI' THEN 'Financiamento'
            WHEN 'RE' THEN 'Recebimento'
            WHEN 'CO' THEN 'Cobrança'
            WHEN 'FA' THEN 'Faturamento'
            WHEN 'NF' THEN 'Nota Fiscal'
            ELSE ISNULL(NULLIF(pgtTipoOpr,''),'Outros')
          END AS tipo,
          COUNT(*) AS qtd,
          ISNULL(SUM(pgtValor),0) AS valor
        FROM vendaPgto
        WHERE empId=@empId AND pgtPago='S'
          AND pgtDataQuitou >= ${base12m}
        GROUP BY
          CASE pgtTipoOpr
            WHEN 'OS' THEN 'Ordem de Serviço'
            WHEN 'VE' THEN 'Venda'
            WHEN 'FI' THEN 'Financiamento'
            WHEN 'RE' THEN 'Recebimento'
            WHEN 'CO' THEN 'Cobrança'
            WHEN 'FA' THEN 'Faturamento'
            WHEN 'NF' THEN 'Nota Fiscal'
            ELSE ISNULL(NULLIF(pgtTipoOpr,''),'Outros')
          END
        HAVING SUM(pgtValor) > 0
        ORDER BY valor DESC
      `);
      return NextResponse.json(rows.map((r) => ({ tipo: r.tipo, qtd: Number(r.qtd), valor: Number(r.valor) })));
    }

    default:
      return NextResponse.json({ error: `Tipo desconhecido: ${type}` }, { status: 400 });
  }
}
