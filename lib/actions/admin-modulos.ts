"use server";

// Server Actions para a tela de Gestão de Módulos (/admin/modulos) do painel admin

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";
import {
  setKillSwitch,
  setTenantsForFeature,
  updateModuleAppearance,
  createChangeRequest,
  updateChangeRequestStatus,
  type ModuleAppearanceInput,
} from "@/lib/db/modules";

async function requireAdminUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const admin = await isSystemAdmin(user.id);
  if (!admin) throw new Error("Acesso negado");
  return user.id;
}

/** Liga/desliga o kill-switch global de um módulo. */
export async function toggleKillSwitch(
  featureKey: string,
  enabled: boolean
): Promise<{ error?: string }> {
  try {
    const actorId = await requireAdminUserId();
    await setKillSwitch(featureKey, enabled, actorId);
    revalidatePath(`/admin/modulos/${featureKey}`);
    revalidatePath("/admin/modulos");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao alterar kill-switch" };
  }
}

/** Substitui quais empresas têm acesso a um módulo (aba Acesso). */
export async function salvarAcessoModulo(featureKey: string, formData: FormData): Promise<void> {
  const actorId = await requireAdminUserId();
  const tenantIds = [...new Set(formData.getAll("tenant").map(String))];
  await setTenantsForFeature(featureKey, tenantIds, actorId);
  revalidatePath(`/admin/modulos/${featureKey}`);
}

/** Salva cor de destaque e modelo comercial de um módulo (aba Aparência/Comercial). */
export async function salvarAparenciaModulo(featureKey: string, formData: FormData): Promise<void> {
  const actorId = await requireAdminUserId();
  const precoAvulsoRaw = formData.get("preco_avulso");
  const input: ModuleAppearanceInput = {
    accentColor: String(formData.get("accent_color") || "") || null,
    pricingModel: String(
      formData.get("pricing_model") || "incluso_free"
    ) as ModuleAppearanceInput["pricingModel"],
    precoAvulso: precoAvulsoRaw ? Number(precoAvulsoRaw) : null,
  };
  await updateModuleAppearance(featureKey, input, actorId);
  revalidatePath(`/admin/modulos/${featureKey}`);
}

/** Cria uma nova solicitação de alteração para um módulo (aba Solicitações). */
export async function criarSolicitacao(featureKey: string, formData: FormData): Promise<void> {
  const actorId = await requireAdminUserId();
  const titulo = String(formData.get("titulo") || "").trim();
  if (!titulo) throw new Error("Título é obrigatório");
  const descricao = String(formData.get("descricao") || "").trim() || null;
  const tenantId = String(formData.get("tenant_id") || "").trim() || null;
  await createChangeRequest(featureKey, { titulo, descricao, tenantId }, actorId);
  revalidatePath(`/admin/modulos/${featureKey}`);
}

/** Atualiza o status de uma solicitação de alteração (aba Solicitações). */
export async function atualizarStatusSolicitacao(
  requestId: string,
  status: "aberto" | "em_andamento" | "concluido",
  featureKey: string
): Promise<void> {
  await requireAdminUserId();
  await updateChangeRequestStatus(requestId, status);
  revalidatePath(`/admin/modulos/${featureKey}`);
}
