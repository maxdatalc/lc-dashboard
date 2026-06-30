import type { ReactNode } from "react";

interface Props {
  /** Eyebrow curto acima do título (ex.: "Operação"). Opcional. */
  eyebrow?: string;
  title: string;
  /** Linha de estatística/resumo abaixo do título. */
  subtitle?: ReactNode;
  /** Ações à direita (botões, links). */
  actions?: ReactNode;
}

/**
 * Cabeçalho de página padrão do painel admin. Mesmo ritmo em todas as telas:
 * eyebrow + título + linha de resumo à esquerda, ações à direita.
 */
export function AdminPageHeader({ eyebrow, title, subtitle, actions }: Props) {
  return (
    <div className="adm-rise flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p
            className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--adm-accent)" }}
          >
            {eyebrow}
          </p>
        )}
        <h1
          className="text-2xl font-bold leading-tight tracking-tight"
          style={{ color: "var(--adm-text)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm" style={{ color: "var(--adm-text-dim)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}
