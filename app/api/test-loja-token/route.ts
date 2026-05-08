// Rota de teste para verificar obtenção de token MaxData pela loja selecionada
// Disponível apenas em desenvolvimento — retorna 404 em produção

import { NextResponse } from "next/server";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { getTokenForLoja } from "@/lib/maxdata/resolve";

export async function GET(): Promise<NextResponse> {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(null, { status: 404 });
  }

  const lojaId = await getSelectedLojaId();

  if (!lojaId) {
    return NextResponse.json(
      { error: "Selecione uma loja no dashboard primeiro" },
      { status: 400 }
    );
  }

  try {
    const token = await getTokenForLoja(lojaId);

    return NextResponse.json({
      success: true,
      lojaId,
      tokenPreview: `${token.slice(0, 20)}...`,
      message: "Token obtido para a loja",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[test-loja-token] Falha:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
