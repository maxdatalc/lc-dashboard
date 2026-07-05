// Camada de dados para o overlay administrativo de módulos (module_settings
// e tabelas relacionadas de kill-switch/auditoria).

import { createAdminClient } from "@/lib/supabase/server";

export type ModuleSettings = {
  featureKey: string;
  killSwitchEnabled: boolean;
  accentColor: string | null;
  labelOverride: string | null;
  descricaoOverride: string | null;
  pricingModel: "incluso_free" | "incluso_premium" | "avulso";
  precoAvulso: number | null;
  updatedAt: string;
  updatedBy: string | null;
};

type ModuleSettingsRow = {
  feature_key: string;
  kill_switch_enabled: boolean;
  accent_color: string | null;
  label_override: string | null;
  descricao_override: string | null;
  pricing_model: string;
  preco_avulso: number | null;
  updated_at: string;
  updated_by: string | null;
};

function mapRow(row: ModuleSettingsRow): ModuleSettings {
  return {
    featureKey: row.feature_key,
    killSwitchEnabled: row.kill_switch_enabled,
    accentColor: row.accent_color,
    labelOverride: row.label_override,
    descricaoOverride: row.descricao_override,
    pricingModel: row.pricing_model as ModuleSettings["pricingModel"],
    precoAvulso: row.preco_avulso,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

/** Keys de módulos com kill-switch ligado agora. */
export async function getKilledFeatureKeys(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("module_settings")
    .select("feature_key")
    .eq("kill_switch_enabled", true);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { feature_key: string }[]).map((r) => r.feature_key);
}

/** Configuração de overlay de um módulo específico, ou null se nunca foi configurado. */
export async function getModuleSettings(featureKey: string): Promise<ModuleSettings | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("module_settings")
    .select(
      "feature_key, kill_switch_enabled, accent_color, label_override, descricao_override, pricing_model, preco_avulso, updated_at, updated_by"
    )
    .eq("feature_key", featureKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data as ModuleSettingsRow) : null;
}

/** Todas as configurações de overlay existentes, indexadas por feature_key. */
export async function getAllModuleSettings(): Promise<Record<string, ModuleSettings>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("module_settings")
    .select(
      "feature_key, kill_switch_enabled, accent_color, label_override, descricao_override, pricing_model, preco_avulso, updated_at, updated_by"
    );
  if (error) throw new Error(error.message);
  const result: Record<string, ModuleSettings> = {};
  for (const row of (data ?? []) as ModuleSettingsRow[]) {
    result[row.feature_key] = mapRow(row);
  }
  return result;
}

/** Quantas empresas têm essa feature ativa hoje em tenant_features (para o modal de confirmação do kill-switch). */
export async function countTenantsWithFeature(featureKey: string): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("tenant_features")
    .select("tenant_id", { count: "exact", head: true })
    .eq("feature_key", featureKey);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Liga/desliga o kill-switch de um módulo. Ao ligar, grava snapshot das
 * empresas afetadas em kill_switch_revocations (log/auditoria — a fonte de
 * verdade do restore continua sendo tenant_features, nunca apagada aqui).
 * Sempre registra o evento em module_audit_log.
 */
export async function setKillSwitch(
  featureKey: string,
  enabled: boolean,
  actorId: string
): Promise<{ affectedTenantIds: string[] }> {
  const supabase = createAdminClient();
  let affectedTenantIds: string[] = [];

  if (enabled) {
    const { data: tenantsWithFeature, error: tErr } = await supabase
      .from("tenant_features")
      .select("tenant_id")
      .eq("feature_key", featureKey);
    if (tErr) throw new Error(tErr.message);
    affectedTenantIds = ((tenantsWithFeature ?? []) as { tenant_id: string }[]).map(
      (r) => r.tenant_id
    );

    if (affectedTenantIds.length > 0) {
      const { error: revError } = await supabase.from("kill_switch_revocations").insert(
        affectedTenantIds.map((tenantId) => ({ feature_key: featureKey, tenant_id: tenantId }))
      );
      if (revError) throw new Error(revError.message);
    }
  }

  const { error: upsertError } = await supabase.from("module_settings").upsert(
    {
      feature_key: featureKey,
      kill_switch_enabled: enabled,
      updated_at: new Date().toISOString(),
      updated_by: actorId,
    },
    { onConflict: "feature_key" }
  );
  if (upsertError) throw new Error(`Erro ao atualizar kill-switch: ${upsertError.message}`);

  const { error: auditError } = await supabase.from("module_audit_log").insert({
    feature_key: featureKey,
    event_type: enabled ? "kill_switch_on" : "kill_switch_off",
    actor_id: actorId,
    detalhes: { affected_tenant_count: affectedTenantIds.length },
  });
  if (auditError) throw new Error(`Erro ao registrar auditoria: ${auditError.message}`);

  return { affectedTenantIds };
}

/**
 * Substitui o conjunto de empresas com acesso a uma feature específica,
 * sem tocar nas outras features de cada tenant (diferente de
 * updateTenantFeatures, que substitui TODAS as features de UM tenant).
 */
export async function setTenantsForFeature(
  featureKey: string,
  tenantIds: string[],
  actorId: string
): Promise<void> {
  const supabase = createAdminClient();

  const { data: current, error: curErr } = await supabase
    .from("tenant_features")
    .select("tenant_id")
    .eq("feature_key", featureKey);
  if (curErr) throw new Error(curErr.message);

  const currentIds = new Set(
    ((current ?? []) as { tenant_id: string }[]).map((r) => r.tenant_id)
  );
  const nextIds = new Set(tenantIds);

  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));
  const toAdd = [...nextIds].filter((id) => !currentIds.has(id));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("tenant_features")
      .delete()
      .eq("feature_key", featureKey)
      .in("tenant_id", toRemove);
    if (error) throw new Error(error.message);
  }

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("tenant_features")
      .insert(toAdd.map((tenantId) => ({ tenant_id: tenantId, feature_key: featureKey })));
    if (error) throw new Error(error.message);
  }

  const { error: auditError } = await supabase.from("module_audit_log").insert({
    feature_key: featureKey,
    event_type: "acesso_empresa_alterado",
    actor_id: actorId,
    detalhes: { added: toAdd, removed: toRemove },
  });
  if (auditError) throw new Error(`Erro ao registrar auditoria: ${auditError.message}`);
}

export type ModuleAppearanceInput = {
  accentColor: string | null;
  pricingModel: "incluso_free" | "incluso_premium" | "avulso";
  precoAvulso: number | null;
};

/** Atualiza cor de destaque e modelo comercial de um módulo (upsert parcial). */
export async function updateModuleAppearance(
  featureKey: string,
  input: ModuleAppearanceInput,
  actorId: string
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("module_settings").upsert(
    {
      feature_key: featureKey,
      accent_color: input.accentColor,
      pricing_model: input.pricingModel,
      preco_avulso: input.precoAvulso,
      updated_at: new Date().toISOString(),
      updated_by: actorId,
    },
    { onConflict: "feature_key" }
  );
  if (error) throw new Error(`Erro ao atualizar aparência do módulo: ${error.message}`);

  const { error: auditError } = await supabase.from("module_audit_log").insert({
    feature_key: featureKey,
    event_type: "cor_alterada",
    actor_id: actorId,
    detalhes: {
      accent_color: input.accentColor,
      pricing_model: input.pricingModel,
      preco_avulso: input.precoAvulso,
    },
  });
  if (auditError) throw new Error(`Erro ao registrar auditoria: ${auditError.message}`);
}
