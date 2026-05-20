"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LayoutDashboard, Settings2, Landmark, Users, Building2, LogOut } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { logout } from "@/app/actions/auth";
import { selectLoja } from "@/app/actions/lojas";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Loja } from "@/lib/contexts/loja-context";

interface Props {
  isAdmin: boolean;
  lojas: Loja[];
  selectedLojaId: string | null;
}

const SUBMENUS = [
  { href: "/dashboard/financeiro", label: "Financeiro", icon: Landmark },
  { href: "/dashboard/clientes", label: "Clientes", icon: Users },
];

const ACTIVE_STYLE = {
  borderLeft: "3px solid var(--accent-cyan)",
  backgroundColor: "rgba(0, 212, 255, 0.12)",
  color: "var(--accent-cyan)",
} as const;

const INACTIVE_STYLE = {
  borderLeft: "3px solid transparent",
  backgroundColor: "transparent",
  color: "var(--text-secondary)",
} as const;

export function Sidebar({ isAdmin, lojas, selectedLojaId }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [dashboardOpen, setDashboardOpen] = useState(
    pathname.startsWith("/dashboard")
  );
  const [lojaOpen, setLojaOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Se já está no dashboard: toggle do submenu. Caso contrário: navega e expande.
  function handleDashboardClick() {
    if (pathname === "/dashboard") {
      setDashboardOpen((v) => !v);
    } else {
      router.push("/dashboard");
      setDashboardOpen(true);
    }
  }

  const isDashboardActive = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isAdminActive = pathname.startsWith("/admin");
  const selectedLojaName = lojas.find((l) => l.id === selectedLojaId)?.name;

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className="fixed top-0 left-0 h-screen flex flex-col z-40"
        style={{
          width: "var(--sidebar-width)",
          backgroundColor: "var(--bg-card)",
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            height: "var(--header-height)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm select-none"
            style={{ backgroundColor: "var(--accent-cyan)", color: "#0d1117" }}
          >
            LC
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col overflow-hidden py-2">
          {/* Dashboard — navega ou toggle do submenu */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleDashboardClick}
                className="w-full flex items-center justify-center transition-colors"
                style={{
                  height: "48px",
                  ...(isDashboardActive ? ACTIVE_STYLE : INACTIVE_STYLE),
                }}
              >
                <LayoutDashboard className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Dashboard</TooltipContent>
          </Tooltip>

          {/* Submenus animados */}
          <div
            style={{
              overflow: "hidden",
              maxHeight: dashboardOpen ? `${SUBMENUS.length * 36}px` : "0px",
              opacity: dashboardOpen ? 1 : 0,
              transition: "max-height 0.25s ease, opacity 0.2s ease",
            }}
          >
            {SUBMENUS.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Tooltip key={href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={href}
                      className="w-full flex items-center justify-center transition-colors"
                      style={{
                        height: "36px",
                        ...(active ? ACTIVE_STYLE : INACTIVE_STYLE),
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Admin — apenas system admins */}
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/admin"
                  className="w-full flex items-center justify-center transition-colors mt-1"
                  style={{
                    height: "48px",
                    ...(isAdminActive ? ACTIVE_STYLE : INACTIVE_STYLE),
                  }}
                >
                  <Settings2 className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Admin</TooltipContent>
            </Tooltip>
          )}
        </nav>

        {/* Rodapé */}
        <div
          className="flex flex-col items-center gap-1.5 py-3"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          {/* Seletor de loja — popover compacto */}
          {lojas.length > 0 && (
            <div className="relative w-full">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setLojaOpen((v) => !v)}
                    className="w-full flex items-center justify-center transition-colors"
                    style={{
                      height: "36px",
                      color: lojaOpen ? "var(--accent-cyan)" : "var(--text-secondary)",
                    }}
                  >
                    <Building2 className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {selectedLojaName ?? "Selecionar loja"}
                </TooltipContent>
              </Tooltip>

              {/* Dropdown de lojas */}
              {lojaOpen && (
                <div
                  className="absolute bottom-full left-full ml-2 mb-1 rounded-xl shadow-xl z-50 min-w-[160px] py-1"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  {lojas.map((loja) => {
                    const isSel = loja.id === selectedLojaId;
                    return (
                      <button
                        key={loja.id}
                        disabled={isPending}
                        onClick={() => {
                          startTransition(() => { selectLoja(loja.id); });
                          setLojaOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors"
                        style={{
                          color: isSel ? "var(--accent-cyan)" : "var(--text-secondary)",
                          backgroundColor: isSel ? "rgba(0,212,255,0.08)" : "transparent",
                        }}
                      >
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">{loja.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <ThemeToggle />

          <Tooltip>
            <TooltipTrigger asChild>
              <form action={logout}>
                <button
                  type="submit"
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </form>
            </TooltipTrigger>
            <TooltipContent side="right">Sair da conta</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
