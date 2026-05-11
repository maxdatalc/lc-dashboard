// Rota de desenvolvimento para popular o banco com 12 meses de histórico de vendas
// Disponível apenas em desenvolvimento — retorna 404 em produção

import { NextResponse } from "next/server";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { syncMesVendas } from "@/lib/sync/historico";

export async function GET(): Promise<NextResponse> {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(null, { status: 404 });
  }

  const lojaId = await getSelectedLojaId();
  if (!lojaId) {
    return NextResponse.json(
      { success: false, error: "Selecione uma loja no dashboard" },
      { status: 400 }
    );
  }

  // Montar lista dos últimos 13 meses (mês atual + 12 anteriores)
  const meses: { ano: number; mes: number }[] = [];
  const hoje = new Date();
  for (let i = 12; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
  }

  const resultados = [];

  // Sincronizar em sequência para não sobrecarregar a API da loja
  for (const { ano, mes } of meses) {
    const mesStr = `${ano}-${String(mes).padStart(2, "0")}`;
    console.log(`[sync-historico] Iniciando ${mesStr}...`);

    const resultado = await syncMesVendas(lojaId, ano, mes);
    resultados.push(resultado);

    console.log(
      `[sync-historico] ${mesStr} — vendas=${resultado.vendas}${resultado.erro ? ` erro=${resultado.erro}` : ""}`
    );

    // Pausa entre meses para não sobrecarregar a API da loja
    await new Promise((r) => setTimeout(r, 500));
  }

  const totalVendas = resultados.reduce((acc, r) => acc + r.vendas, 0);

  return NextResponse.json({
    success: true,
    lojaId,
    mesesSincronizados: 13,
    resultados,
    totalVendas,
  });
}
