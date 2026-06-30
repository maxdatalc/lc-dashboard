"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none";

function styleFor(variant: Variant) {
  if (variant === "primary") {
    return {
      background: "var(--adm-accent)",
      color: "#04121a",
      border: "1px solid transparent",
    };
  }
  return {
    background: "var(--adm-surface-2)",
    color: "var(--adm-text)",
    border: "1px solid var(--adm-line-strong)",
  };
}

/** Botão de ação. Use `href` para virar link. */
export function AdminButton({
  variant = "primary",
  href,
  children,
  className = "",
  ...rest
}: {
  variant?: Variant;
  href?: string;
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"button">, "ref">) {
  const style = styleFor(variant);

  if (href) {
    return (
      <Link href={href} className={`${base} ${className}`} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button className={`${base} ${className}`} style={style} {...rest}>
      {children}
    </button>
  );
}
