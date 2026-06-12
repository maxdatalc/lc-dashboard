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
  Lock,
  Package,
  ShoppingCart,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { useEmpresa } from "@/lib/contexts/empresa-context";
import { PLAN_LABELS } from "@/lib/plans";

interface Props {
  isAdmin: boolean;
}

const ACTIVE_STYLE = {
  backgroundColor: "rgba(0, 212, 255, 0.12)",
  color: "var(--accent-cyan)",
} as const;

const INACTIVE_STYLE = {
  backgroundColor: "transparent",
  color: "var(--text-secondary)",
} as const;

const LOCKED_STYLE = {
  backgroundColor: "transparent",
  color: "var(--text-muted)",
  opacity: 0.5,
  cursor: "default",
} as const;

type NavItem = {
  href:       string;
  label:      string;
  icon:       React.ElementType;
  exact:      boolean;
  featureKey?: string; // se definido, checa com hasFeature()
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",            label: "Dashboard",        icon: LayoutDashboard, exact: true },
  { href: "/dashboard/financeiro", label: "Financeiro",       icon: Landmark,        exact: false, featureKey: "modulo_financeiro" },
  { href: "/dashboard/produtos",   label: "Produtos",         icon: Package,         exact: false, featureKey: "modulo_produtos"   },
  { href: "/dashboard/vendas",     label: "Vendas",           icon: ShoppingCart,    exact: false, featureKey: "modulo_vendas"     },
  { href: "/dashboard/clientes",   label: "Clientes",         icon: Users,           exact: false, featureKey: "modulo_clientes"   },
];

export function Sidebar({ isAdmin }: Props) {
  const pathname  = usePathname();
  const [expanded, setExpanded] = useState(false);
  const { hasFeature, plan }    = useEmpresa();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const allItems: NavItem[] = [
    ...NAV_ITEMS,
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Settings2, exact: false }] : []),
  ];

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
          <div
            className="flex-shrink-0 rounded-lg flex items-center justify-center font-bold select-none"
            style={{ width: 32, height: 32, backgroundColor: "var(--accent-cyan)", color: "#0d1117", fontSize: "13px" }}
          >
            LC
          </div>
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
          {allItems.map(({ href, label, icon: Icon, exact, featureKey }, i) => {
            const locked  = !!featureKey && !hasFeature(featureKey);
            const active  = !locked && isActive(href, exact);
            const style   = locked ? LOCKED_STYLE : active ? ACTIVE_STYLE : INACTIVE_STYLE;

            const content = (
              <>
                <Icon className="flex-shrink-0" style={{ width: 18, height: 18 }} />
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: active ? 600 : 400,
                    whiteSpace: "nowrap",
                    opacity: expanded ? 1 : 0,
                    transform: expanded ? "translateX(0)" : "translateX(-6px)",
                    transition: `opacity 0.2s ease ${0.05 + i * 0.02}s, transform 0.2s ease ${0.05 + i * 0.02}s`,
                    flex: 1,
                  }}
                >
                  {label}
                </span>
                {locked && expanded && (
                  <Lock
                    style={{ width: 11, height: 11, opacity: 0.6, flexShrink: 0 }}
                  />
                )}
              </>
            );

            const commonStyle: React.CSSProperties = {
              height: "44px",
              padding: "0 14px",
              gap: "12px",
              borderLeft: active
                ? "3px solid var(--accent-cyan)"
                : "3px solid transparent",
              display: "flex",
              alignItems: "center",
              ...style,
            };

            if (locked) {
              return (
                <div
                  key={href}
                  title={`Disponível no plano Premium`}
                  style={commonStyle}
                >
                  {content}
                </div>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                style={commonStyle}
                className="transition-colors"
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
                {content}
              </Link>
            );
          })}
        </nav>

        {/* Rodapé: plano + logout */}
        <div
          className="flex flex-col py-3"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          {/* Badge de plano */}
          {expanded && (
            <div
              className="mx-3 mb-2 px-2 py-1 rounded-md text-center"
              style={{
                backgroundColor: plan === "premium"
                  ? "rgba(0,212,255,0.1)"
                  : "rgba(255,255,255,0.04)",
                border: `1px solid ${plan === "premium" ? "rgba(0,212,255,0.25)" : "var(--border-subtle)"}`,
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: plan === "premium" ? "var(--accent-cyan)" : "var(--text-muted)",
                }}
              >
                {PLAN_LABELS[plan]}
              </span>
            </div>
          )}

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

      {/* ── Mobile: bottom navigation ──────────────────────────────── */}
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
        {allItems.map(({ href, label, icon: Icon, exact, featureKey }) => {
          const locked = !!featureKey && !hasFeature(featureKey);
          const active = !locked && isActive(href, exact);

          if (locked) {
            return (
              <div
                key={href}
                className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg opacity-40"
                style={{ color: "var(--text-muted)" }}
                title="Disponível no plano Premium"
              >
                <Icon size={20} />
                <span style={{ fontSize: "10px" }}>{label}</span>
              </div>
            );
          }

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
