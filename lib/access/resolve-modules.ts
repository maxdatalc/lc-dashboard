// lib/access/resolve-modules.ts

export type ResolveEffectiveFeaturesInput = {
  allTenantFeatures: string[];
  isOwnerOrAdmin: boolean;
  groupModulos: Record<string, boolean> | null;
  userModulos: Record<string, boolean> | null;
};

/**
 * Cascata tenant -> grupo -> usuario, cada camada so restringe, nunca
 * concede de volta o que a camada de cima negou. Kill-switch global NAO
 * entra aqui - e aplicado por fora (EmpresaContext.hasFeature, checkPlan),
 * pois precisa valer tambem quando esta funcao retorna undefined
 * (fallback para o plano do tenant).
 */
export function resolveEffectiveFeatures(
  input: ResolveEffectiveFeaturesInput
): string[] | undefined {
  const { allTenantFeatures, isOwnerOrAdmin, groupModulos, userModulos } = input;

  if (allTenantFeatures.length === 0) {
    return undefined;
  }

  if (isOwnerOrAdmin) {
    return allTenantFeatures;
  }

  if (groupModulos && Object.keys(groupModulos).length > 0) {
    const groupFeatures = allTenantFeatures.filter((k) => groupModulos[k] === true);
    if (userModulos && Object.keys(userModulos).length > 0) {
      return groupFeatures.filter((k) => userModulos[k] === true);
    }
    return groupFeatures;
  }

  if (userModulos && Object.keys(userModulos).length > 0) {
    return allTenantFeatures.filter((k) => userModulos[k] === true);
  }

  return allTenantFeatures.filter(
    (k) => k === "dashboard_visao_geral" || k === "modulo_vendas"
  );
}
