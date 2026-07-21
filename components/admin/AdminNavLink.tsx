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
      className="adm-focusable group relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-colors duration-150"
      style={{
        color: isActive ? "var(--adm-text)" : "var(--adm-text-dim)",
        fontWeight: isActive ? 600 : 450,
        background: isActive ? "var(--adm-surface-2)" : "transparent",
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
        className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full transition-all duration-150"
        style={{
          width: 2,
          height: isActive ? 14 : 0,
          background: "var(--adm-accent)",
        }}
      />
      {children}
    </Link>
  );
}
