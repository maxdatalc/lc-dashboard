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
    // Merge existing metadata to preserve fields like full_name
    const { data: authData } = await adminClient.auth.admin.getUserById(userId);
    const existingMeta = authData?.user?.user_metadata ?? {};
    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: novaSenha,
      user_metadata: { ...existingMeta, must_change_password: true },
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

export async function criarUsuario(data: {
  email: string;
  senha: string;
  nome: string;
}): Promise<{ error?: string; userId?: string }> {
  try {
    await verificarAdmin();
    if (!data.email || !data.email.includes("@")) {
      return { error: "E-mail inválido" };
    }
    if (data.senha.length < 6) {
      return { error: "Senha deve ter no mínimo 6 caracteres" };
    }
    const adminClient = createAdminClient();
    const { data: created, error } = await adminClient.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: {
        must_change_password: true,
        full_name: data.nome || "",
      },
    });
    if (error) return { error: error.message };

    if (data.nome) {
      await adminClient.from("profiles").upsert({
        id: created.user.id,
        full_name: data.nome,
        is_system_admin: false,
      });
    }

    revalidatePath("/admin/usuarios");
    return { userId: created.user.id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Erro ao criar usuário",
    };
  }
}

export async function vincularEmpresaUsuario(
  userId: string,
  tenantId: string,
  role: "owner" | "admin" | "viewer"
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

export async function excluirUsuario(
  userId: string
): Promise<{ error?: string }> {
  try {
    await verificarAdmin();
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verificar que não está excluindo a si mesmo
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (currentUser?.id === userId) {
      return { error: "Você não pode excluir sua própria conta" };
    }

    // Verificar que não é system admin
    const { data: profile } = await adminClient
      .from("profiles")
      .select("is_system_admin")
      .eq("id", userId)
      .maybeSingle();

    if (
      (profile as { is_system_admin?: boolean } | null)?.is_system_admin
    ) {
      return { error: "Não é possível excluir um System Admin" };
    }

    // Remover vínculos com tenants
    await adminClient.from("tenant_users").delete().eq("user_id", userId);

    // Remover profile
    await adminClient.from("profiles").delete().eq("id", userId);

    // Excluir do Supabase Auth — deve ser o último passo
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) return { error: error.message };

    revalidatePath("/admin/usuarios");
    return {};
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Erro ao excluir usuário",
    };
  }
}

export async function alterarRoleUsuario(
  userId: string,
  tenantId: string,
  novaRole: "owner" | "admin" | "viewer"
): Promise<{ error?: string }> {
  try {
    await verificarAdmin();
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("tenant_users")
      .update({ role: novaRole })
      .eq("user_id", userId)
      .eq("tenant_id", tenantId);

    if (error) return { error: error.message };
    revalidatePath(`/admin/usuarios/${userId}`);
    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Erro ao alterar permissão",
    };
  }
}
