// Rota de teste para verificar a conexão com o ERP MaxManager
// Disponível apenas em desenvolvimento — retorna 404 em produção

import { NextResponse } from "next/server";
import { getMaxDataToken } from "@/lib/maxdata/client";
import type { MaxDataConfig } from "@/types";

export async function GET(): Promise<NextResponse> {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(null, { status: 404 });
  }

  const baseUrl = process.env.MAXDATA_DEV_BASE_URL;
  const empIdRaw = process.env.MAXDATA_DEV_EMP_ID;
  const terminal = process.env.MAXDATA_DEV_TERMINAL;

  if (!baseUrl || !empIdRaw || !terminal) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Variáveis de ambiente ausentes: MAXDATA_DEV_BASE_URL, MAXDATA_DEV_EMP_ID e MAXDATA_DEV_TERMINAL são obrigatórias",
      },
      { status: 400 }
    );
  }

  const config: MaxDataConfig = {
    baseUrl,
    empId: Number(empIdRaw),
    terminal,
  };

  try {
    const token = await getMaxDataToken(config);

    return NextResponse.json({
      success: true,
      message: "Conexão com MaxData estabelecida",
      tokenPreview: `${token.slice(0, 20)}...`,
      cachedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[test-maxdata] Falha:", message);

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
