// API route para exclusão permanente de um cliente (tenant + usuários)
// Exige autenticação como system admin

import { NextResponse, NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";

export async function DELETE(request: NextRequest) {
  try {
    // 1. Verificar autenticação e privilégio admin
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const admin = await isSystemAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 2. Obter tenantId da query string
    const tenantId = new URL(request.url).searchParams.get("tenantId");
    if (!tenantId) {
      return NextResponse.json({ error: "tenantId obrigatório" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 3. Buscar usuários vinculados ao tenant
    const { data: tenantUsers } = await adminClient
      .from("tenant_users")
      .select("user_id")
      .eq("tenant_id", tenantId);

    // 4. Deletar cada usuário do Supabase Auth
    for (const row of (tenantUsers ?? []) as { user_id: string }[]) {
      await adminClient.auth.admin.deleteUser(row.user_id);
    }

    // 5. Deletar o tenant — cascade remove lojas, features e tenant_users
    const { error } = await adminClient
      .from("tenants")
      .delete()
      .eq("id", tenantId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
