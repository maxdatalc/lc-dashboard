import type { ReactNode } from "react";

type Variant = "neutral" | "success" | "warning" | "danger" | "accent" | "premium";

const VARIANT_STYLE: Record<Variant, { bg: string; color: string }> = {
  neutral: { bg: "var(--adm-surface-3)", color: "var(--adm-text-dim)" },
  success: { bg: "var(--adm-signal-soft)", color: "var(--adm-signal)" },
  warning: { bg: "var(--adm-warn-soft)", color: "var(--adm-warn)" },
  danger: { bg: "var(--adm-alert-soft)", color: "var(--adm-alert)" },
  accent: { bg: "var(--adm-accent-soft)", color: "var(--adm-accent)" },
  premium: { bg: "var(--adm-warn-soft)", color: "var(--adm-warn)" },
};

/** Badge de status/plano padrão do admin — substitui pills soltas por página. */
export function AdminBadge({
  children,
  variant = "neutral",
  dot = false,
}: {
  children: ReactNode;
  variant?: Variant;
  dot?: boolean;
}) {
  const s = VARIANT_STYLE[variant];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none"
      style={{ background: s.bg, color: s.color }}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: "currentColor" }}
        />
      )}
      {children}
    </span>
  );
}

/** Indicador ativo/inativo — ponto colorido + label, para linhas de tabela densas. */
export function AdminStatusDot({
  active,
  labelActive = "Ativa",
  labelInactive = "Inativa",
}: {
  active: boolean;
  labelActive?: string;
  labelInactive?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium"
      style={{ color: active ? "var(--adm-signal)" : "var(--adm-text-faint)" }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: "currentColor" }}
      />
      {active ? labelActive : labelInactive}
    </span>
  );
}
