"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function AdminNavLink({
  href,
  children,
  exact = false,
}: {
  href: string;
  children: ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className="group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200"
      style={{
        color: isActive ? "var(--adm-text)" : "var(--adm-text-dim)",
        fontWeight: isActive ? 600 : 500,
        background: isActive ? "var(--adm-accent-soft)" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = "var(--adm-surface-2)";
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        aria-hidden
        className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full transition-all duration-200"
        style={{
          width: 3,
          height: isActive ? 18 : 0,
          background: "var(--adm-accent)",
          boxShadow: isActive ? "0 0 10px var(--adm-accent)" : "none",
        }}
      />
      {children}
    </Link>
  );
}
