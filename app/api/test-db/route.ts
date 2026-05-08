// Rota de teste para verificar banco de dados e criptografia
// Disponível apenas em desenvolvimento — retorna 404 em produção

import { NextResponse } from "next/server";
import {
  createTenant,
  getTenantById,
  createLoja,
  getLojasByTenantId,
  getLojaConfig,
} from "@/lib/db/tenants";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

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

  let tenantId: string | undefined;

  try {
    // Criar tenant de teste sem campos de ERP
    const tenant = await createTenant({
      name: "Tenant Teste",
      slug: `tenant-teste-${Date.now()}`,
      plan: "free",
    });
    tenantId = tenant.id;

    // Verificar que o tenant foi persistido
    await getTenantById(tenant.id);

    // Criar loja vinculada ao tenant com dados de dev
    const loja = await createLoja({
      tenantId: tenant.id,
      name: "Loja Teste",
      empId: Number(empIdRaw),
      erpBaseUrl: baseUrl,
      terminal,
    });

    // Verificar que a loja aparece na listagem do tenant
    const lojas = await getLojasByTenantId(tenant.id);
    if (!lojas.some((l) => l.id === loja.id)) {
      throw new Error("Loja criada não encontrada em getLojasByTenantId");
    }

    // Descriptografar o terminal e verificar integridade
    const config = await getLojaConfig(loja.id);
    const terminalMatch = config.terminal === terminal;

    // Limpar dados de teste — lojas são deletadas em cascata pelo banco
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await supabase.from("tenants").delete().eq("id", tenant.id);

    return NextResponse.json({
      success: true,
      tenantId: tenant.id,
      lojaId: loja.id,
      terminalMatch,
      message: "Banco e criptografia funcionando",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[test-db] Falha:", message);

    // Tentar limpar o tenant mesmo em caso de erro parcial
    if (tenantId) {
      const supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await supabase.from("tenants").delete().eq("id", tenantId).throwOnError();
    }

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
