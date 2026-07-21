"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "subtle" | "danger" | "ghost";
type Size = "md" | "sm";

const SIZE_CLASS: Record<Size, string> = {
  md: "px-4 py-2 text-sm gap-2",
  sm: "px-3 py-1.5 text-xs gap-1.5",
};

const base =
  "adm-focusable inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none";

function styleFor(variant: Variant) {
  switch (variant) {
    case "primary":
      return { background: "var(--adm-accent)", color: "#04121a", border: "1px solid transparent" };
    case "secondary":
      return { background: "var(--adm-surface-2)", color: "var(--adm-text)", border: "1px solid var(--adm-line-strong)" };
    case "subtle":
      return { background: "transparent", color: "var(--adm-text-dim)", border: "1px solid var(--adm-line-strong)" };
    case "danger":
      return { background: "var(--adm-alert-soft)", color: "var(--adm-alert)", border: "1px solid transparent" };
    case "ghost":
      return { background: "transparent", color: "var(--adm-text-dim)", border: "1px solid transparent" };
  }
}

/** Botão de ação. Use `href` para virar link. */
export function AdminButton({
  variant = "primary",
  size = "md",
  href,
  children,
  className = "",
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  href?: string;
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"button">, "ref">) {
  const style = styleFor(variant);
  const cls = `${base} ${SIZE_CLASS[size]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} style={style} {...rest}>
      {children}
    </button>
  );
}
