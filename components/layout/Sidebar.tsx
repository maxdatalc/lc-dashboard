"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Settings2,
  Landmark,
  Users,
  LogOut,
  Wrench,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import type { Loja } from "@/lib/contexts/loja-context";

interface Props {
  isAdmin: boolean;
  lojas: Loja[];
  selectedLojaId: string | null;
}

const ACTIVE_STYLE = {
  backgroundColor: "rgba(0, 212, 255, 0.12)",
  color: "var(--accent-cyan)",
} as const;

const INACTIVE_STYLE = {
  backgroundColor: "transparent",
  color: "var(--text-secondary)",
} as const;

// Itens de navegação principais
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/financeiro", label: "Financeiro", icon: Landmark, exact: false },
  { href: "/dashboard/clientes", label: "Clientes", icon: Users, exact: false },
  { href: "/batauto", label: "Batauto", icon: Wrench, exact: false },
];

export function Sidebar({ isAdmin }: Props) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const allItems = [
    ...NAV_ITEMS,
    ...(isAdmin
      ? [{ href: "/admin", label: "Admin", icon: Settings2, exact: false }]
      : []),
  ];

  // Bottom nav mobile usa os mesmos itens
  const BOTTOM_NAV = allItems;

  const isBottomActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* ── Desktop: sidebar expansível ao hover ────────────────────── */}
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className="hidden md:flex fixed top-0 left-0 h-screen flex-col z-40"
        style={{
          width: expanded ? "200px" : "56px",
          backgroundColor: "var(--sidebar-bg, var(--bg-card))",
          borderRight: "1px solid var(--border-subtle)",
          transition: "width 0.25s ease",
          overflow: "hidden",
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center flex-shrink-0 overflow-hidden"
          style={{
            height: "var(--header-height, 56px)",
            borderBottom: "1px solid var(--border-subtle)",
            padding: "0 12px",
            gap: "10px",
          }}
        >
          {/* Quadrado LC */}
          <div
            className="flex-shrink-0 rounded-lg flex items-center justify-center font-bold select-none"
            style={{
              width: 32,
              height: 32,
              backgroundColor: "var(--accent-cyan)",
              color: "#0d1117",
              fontSize: "13px",
            }}
          >
            LC
          </div>

          {/* Texto "Gestor" — desliza ao expandir */}
          <span
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "var(--text-primary)",
              whiteSpace: "nowrap",
              opacity: expanded ? 1 : 0,
              transform: expanded ? "translateX(0)" : "translateX(-8px)",
              transition: "opacity 0.2s ease 0.05s, transform 0.2s ease 0.05s",
              letterSpacing: "-0.3px",
            }}
          >
            Gestor
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col py-2 overflow-hidden">
          {allItems.map(({ href, label, icon: Icon, exact }, i) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center transition-colors"
                style={{
                  height: "44px",
                  padding: "0 14px",
                  gap: "12px",
                  borderLeft: active
                    ? "3px solid var(--accent-cyan)"
                    : "3px solid transparent",
                  ...(active ? ACTIVE_STYLE : INACTIVE_STYLE),
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }
                }}
              >
                {/* Ícone — sempre visível */}
                <Icon className="flex-shrink-0" style={{ width: 18, height: 18 }} />

                {/* Label — desliza ao expandir com stagger por índice */}
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: active ? 600 : 400,
                    whiteSpace: "nowrap",
                    opacity: expanded ? 1 : 0,
                    transform: expanded ? "translateX(0)" : "translateX(-6px)",
                    transition: `opacity 0.2s ease ${0.05 + i * 0.02}s, transform 0.2s ease ${0.05 + i * 0.02}s`,
                    overflow: "hidden",
                  }}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Rodapé: logout */}
        <div
          className="flex flex-col py-3"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center transition-colors"
              style={{
                height: "40px",
                padding: "0 14px",
                gap: "12px",
                color: "var(--text-muted)",
                borderLeft: "3px solid transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#ef4444";
                e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <LogOut className="flex-shrink-0" style={{ width: 16, height: 16 }} />
              <span
                style={{
                  fontSize: "13px",
                  whiteSpace: "nowrap",
                  opacity: expanded ? 1 : 0,
                  transform: expanded ? "translateX(0)" : "translateX(-6px)",
                  transition: "opacity 0.2s ease 0.1s, transform 0.2s ease 0.1s",
                }}
              >
                Sair da conta
              </span>
            </button>
          </form>
        </div>
      </aside>

      {/* ── Mobile: bottom navigation (inalterado) ──────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2"
        style={{
          background: "var(--bg-card)",
          borderTop: "1px solid var(--border-subtle)",
          paddingTop: "8px",
          paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
          minHeight: "64px",
        }}
      >
        {BOTTOM_NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = isBottomActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors"
              style={{ color: active ? "var(--accent-cyan)" : "var(--text-muted)" }}
            >
              <Icon size={20} />
              <span style={{ fontSize: "10px", fontWeight: active ? 600 : 400 }}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
