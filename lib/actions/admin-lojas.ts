"use server";

// Server Actions para operações de lojas e usuários do painel admin

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";

async function verificarAdmin(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const admin = await isSystemAdmin(user.id);
  if (!admin) throw new Error("Acesso negado");
}

/** Ativa ou desativa uma loja */
export async function toggleLojaAtiva(lojaId: string, ativo: boolean): Promise<void> {
  await verificarAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("lojas")
    .update({ is_active: ativo })
    .eq("id", lojaId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/clientes", "layout");
}

/** Cria usuário no Supabase Auth e vincula ao tenant */
export async function adicionarUsuarioTenant(
  tenantId: string,
  dados: {
    email: string;
    senha: string;
    nomeCompleto: string;
    papel: "admin" | "viewer";
  }
): Promise<{ error?: string }> {
  try {
    await verificarAdmin();
    const supabase = createAdminClient();

    // Criar usuário no Auth com confirmação automática
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: dados.email,
      password: dados.senha,
      user_metadata: { full_name: dados.nomeCompleto },
      email_confirm: true,
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message ?? "Falha ao criar usuário no Auth");
    }

    // Vincular ao tenant
    const { error: linkError } = await supabase.from("tenant_users").insert({
      tenant_id: tenantId,
      user_id: authData.user.id,
      role: dados.papel,
    });

    if (linkError) {
      // Reverter criação do Auth se o link falhar
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw new Error(linkError.message);
    }

    revalidatePath(`/admin/clientes/${tenantId}`, "page");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao adicionar usuário" };
  }
}
