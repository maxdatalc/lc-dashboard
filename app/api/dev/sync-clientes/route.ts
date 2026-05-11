// Rota de desenvolvimento para sincronizar todos os clientes de uma loja
// Disponível apenas em desenvolvimento — retorna 404 em produção

import { NextResponse } from "next/server";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { syncTodosClientes } from "@/lib/sync/clientes";

export async function GET(): Promise<NextResponse> {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(null, { status: 404 });
  }

  const lojaId = await getSelectedLojaId();
  if (!lojaId) {
    return NextResponse.json(
      { success: false, error: "Selecione uma loja primeiro" },
      { status: 400 }
    );
  }

  const inicio = Date.now();

  try {
    console.log(`[sync-clientes] Iniciando sync para loja ${lojaId}...`);

    const resultado = await syncTodosClientes(lojaId);

    console.log(`[sync-clientes] Concluído — total=${resultado.total}`);

    return NextResponse.json({
      success: true,
      lojaId,
      totalClientes: resultado.total,
      tempoMs: Date.now() - inicio,
      message: "Clientes sincronizados com sucesso",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[sync-clientes] Falha:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
