"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";

async function verificarAdmin(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const admin = await isSystemAdmin(user.id);
  if (!admin) throw new Error("Acesso negado");
}

export async function resetarSenhaUsuario(
  userId: string,
  novaSenha: string
): Promise<{ error?: string }> {
  try {
    await verificarAdmin();
    if (novaSenha.length < 6) {
      return { error: "Senha deve ter no mínimo 6 caracteres" };
    }
    const adminClient = createAdminClient();
    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: novaSenha,
    });
    if (error) return { error: error.message };
    revalidatePath("/admin/usuarios");
    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Erro ao resetar senha",
    };
  }
}

export async function vincularEmpresaUsuario(
  userId: string,
  tenantId: string,
  role: "admin" | "viewer"
): Promise<{ error?: string }> {
  try {
    await verificarAdmin();
    const adminClient = createAdminClient();

    // Verificar se já existe vínculo
    const { data: existing } = await adminClient
      .from("tenant_users")
      .select("user_id")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (existing) {
      return { error: "Usuário já tem acesso a esta empresa" };
    }

    const { error } = await adminClient.from("tenant_users").insert({
      user_id: userId,
      tenant_id: tenantId,
      role,
    });

    if (error) return { error: error.message };
    revalidatePath("/admin/usuarios");
    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Erro ao vincular empresa",
    };
  }
}

export async function desvincularEmpresaUsuario(
  userId: string,
  tenantId: string
): Promise<{ error?: string }> {
  try {
    await verificarAdmin();
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("tenant_users")
      .delete()
      .eq("user_id", userId)
      .eq("tenant_id", tenantId);

    if (error) return { error: error.message };
    revalidatePath("/admin/usuarios");
    return {};
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Erro ao desvincular empresa",
    };
  }
}
