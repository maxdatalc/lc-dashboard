import { NextRequest, NextResponse } from "next/server";
import { getDateRange } from "@/lib/utils/format";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojaDbConfig } from "@/lib/db/tenants";
import { queryBridge, BridgeError } from "@/lib/mssql/client";

export const dynamic = "force-dynamic";

const PAGE_LIMIT = 20;

function isDate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }

function mapStatus(vedStatus: string): string {
  switch (vedStatus) {
    case "F": return "finalizada";
    case "C": return "cancelada";
    case "S": return "pendente";
    default:  return vedStatus;
  }
}

interface VendaDbRow {
  vedId: number;
  vedTotalNf: number;
  vedFechamento: string;
  vedStatus: string;
  vedNfCfop: number | null;
  vedCfop: number | null;
  vedCliNome: string | null;
  total: number;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;

  const lojaIdsParam = searchParams.get("lojaIds");
  const lojaId = searchParams.get("lojaId");
  const lojaIds = lojaIdsParam
    ? lojaIdsParam.split(",").filter(Boolean)
    : lojaId
    ? [lojaId]
    : [];

  if (lojaIds.length === 0) {
    return NextResponse.json({ error: "lojaId ou lojaIds é obrigatório" }, { status: 400 });
  }

  const guard = await requireTenantAccess(lojaIds);
  if (guard instanceof NextResponse) return guard;

  const period = searchParams.get("period") ?? "month";
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  if (startParam && endParam && (!isDate(startParam) || !isDate(endParam))) {
    return NextResponse.json({ error: "start e end devem ser YYYY-MM-DD" }, { status: 400 });
  }
  const { start, end } = startParam && endParam
    ? { start: startParam, end: endParam }
    : getDateRange(period);

  const statusFiltro = searchParams.get("status");
  const tipoFiltro   = searchParams.get("tipo");
  const search       = (searchParams.get("search") ?? "").trim();
  const page         = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit        = Math.min(parseInt(searchParams.get("limit") ?? String(PAGE_LIMIT), 10), 200);
  const offset       = (page - 1) * limit;

  // Condições WHERE dinâmicas (empId entra por parâmetro em cada loja no loop abaixo)
  const conditions: string[] = [
    "CONVERT(date, vedFechamento) BETWEEN @start AND @end",
    "empId = @empId",
  ];
  const params: Record<string, unknown> = { start, end };

  if (statusFiltro === "finalizada") conditions.push("vedStatus = 'F'");
  else if (statusFiltro === "cancelada") conditions.push("vedStatus = 'C'");
  else if (statusFiltro === "pendente") conditions.push("vedStatus = 'S'");
  else conditions.push("vedStatus IN ('F','C','S')");

  if (tipoFiltro === "venda") conditions.push("vedTipo = 'VE'");
  else if (tipoFiltro === "devolucao") conditions.push("vedTipo = 'DV'");
  else conditions.push("vedTipo IN ('OS','VE','DV')");

  if (search) {
    conditions.push("vedCliNome LIKE @search");
    params.search = `%${search}%`;
  }

  const where = "WHERE " + conditions.join(" AND ");

  // Cada loja selecionada pode ter uma bridge SQL física distinta — não há como fazer um
  // único OFFSET/FETCH global entre bancos diferentes. Estratégia (k-way merge): busca as
  // top (offset+limit) linhas de CADA loja (já ordenadas por vedFechamento DESC), mescla
  // tudo em memória, ordena de novo e só então corta a página pedida. Isso garante a página
  // correta porque as (offset+limit) linhas mais recentes de cada fonte cobrem qualquer
  // combinação possível do conjunto global ordenado. `total` é uma soma simples (COUNT(*)
  // por loja é aditivo — ao contrário de COUNT(DISTINCT...), não duplica nada entre lojas).
  const topN = offset + limit;
  let bridgeFound = false;
  let lastError = "";
  let totalCount = 0;
  const merged: Array<VendaDbRow & { lojaId: string }> = [];

  await Promise.all(
    lojaIds.map(async (id) => {
      const config = await getLojaDbConfig(id).catch(() => null);
      if (!config) return;
      bridgeFound = true;

      try {
        const lojaParams = { ...params, empId: config.empId, topN };
        const [dataRows, countRows] = await Promise.all([
          queryBridge<VendaDbRow>(
            config,
            `SELECT TOP (@topN)
              vedId, vedTotalNf, vedFechamento, vedStatus,
              ISNULL(vedNfCfop, vedCfop) AS vedNfCfop,
              vedCliNome
            FROM venda
            ${where}
            ORDER BY vedFechamento DESC`,
            lojaParams
          ),
          queryBridge<{ total: number }>(
            config,
            `SELECT COUNT(*) AS total FROM venda ${where}`,
            lojaParams
          ),
        ]);

        totalCount += Number(countRows[0]?.total ?? 0);
        for (const r of dataRows) merged.push({ ...r, lojaId: id });
      } catch (e) {
        lastError = e instanceof BridgeError ? e.message : String(e instanceof Error ? e.message : e);
        console.error(`[vendas] bridge error loja ${id}:`, lastError);
      }
    })
  );

  if (!bridgeFound) {
    return NextResponse.json(
      { error: "Bridge SQL não configurada para esta loja." },
      { status: 503 }
    );
  }

  if (lastError && merged.length === 0 && totalCount === 0) {
    return NextResponse.json({ error: lastError }, { status: 500 });
  }

  try {
    merged.sort((a, b) => {
      const da = a.vedFechamento ? new Date(a.vedFechamento).getTime() : 0;
      const db = b.vedFechamento ? new Date(b.vedFechamento).getTime() : 0;
      return db - da;
    });
    const pageRows = merged.slice(offset, offset + limit);

    const vendas = pageRows.map((r) => ({
      id: String(r.vedId),
      external_id: r.vedId,
      loja_id: r.lojaId,
      data_venda: r.vedFechamento
        ? new Date(r.vedFechamento).toISOString().split("T")[0]
        : "",
      valor_total: r.vedTotalNf != null ? Number(r.vedTotalNf) : null,
      status: mapStatus(r.vedStatus ?? ""),
      cfop: r.vedNfCfop != null ? Number(r.vedNfCfop) : null,
      cliente_nome: r.vedCliNome ?? null,
    }));

    return NextResponse.json({
      vendas,
      total: totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (e) {
    const msg = e instanceof BridgeError ? e.message : String(e instanceof Error ? e.message : e);
    console.error("[vendas] merge error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
