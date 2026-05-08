// Rota de seed para ambiente de desenvolvimento
// Cria tenant, loja e vincula o usuário logado — retorna 404 em produção

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { createTenant, createLoja } from "@/lib/db/tenants";

export async function GET(): Promise<NextResponse> {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(null, { status: 404 });
  }

  try {
    // Verificar se há um usuário autenticado na sessão atual
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Faça login antes de rodar o seed" },
        { status: 401 }
      );
    }

    // Criar tenant de teste
    const tenant = await createTenant({
      name: "Empresa Teste",
      slug: "empresa-teste",
      plan: "free",
    });

    // Criar loja vinculada ao tenant com as credenciais de dev
    const loja = await createLoja({
      tenantId: tenant.id,
      name: "Loja Principal",
      empId: Number(process.env.MAXDATA_DEV_EMP_ID),
      erpBaseUrl: process.env.MAXDATA_DEV_BASE_URL!,
      terminal: process.env.MAXDATA_DEV_TERMINAL!,
    });

    // Vincular o usuário logado ao tenant recém-criado como admin
    const adminClient = createAdminClient();
    const { error: linkError } = await adminClient.from("tenant_users").insert({
      tenant_id: tenant.id,
      user_id: user.id,
      role: "admin",
    });

    if (linkError) throw new Error(linkError.message);

    return NextResponse.json({
      success: true,
      tenantId: tenant.id,
      lojaId: loja.id,
      userId: user.id,
      message: "Dados de teste criados com sucesso",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[seed] Falha:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
