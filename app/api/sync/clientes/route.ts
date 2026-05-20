// API route para sincronização de clientes — funciona em produção
// Usado tanto pelo fluxo de sincronização inicial quanto por re-syncs manuais

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { syncTodosClientes } from "@/lib/sync/clientes";

export async function POST() {
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

    const inicio = Date.now();
    const resultado = await syncTodosClientes(lojaId);

    return NextResponse.json({
      success: true,
      total: resultado.total,
      tempoMs: Date.now() - inicio,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
