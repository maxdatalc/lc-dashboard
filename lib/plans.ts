// Fonte única de verdade para planos, permissões e limites por empresa

export type Plan     = "free" | "premium"
export type UserRole = "owner" | "admin" | "viewer"

// ── Features disponíveis por plano ────────────────────────────────────────────
export const PLAN_FEATURES: Record<Plan, ReadonlySet<string>> = {
  free: new Set([
    "dashboard_visao_geral",
  ]),
  premium: new Set([
    "dashboard_visao_geral",
    "modulo_financeiro",
    "modulo_produtos",
    "modulo_vendas",
    "modulo_clientes",
    "modulo_os",
    "consolidado_multilojas",
    "cobrador_whatsapp",
    "alertas_inteligentes",
    "relatorios_ia",
    "reativacao_clientes",
    "sugestao_compra",
    "pix_inteligente",
    "bi_avancado",
  ]),
}

// ── Limites operacionais por plano ────────────────────────────────────────────
export const PLAN_LIMITS: Record<Plan, { maxLojas: number }> = {
  free:    { maxLojas: 1 },
  premium: { maxLojas: Infinity },
}

// ── Labels para UI ────────────────────────────────────────────────────────────
export const PLAN_LABELS: Record<Plan, string> = {
  free:    "Gratuito",
  premium: "Premium",
}

export const ROLE_LABELS: Record<UserRole, string> = {
  owner:  "Proprietário",
  admin:  "Administrador",
  viewer: "Visualizador",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Verifica se um plano inclui determinada feature */
export function planHasFeature(plan: Plan, featureKey: string): boolean {
  return (PLAN_FEATURES[plan] as Set<string>).has(featureKey)
}

/** Verifica se um role pode realizar ações de escrita/configuração */
export function roleCanEdit(role: UserRole): boolean {
  return role === "owner" || role === "admin"
}

/** Verifica se um role pode gerenciar usuários */
export function roleCanManageUsers(role: UserRole): boolean {
  return role === "owner"
}
