import type { ReactNode } from "react";

/** Estado vazio padrão — usado em tabelas/listas sem registros. */
export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="py-16 text-center">
      <Icon className="mx-auto mb-3 h-9 w-9" style={{ color: "var(--adm-text-faint)" }} />
      <p className="text-sm font-medium" style={{ color: "var(--adm-text-dim)" }}>
        {title}
      </p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-xs" style={{ color: "var(--adm-text-faint)" }}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
