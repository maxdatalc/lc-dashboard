import { NextRequest, NextResponse } from "next/server";
import { getDateRange } from "@/lib/utils/format";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojaDbConfig } from "@/lib/db/tenants";
import { queryBridge, BridgeError } from "@/lib/mssql/client";

export const dynamic = "force-dynamic";

const PAGE_LIMIT = 20;

function mapStatus(vedStatus: string): string {
  switch (vedStatus) {
    case "F": return "finalizada";
    case "C": return "cancelada";
    case "O": return "pendente";
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
  const { start, end } = startParam && endParam
    ? { start: startParam, end: endParam }
    : getDateRange(period);

  const statusFiltro = searchParams.get("status");
  const tipoFiltro   = searchParams.get("tipo");
  const search       = (searchParams.get("search") ?? "").trim();
  const page         = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit        = parseInt(searchParams.get("limit") ?? String(PAGE_LIMIT), 10);
  const offset       = (page - 1) * limit;

  // Usa o primeiro bridge configurado entre as lojas disponíveis
  let config: Awaited<ReturnType<typeof getLojaDbConfig>> = null;
  let usedLojaId = lojaIds[0];
  for (const id of lojaIds) {
    config = await getLojaDbConfig(id).catch(() => null);
    if (config) { usedLojaId = id; break; }
  }

  if (!config) {
    return NextResponse.json(
      { error: "Bridge SQL não configurada para esta loja." },
      { status: 503 }
    );
  }

  // Condições WHERE dinâmicas
  const conditions: string[] = [
    "CONVERT(date, vedFechamento) BETWEEN @start AND @end",
    "empId = @empId",
  ];
  const params: Record<string, unknown> = { start, end, offset, limit, empId: config.empId };

  if (statusFiltro === "finalizada") conditions.push("vedStatus = 'F'");
  else if (statusFiltro === "cancelada") conditions.push("vedStatus = 'C'");
  else if (statusFiltro === "pendente") conditions.push("vedStatus = 'O'");
  else conditions.push("vedStatus IN ('F','C','O')");

  if (tipoFiltro === "venda") conditions.push("vedTipo = 'VE'");
  else if (tipoFiltro === "devolucao") conditions.push("vedTipo = 'DV'");
  else conditions.push("vedTipo IN ('OS','VE','DV')");

  if (search) {
    conditions.push("vedCliNome LIKE @search");
    params.search = `%${search}%`;
  }

  const where = "WHERE " + conditions.join(" AND ");

  try {
    const [dataRows, countRows] = await Promise.all([
      queryBridge<VendaDbRow>(
        config,
        `SELECT
          vedId, vedTotalNf, vedFechamento, vedStatus,
          ISNULL(vedNfCfop, vedCfop) AS vedNfCfop,
          vedCliNome
        FROM venda
        ${where}
        ORDER BY vedFechamento DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
        params
      ),
      queryBridge<{ total: number }>(
        config,
        `SELECT COUNT(*) AS total FROM venda ${where}`,
        params
      ),
    ]);

    const totalCount = Number(countRows[0]?.total ?? 0);

    const vendas = dataRows.map((r) => ({
      id: String(r.vedId),
      external_id: r.vedId,
      loja_id: usedLojaId,
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
    console.error("[vendas] bridge error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
