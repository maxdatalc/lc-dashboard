// API route para sincronização de um mês específico de vendas
// Usado pelo fluxo de sincronização inicial (loop mês a mês)

import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { syncMesVendas } from "@/lib/sync/historico";

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticação
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const lojaId = await getSelectedLojaId();
    if (!lojaId) {
      return NextResponse.json({ error: "Selecione uma loja" }, { status: 400 });
    }

    const { ano, mes } = (await req.json()) as { ano: number; mes: number };
    if (!ano || !mes) {
      return NextResponse.json({ error: "Informe ano e mes" }, { status: 400 });
    }

    const resultado = await syncMesVendas(lojaId, ano, mes);

    return NextResponse.json({
      success: true,
      vendas: resultado.vendas,
      mes,
      ano,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
