// Rota de teste para verificar banco de dados e criptografia
// Disponível apenas em desenvolvimento — retorna 404 em produção

import { NextResponse } from "next/server";
import { createTenant, getTenantById, getTenantConfig } from "@/lib/db/tenants";

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
          "Variáveis ausentes: MAXDATA_DEV_BASE_URL, MAXDATA_DEV_EMP_ID e MAXDATA_DEV_TERMINAL são obrigatórias",
      },
      { status: 400 }
    );
  }

  try {
    // Criar tenant de teste com slug único para evitar conflito de unicidade
    const tenant = await createTenant({
      name: "Loja Teste",
      slug: `loja-teste-${Date.now()}`,
      erpBaseUrl: baseUrl,
      empId: Number(empIdRaw),
      terminal,
      plan: "free",
    });

    // Verificar que o tenant foi persistido corretamente
    await getTenantById(tenant.id);

    // Descriptografar o terminal e verificar integridade
    const config = await getTenantConfig(tenant.id);
    const terminalMatch = config.terminal === terminal;

    return NextResponse.json({
      success: true,
      tenantId: tenant.id,
      terminalMatch,
      message: "Banco e criptografia funcionando",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[test-db] Falha:", message);

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
