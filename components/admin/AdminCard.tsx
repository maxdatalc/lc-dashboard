import type { CSSProperties, ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Realça a borda no hover (para cards clicáveis). */
  hover?: boolean;
}

/** Painel/superfície padrão do admin: fundo de superfície + hairline + raio. */
export function AdminCard({ children, className = "", style, hover }: Props) {
  return (
    <div
      className={`rounded-xl ${hover ? "transition-all duration-200" : ""} ${className}`}
      style={{
        background: "var(--adm-surface)",
        border: "1px solid var(--adm-line)",
        boxShadow: "var(--adm-shadow-sm)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
