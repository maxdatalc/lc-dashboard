import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDateRange } from "@/lib/utils/format";

const PAGE_LIMIT = 20;

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

  const period = searchParams.get("period") ?? "month";
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const { start, end } = startParam && endParam
    ? { start: startParam, end: endParam }
    : getDateRange(period);

  const status = searchParams.get("status");        // ex: "finalizada"
  const tipo = searchParams.get("tipo");            // ex: "venda" | "devolucao"
  const search = searchParams.get("search") ?? "";  // busca por cliente_nome
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = parseInt(searchParams.get("limit") ?? String(PAGE_LIMIT), 10);
  const offset = (page - 1) * limit;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let query = supabase
    .from("vendas")
    .select(
      "id, external_id, loja_id, data_venda, valor_total, status, cfop, cliente_nome",
      { count: "exact" }
    )
    .in("loja_id", lojaIds)
    .gte("data_venda", start)
    .lte("data_venda", end)
    .order("data_venda", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  // Filtro por tipo: venda (5xxx/6xxx ou null) vs devolucao (1xxx/2xxx/3xxx)
  if (tipo === "venda") {
    query = query.or("cfop.is.null,cfop.gte.5000");
  } else if (tipo === "devolucao") {
    query = query.lt("cfop", 4000).not("cfop", "is", null);
  }

  if (search.trim()) {
    query = query.ilike("cliente_nome", `%${search.trim()}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[vendas] erro:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    vendas: data ?? [],
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
  });
}
