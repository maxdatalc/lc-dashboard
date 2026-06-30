"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { ArrowLeft, Moon, Sun } from "lucide-react";

interface Props {
  userName: string;
  userEmail: string;
}

export function AdminSidebarFooter({ userName, userEmail }: Props) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const initial = (userName || userEmail || "?").trim().charAt(0).toUpperCase();
  const isDark = theme !== "light";

  return (
    <div
      className="px-3 py-3 space-y-1"
      style={{ borderTop: "1px solid var(--adm-line)" }}
    >
      {/* Identidade */}
      <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
          style={{
            background: "var(--adm-accent-soft)",
            color: "var(--adm-accent)",
            border: "1px solid var(--adm-line-strong)",
          }}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-medium leading-tight"
            style={{ color: "var(--adm-text)" }}
          >
            {userName || "Operador"}
          </p>
          <p
            className="truncate text-xs leading-tight"
            style={{ color: "var(--adm-text-faint)" }}
          >
            {userEmail}
          </p>
        </div>
      </div>

      {/* Toggle de tema */}
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
        style={{ color: "var(--adm-text-dim)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--adm-surface-2)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        aria-label="Alternar tema"
      >
        {mounted && isDark ? (
          <Sun className="h-4 w-4 shrink-0" />
        ) : (
          <Moon className="h-4 w-4 shrink-0" />
        )}
        <span>{mounted ? (isDark ? "Tema claro" : "Tema escuro") : "Tema"}</span>
      </button>

      {/* Voltar */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
        style={{ color: "var(--adm-text-dim)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--adm-surface-2)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <ArrowLeft className="h-4 w-4 shrink-0" />
        Voltar ao Dashboard
      </Link>
    </div>
  );
}
