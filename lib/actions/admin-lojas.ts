"use server";

// Server Actions para operações de lojas e usuários do painel admin

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin, salvarConfigUsuario } from "@/lib/db/admin";

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
    papel: "owner" | "admin" | "viewer";
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

    revalidatePath(`/admin/empresas/${tenantId}`, "page");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao adicionar usuário" };
  }
}

/**
 * Cria ou atualiza usuário com mapeamento ERP e configurações de acesso.
 * Fluxo: cria/atualiza auth user → tenant_users → loja_usuarios_erp → user_tenant_settings
 */
export async function salvarUsuarioERP(
  tenantId: string,
  dados: {
    email: string;
    senha: string;         // obrigatório para novos; vazio = não alterar senha
    nomeCompleto: string;
    papel: "owner" | "admin" | "viewer";
    // ERP mapping
    cliId: number | null;
    cliNome: string;
    // Acesso
    lojaIds: string[];
    modulos: Record<string, boolean>;
    tiposBloqueados: number[];
  }
): Promise<{ error?: string; userId?: string }> {
  try {
    await verificarAdmin();
    const supabase = createAdminClient();

    // 1. Criar ou buscar usuário no Auth
    let userId: string;
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", (await supabase.auth.admin.listUsers()).data.users.find((u) => u.email === dados.email)?.id ?? "")
      .maybeSingle()
      .then(async () => {
        // Busca mais eficiente via listUsers com filtro de email
        const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const found = listData?.users?.find((u) => u.email === dados.email);
        return { data: found ? { id: found.id } : null };
      });

    if (existing?.id) {
      userId = existing.id;
      // Atualiza nome e senha se fornecida
      const updatePayload: Record<string, unknown> = { user_metadata: { full_name: dados.nomeCompleto } };
      if (dados.senha) updatePayload.password = dados.senha;
      await supabase.auth.admin.updateUserById(userId, updatePayload);
    } else {
      if (!dados.senha) throw new Error("Senha obrigatória para novo usuário");
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: dados.email,
        password: dados.senha,
        user_metadata: { full_name: dados.nomeCompleto },
        email_confirm: true,
      });
      if (authErr || !authData.user) throw new Error(authErr?.message ?? "Falha ao criar usuário");
      userId = authData.user.id;
    }

    // 2. Vincular ao tenant (upsert)
    await supabase.from("tenant_users").upsert(
      { tenant_id: tenantId, user_id: userId, role: dados.papel },
      { onConflict: "tenant_id,user_id" }
    );

    // 3. ERP mapping: cria entrada em loja_usuarios_erp para todas as lojas selecionadas
    if (dados.cliId != null && dados.lojaIds.length > 0) {
      await supabase.from("loja_usuarios_erp").upsert(
        dados.lojaIds.map((lId) => ({
          loja_id: lId,
          cli_id: dados.cliId!,
          cli_nome: dados.cliNome,
          supabase_user_id: userId,
          email: dados.email,
          tipos_bloqueados: dados.tiposBloqueados,
        })),
        { onConflict: "loja_id,cli_id" }
      );
    }

    // 4. Configurações de acesso (módulos + lojas)
    await salvarConfigUsuario(tenantId, userId, { lojaIds: dados.lojaIds, modulos: dados.modulos });

    revalidatePath(`/admin/empresas/${tenantId}`, "page");
    return { userId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao salvar usuário" };
  }
}

/** Salva configurações de módulos e lojas de um usuário já existente */
export async function salvarAcessoUsuario(
  tenantId: string,
  userId: string,
  config: {
    lojaIds: string[];
    modulos: Record<string, boolean>;
    // ERP: atualiza tipos_bloqueados para todas as lojas do usuário
    tiposBloqueadosPorLoja?: Record<string, number[]>;
  }
): Promise<{ error?: string }> {
  try {
    await verificarAdmin();
    const supabase = createAdminClient();

    await salvarConfigUsuario(tenantId, userId, { lojaIds: config.lojaIds, modulos: config.modulos });

    if (config.tiposBloqueadosPorLoja) {
      for (const [lojaId, tipos] of Object.entries(config.tiposBloqueadosPorLoja)) {
        await supabase
          .from("loja_usuarios_erp")
          .update({ tipos_bloqueados: tipos })
          .eq("loja_id", lojaId)
          .eq("supabase_user_id", userId);
      }
    }

    revalidatePath(`/admin/empresas/${tenantId}`, "page");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao salvar acesso" };
  }
}
