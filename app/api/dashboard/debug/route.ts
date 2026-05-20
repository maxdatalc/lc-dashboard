// Rota temporária para diagnóstico — REMOVER após validar os dados
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const lojaId = searchParams.get("lojaId");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!lojaId) {
    return NextResponse.json({ error: "lojaId obrigatório" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Amostras de cada tabela relevante
  const [vendasRes, itensRes, pagamentosRes, statusRes] = await Promise.allSettled([
    adminClient
      .from("vendas")
      .select("id, external_id, status, data_venda, valor_total, cliente_nome")
      .eq("loja_id", lojaId)
      .order("data_venda", { ascending: false })
      .limit(5),
    adminClient
      .from("venda_itens")
      .select("id, venda_external_id, produto_nome, quantidade, valor_total, loja_id")
      .eq("loja_id", lojaId)
      .limit(5),
    adminClient
      .from("venda_pagamentos")
      .select("id, venda_external_id, forma_pagamento, valor, parcelas")
      .limit(5),
    // Contagem de status únicos nas vendas da loja
    adminClient
      .from("vendas")
      .select("status")
      .eq("loja_id", lojaId)
      .limit(200),
  ]);

  // Resumo de status únicos
  let statusCount: Record<string, number> = {};
  if (statusRes.status === "fulfilled" && statusRes.value.data) {
    for (const row of statusRes.value.data) {
      const s = String(row.status ?? "null");
      statusCount[s] = (statusCount[s] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    lojaId,
    vendas: {
      data: vendasRes.status === "fulfilled" ? vendasRes.value.data : null,
      error: vendasRes.status === "fulfilled" ? vendasRes.value.error : "promise rejected",
    },
    venda_itens: {
      data: itensRes.status === "fulfilled" ? itensRes.value.data : null,
      error: itensRes.status === "fulfilled" ? itensRes.value.error : "promise rejected",
    },
    venda_pagamentos: {
      data: pagamentosRes.status === "fulfilled" ? pagamentosRes.value.data : null,
      error: pagamentosRes.status === "fulfilled" ? pagamentosRes.value.error : "promise rejected",
    },
    status_breakdown: statusCount,
  });
}
