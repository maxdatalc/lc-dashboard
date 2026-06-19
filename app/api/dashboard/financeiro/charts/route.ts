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

  // Para gráficos temporais: sempre 12 meses terminando em `end`
  const endParam = searchParams.get("end") ?? new Date().toISOString().split("T")[0];
  const endDate  = new Date(endParam + "T12:00:00");
  const base12mDate = new Date(endDate);
  base12mDate.setMonth(base12mDate.getMonth() - 11);
  base12mDate.setDate(1);
  const base12m = base12mDate.toISOString().split("T")[0];

  const q = <T>(sql: string, params?: Record<string, unknown>) =>
    queryBridge<T>({ bridgeUrl, token }, sql, { empId, ...params });

  switch (type) {
    case "faturamento-recebimentos": {
      const [fatRows, recRows] = await Promise.all([
        q<{ mes: string; faturamento: number; qtd: number }>(`
          SELECT FORMAT(vedFechamento,'yyyy-MM') AS mes,
                 SUM(vedTotalNf) AS faturamento,
                 COUNT(*) AS qtd
          FROM venda
          WHERE vedStatus='F' AND vedTipo IN ('OS','VE') AND vedTotalNf>0 AND empId=@empId
            AND CONVERT(date,vedFechamento) >= @base12m
            AND CONVERT(date,vedFechamento) <= @endDate
          GROUP BY FORMAT(vedFechamento,'yyyy-MM')
          ORDER BY mes
        `, { base12m, endDate: endParam }),
        q<{ mes: string; recebido: number }>(`
          SELECT FORMAT(pgtDataQuitou,'yyyy-MM') AS mes,
                 SUM(pgtValor) AS recebido
          FROM vendaPgto
          WHERE pgtPago='S' AND empId=@empId AND pgtDataQuitou IS NOT NULL
            AND CONVERT(date,pgtDataQuitou) >= @base12m
            AND CONVERT(date,pgtDataQuitou) <= @endDate
          GROUP BY FORMAT(pgtDataQuitou,'yyyy-MM')
          ORDER BY mes
        `, { base12m, endDate: endParam }),
      ]);

      // Gera todos os meses do intervalo para preencher lacunas com zero
      const mesMap = new Map<string, { mes: string; faturamento: number; recebido: number; qtdVendas: number }>();
      const cursor = new Date(base12mDate);
      while (cursor <= endDate) {
        const key = cursor.toISOString().slice(0, 7);
        mesMap.set(key, { mes: key, faturamento: 0, recebido: 0, qtdVendas: 0 });
        cursor.setMonth(cursor.getMonth() + 1);
      }

      for (const r of fatRows) {
        const entry = mesMap.get(r.mes);
        if (entry) { entry.faturamento = Number(r.faturamento); entry.qtdVendas = Number(r.qtd); }
      }
      for (const r of recRows) {
        const entry = mesMap.get(r.mes);
        if (entry) entry.recebido = Number(r.recebido);
      }

      const result = Array.from(mesMap.values())
        .sort((a, b) => a.mes.localeCompare(b.mes))
        .map((r) => ({
          ...r,
          taxaRec: r.faturamento > 0 ? Math.round(r.recebido / r.faturamento * 1000) / 10 : null,
        }));

      return NextResponse.json(result);
    }

    case "fluxo-caixa": {
      const rows = await q<{ mes: string; entradas: number; saidas: number }>(`
        SELECT FORMAT(ctmData,'yyyy-MM') AS mes,
               ISNULL(SUM(CASE WHEN ctmSinal='+' THEN ctmValor ELSE 0 END),0) AS entradas,
               ISNULL(SUM(CASE WHEN ctmSinal='-' THEN ABS(ctmValor) ELSE 0 END),0) AS saidas
        FROM contaMov
        WHERE empId=@empId AND ctmTipoMov IN ('CP','CR')
          AND CONVERT(date,ctmData) >= @base12m
          AND CONVERT(date,ctmData) <= @endDate
        GROUP BY FORMAT(ctmData,'yyyy-MM')
        ORDER BY mes
      `, { base12m, endDate: endParam });

      // Garante todos os meses no intervalo
      const mesMap = new Map<string, { mes: string; entradas: number; saidas: number }>();
      const cursor = new Date(base12mDate);
      while (cursor <= endDate) {
        const key = cursor.toISOString().slice(0, 7);
        mesMap.set(key, { mes: key, entradas: 0, saidas: 0 });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      for (const r of rows) {
        const entry = mesMap.get(r.mes);
        if (entry) { entry.entradas = Number(r.entradas); entry.saidas = Number(r.saidas); }
      }

      let acumulado = 0;
      const result = Array.from(mesMap.values())
        .sort((a, b) => a.mes.localeCompare(b.mes))
        .map((r) => {
          const saldo = r.entradas - r.saidas;
          acumulado += saldo;
          return { mes: r.mes, entradas: r.entradas, saidas: r.saidas, saldo, acumulado };
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
          AND CONVERT(date,v.vedFechamento) >= @base12m
          AND CONVERT(date,v.vedFechamento) <= @endDate
        GROUP BY FORMAT(v.vedFechamento,'yyyy-MM')
        ORDER BY mes
      `, { base12m, endDate: endParam });

      const mesMap = new Map<string, { mes: string; receita: number; custo: number }>();
      const cursor = new Date(base12mDate);
      while (cursor <= endDate) {
        const key = cursor.toISOString().slice(0, 7);
        mesMap.set(key, { mes: key, receita: 0, custo: 0 });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      for (const r of rows) {
        const entry = mesMap.get(r.mes);
        if (entry) { entry.receita = Number(r.receita); entry.custo = Number(r.custo); }
      }

      return NextResponse.json(
        Array.from(mesMap.values())
          .sort((a, b) => a.mes.localeCompare(b.mes))
          .map((r) => {
            const lucro = r.receita - r.custo;
            return { mes: r.mes, receita: r.receita, custo: r.custo, lucro,
              margemPct: r.receita > 0 ? Math.round((lucro / r.receita) * 10000) / 100 : 0 };
          })
      );
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
        "01-30d": "1–30 dias", "31-60d": "31–60 dias", "61-90d": "61–90 dias", "+90d": "+90 dias",
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

    default:
      return NextResponse.json({ error: `Tipo desconhecido: ${type}` }, { status: 400 });
  }
}
