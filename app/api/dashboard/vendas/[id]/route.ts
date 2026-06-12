import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireFeatureWithLojas } from "@/lib/api/plan-guard";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const externalId = params.id;
  const lojaId = req.nextUrl.searchParams.get("lojaId");

  if (!lojaId) {
    return NextResponse.json({ error: "lojaId é obrigatório" }, { status: 400 });
  }

  const denied = await requireFeatureWithLojas("modulo_vendas", [lojaId]);
  if (denied) return denied;

  const supabase = await createClient();

  // Buscar itens e pagamentos em paralelo
  const [itensRes, pagamentosRes] = await Promise.all([
    supabase
      .from("venda_itens")
      .select("produto_nome, quantidade, valor_unitario, valor_total, desconto")
      .eq("loja_id", lojaId)
      .eq("venda_external_id", externalId),
    supabase
      .from("venda_pagamentos")
      .select("forma_pagamento, valor, parcelas")
      .eq("loja_id", lojaId)
      .eq("venda_external_id", externalId),
  ]);

  if (itensRes.error) {
    console.error("[vendas/id] erro itens:", itensRes.error);
    return NextResponse.json({ error: itensRes.error.message }, { status: 500 });
  }
  if (pagamentosRes.error) {
    console.error("[vendas/id] erro pagamentos:", pagamentosRes.error);
    return NextResponse.json({ error: pagamentosRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    itens: itensRes.data ?? [],
    pagamentos: pagamentosRes.data ?? [],
  });
}
