// Rota de desenvolvimento para sincronizar todos os produtos de uma loja
// Disponível apenas em desenvolvimento — retorna 404 em produção

import { NextResponse } from "next/server";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { syncTodosProdutos } from "@/lib/sync/produtos";

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
    console.log(`[sync-produtos] Iniciando sync para loja ${lojaId}...`);

    const resultado = await syncTodosProdutos(lojaId);

    console.log(`[sync-produtos] Concluído — total=${resultado.total}`);

    return NextResponse.json({
      success: true,
      lojaId,
      totalProdutos: resultado.total,
      tempoMs: Date.now() - inicio,
      message: resultado.erro
        ? `Concluído com erro: ${resultado.erro}`
        : "Produtos sincronizados com sucesso",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[sync-produtos] Falha:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
