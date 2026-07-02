import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojasBridge } from "@/lib/db/tenants";
import {
  getProdutosOverview,
  type ProdutosFilters,
  type StatusEstoque,
} from "@/lib/db/produtos-estoque";

export const dynamic = "force-dynamic";

const STATUS_VALIDOS: StatusEstoque[] = [
  "abaixo", "acima", "semMin", "negativo", "margemNeg", "regular",
];

/**
 * Endpoint consolidado do Dashboard de Produtos & Estoque.
 * Uma única chamada devolve KPIs, rankings, saúde do estoque, alertas, listas de
 * problemas e a tabela "Produtos que Exigem Ação" — tudo agregado no SQL e já
 * respeitando os filtros de cross-filtering (marca, grupo, categoria, status, busca),
 * garantindo que todos os widgets fiquem coerentes entre si.
 *
 * Estoque é uma FOTOGRAFIA atual — não usa filtro de período. Multilojas consolida
 * as posições (produto × filial) das lojas selecionadas.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lojaIds = (searchParams.get("lojaIds") ?? "").split(",").filter(Boolean);
  if (lojaIds.length === 0) {
    return NextResponse.json({ error: "lojaIds obrigatório" }, { status: 400 });
  }

  const auth = await requireTenantAccess(lojaIds);
  if (auth instanceof NextResponse) return auth;

  const cfg = await getLojasBridge(lojaIds);
  if (!cfg) return NextResponse.json({ error: "Bridge não configurada" }, { status: 404 });

  const { bridgeUrl, token, empresas } = cfg;
  const empIds = empresas.map((e) => e.empId).filter(Number.isFinite);
  if (empIds.length === 0) {
    return NextResponse.json({ error: "Sem filiais válidas" }, { status: 404 });
  }

  const statusParam = searchParams.get("status");
  const filters: ProdutosFilters = {
    marca: searchParams.get("marca") || null,
    grupo: searchParams.get("grupo") || null,
    categoria: searchParams.get("categoria") || null,
    status: STATUS_VALIDOS.includes(statusParam as StatusEstoque)
      ? (statusParam as StatusEstoque)
      : null,
    busca: searchParams.get("busca") || null,
  };

  try {
    const overview = await getProdutosOverview({ bridgeUrl, token }, empIds, filters);
    return NextResponse.json({ filiais: empresas, ...overview });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao consultar produtos";
    console.error("[produtos/overview]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
