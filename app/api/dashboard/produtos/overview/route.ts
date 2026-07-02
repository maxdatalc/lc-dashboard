import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/api/tenant-guard";
import { getLojasBridge } from "@/lib/db/tenants";
import {
  getProdutosOverview,
  type ProdutosFilters,
  type StatusEstoque,
  type ClasseAbc,
} from "@/lib/db/produtos-estoque";

export const dynamic = "force-dynamic";

const STATUS_VALIDOS: StatusEstoque[] = [
  "abaixo", "acima", "semMin", "negativo", "margemNeg", "regular",
];
const CLASSES_ABC_VALIDAS: ClasseAbc[] = ["A", "B", "C", "semGiro"];
const DIAS_VALIDOS = [30, 60, 90];

/**
 * Endpoint consolidado do Dashboard de Produtos & Estoque.
 * Uma única chamada devolve KPIs, rankings, saúde do estoque, alertas, Curva ABC,
 * produtos parados, oportunidades de transferência entre lojas e a tabela
 * "Produtos que Exigem Ação" — tudo agregado no SQL e já respeitando os filtros de
 * cross-filtering (marca, grupo, categoria, status, classeAbc, parado, busca),
 * garantindo que todos os widgets fiquem coerentes entre si.
 *
 * Estoque é uma FOTOGRAFIA atual — não usa o filtro de período do header. Os
 * indicadores de giro (Curva ABC, produtos parados, ruptura ativa, sugestão de
 * compra) usam uma janela local própria (`dias`, 30/60/90), independente do
 * período global. Multilojas consolida as posições (produto × filial) das lojas
 * selecionadas.
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
  const classeAbcParam = searchParams.get("classeAbc");
  const diasParam = Number(searchParams.get("dias"));
  const dias = DIAS_VALIDOS.includes(diasParam) ? diasParam : 90;

  const filters: ProdutosFilters = {
    marca: searchParams.get("marca") || null,
    grupo: searchParams.get("grupo") || null,
    categoria: searchParams.get("categoria") || null,
    status: STATUS_VALIDOS.includes(statusParam as StatusEstoque)
      ? (statusParam as StatusEstoque)
      : null,
    classeAbc: CLASSES_ABC_VALIDAS.includes(classeAbcParam as ClasseAbc)
      ? (classeAbcParam as ClasseAbc)
      : null,
    parado: searchParams.get("parado") === "1",
    busca: searchParams.get("busca") || null,
  };

  try {
    const overview = await getProdutosOverview({ bridgeUrl, token }, empIds, empresas, filters, dias);
    return NextResponse.json({ filiais: empresas, dias, ...overview });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao consultar produtos";
    console.error("[produtos/overview]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
