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
  Package,
  ShoppingCart,
  ClipboardList,
  ChevronRight,
  ArrowLeftRight,
} from "lucide-react";
import { trocarEmpresa } from "@/app/actions/auth";
import { useEmpresa } from "@/lib/contexts/empresa-context";
import { PLAN_LABELS } from "@/lib/plans";

interface Props {
  isAdmin: boolean;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SubItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  featureKey?: string;
};

type NavGroup = {
  key: string;
  label: string;
  icon: React.ElementType;
  items: SubItem[];
};

// ─── Estrutura de navegação ───────────────────────────────────────────────────

const GRUPOS: NavGroup[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { href: "/dashboard",            label: "Vendas",     icon: ShoppingCart, exact: true },
      { href: "/dashboard/financeiro", label: "Financeiro", icon: Landmark,     featureKey: "modulo_financeiro" },
      { href: "/dashboard/produtos",   label: "Produtos",   icon: Package,      featureKey: "modulo_produtos"   },
      { href: "/dashboard/clientes",   label: "Clientes",   icon: Users,        featureKey: "modulo_clientes"   },
    ],
  },
  {
    key: "movimentacao",
    label: "Movimentação",
    icon: ArrowLeftRight,
    items: [
      { href: "/os", label: "Ordens de Serviço", icon: ClipboardList, featureKey: "modulo_os" },
    ],
  },
];

// ─── Estilos base ─────────────────────────────────────────────────────────────

const SUBITEM_BASE: React.CSSProperties = {
  height: 34,
  paddingLeft: 38,
  paddingRight: 14,
  gap: 10,
  display: "flex",
  alignItems: "center",
  borderLeft: "3px solid transparent",
};

export function Sidebar({ isAdmin }: Props) {
  const pathname = usePathname();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const { hasFeature, plan } = useEmpresa();

  const isAnyChildActive = (grupo: NavGroup) =>
    grupo.items.some((item) =>
      item.exact ? pathname === item.href : pathname.startsWith(item.href)
    );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    dashboard: true,
    movimentacao: isAnyChildActive(GRUPOS[1]),
  });

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const adminActive = pathname.startsWith("/admin");

  return (
    <>
      {/* ── Desktop: sidebar expansível ao hover ─────────────────────── */}
      <aside
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
        className="hidden md:flex fixed top-0 left-0 h-screen flex-col z-40"
        style={{
          width: sidebarExpanded ? "200px" : "56px",
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/lc-logo.ico"
            alt="LC Gestor"
            className="flex-shrink-0 rounded-lg"
            style={{ width: 32, height: 32, objectFit: "contain" }}
          />
          <span
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "var(--text-primary)",
              whiteSpace: "nowrap",
              opacity: sidebarExpanded ? 1 : 0,
              transform: sidebarExpanded ? "translateX(0)" : "translateX(-8px)",
              transition: "opacity 0.2s ease 0.05s, transform 0.2s ease 0.05s",
              letterSpacing: "-0.3px",
            }}
          >
            Gestor
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col py-2 overflow-y-auto overflow-x-hidden">

          {GRUPOS.map((grupo, gi) => {
            const grupoAtivo = isAnyChildActive(grupo);
            const grupoAberto = openGroups[grupo.key] ?? false;
            const GrupoIcon = grupo.icon;

            return (
              <div key={grupo.key}>

                {/* ── Cabeçalho do grupo ──────────────────────────── */}
                <button
                  onClick={() => toggleGroup(grupo.key)}
                  style={{
                    height: 44,
                    padding: "0 14px",
                    gap: 12,
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    cursor: "pointer",
                    background: grupoAtivo ? "var(--sidebar-item-active-bg)" : "transparent",
                    borderLeft: grupoAtivo
                      ? "3px solid var(--accent-cyan)"
                      : "3px solid transparent",
                    color: grupoAtivo ? "var(--accent-cyan)" : "var(--text-secondary)",
                  }}
                  onMouseEnter={(e) => {
                    if (!grupoAtivo) {
                      e.currentTarget.style.backgroundColor = "var(--sidebar-item-hover-bg)";
                      e.currentTarget.style.color = "var(--text-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!grupoAtivo) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }
                  }}
                >
                  <GrupoIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: grupoAtivo ? 600 : 400,
                      whiteSpace: "nowrap",
                      flex: 1,
                      textAlign: "left",
                      opacity: sidebarExpanded ? 1 : 0,
                      transform: sidebarExpanded ? "translateX(0)" : "translateX(-6px)",
                      transition: `opacity 0.2s ease ${0.05 + gi * 0.04}s, transform 0.2s ease ${0.05 + gi * 0.04}s`,
                    }}
                  >
                    {grupo.label}
                  </span>
                  <ChevronRight
                    style={{
                      width: 13,
                      height: 13,
                      flexShrink: 0,
                      opacity: sidebarExpanded ? 0.6 : 0,
                      transform: grupoAberto ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease, opacity 0.15s ease",
                    }}
                  />
                </button>

                {/* ── Sub-itens ───────────────────────────────────── */}
                <div
                  style={{
                    maxHeight: (grupoAberto && sidebarExpanded) ? `${grupo.items.length * 34 + 4}px` : "0px",
                    overflow: "hidden",
                    transition: "max-height 0.22s ease",
                  }}
                >
                  {grupo.items.map((item, si) => {
                    const hidden = !isAdmin && !!item.featureKey && !hasFeature(item.featureKey);
                    if (hidden) return null;

                    const active = item.exact
                      ? pathname === item.href
                      : pathname.startsWith(item.href);
                    const SubIcon = item.icon;

                    const subStyle: React.CSSProperties = {
                      ...SUBITEM_BASE,
                      borderLeft: active
                        ? "3px solid var(--accent-cyan)"
                        : "3px solid transparent",
                      backgroundColor: active ? "var(--sidebar-item-active-bg)" : "transparent",
                      color: active ? "var(--accent-cyan)" : "var(--text-secondary)",
                    };

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        style={subStyle}
                        onMouseEnter={(e) => {
                          if (!active) {
                            e.currentTarget.style.backgroundColor = "var(--sidebar-item-hover-bg)";
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
                        <SubIcon style={{ width: 14, height: 14, flexShrink: 0 }} />
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: active ? 600 : 400,
                            whiteSpace: "nowrap",
                            flex: 1,
                            opacity: sidebarExpanded ? 1 : 0,
                            transform: sidebarExpanded ? "translateX(0)" : "translateX(-6px)",
                            transition: `opacity 0.15s ease ${0.02 + si * 0.02}s, transform 0.15s ease`,
                          }}
                        >
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* ── Admin (item plano, só se admin) ──────────────────── */}
          {isAdmin && (
            <Link
              href="/admin"
              style={{
                height: 44,
                padding: "0 14px",
                gap: 12,
                display: "flex",
                alignItems: "center",
                borderLeft: adminActive
                  ? "3px solid var(--accent-cyan)"
                  : "3px solid transparent",
                backgroundColor: adminActive ? "var(--sidebar-item-active-bg)" : "transparent",
                color: adminActive ? "var(--accent-cyan)" : "var(--text-secondary)",
              }}
              onMouseEnter={(e) => {
                if (!adminActive) {
                  e.currentTarget.style.backgroundColor = "var(--sidebar-item-hover-bg)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!adminActive) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }
              }}
            >
              <Settings2 style={{ width: 18, height: 18, flexShrink: 0 }} />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: adminActive ? 600 : 400,
                  whiteSpace: "nowrap",
                  opacity: sidebarExpanded ? 1 : 0,
                  transform: sidebarExpanded ? "translateX(0)" : "translateX(-6px)",
                  transition: "opacity 0.2s ease 0.12s, transform 0.2s ease 0.12s",
                }}
              >
                Admin
              </span>
            </Link>
          )}
        </nav>

        {/* Rodapé: plano + logout */}
        <div
          className="flex flex-col py-3"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          {sidebarExpanded && (
            <div
              className="mx-3 mb-2 px-2 py-1 rounded-md text-center"
              style={{
                backgroundColor:
                  plan === "premium" ? "var(--sidebar-item-active-bg)" : "var(--sidebar-badge-bg)",
                border: `1px solid ${
                  plan === "premium" ? "var(--accent-cyan)" : "var(--border-subtle)"
                }`,
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color:
                    plan === "premium" ? "var(--accent-cyan)" : "var(--text-muted)",
                }}
              >
                {PLAN_LABELS[plan]}
              </span>
            </div>
          )}

          <form action={trocarEmpresa}>
            <button
              type="submit"
              className="w-full flex items-center"
              style={{
                height: "40px",
                padding: "0 14px",
                gap: "12px",
                color: "var(--text-muted)",
                borderLeft: "3px solid transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-primary)";
                e.currentTarget.style.backgroundColor = "var(--sidebar-item-hover-bg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <LogOut style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span
                style={{
                  fontSize: "13px",
                  whiteSpace: "nowrap",
                  opacity: sidebarExpanded ? 1 : 0,
                  transform: sidebarExpanded ? "translateX(0)" : "translateX(-6px)",
                  transition: "opacity 0.2s ease 0.1s, transform 0.2s ease 0.1s",
                }}
              >
                Sair
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
        {[
          { href: "/dashboard",            label: "Dashboard",  icon: LayoutDashboard, exact: true,  featureKey: undefined },
          { href: "/dashboard/financeiro", label: "Financeiro", icon: Landmark,        exact: false, featureKey: "modulo_financeiro" },
          { href: "/dashboard/clientes",   label: "Clientes",   icon: Users,           exact: false, featureKey: "modulo_clientes"   },
          { href: "/os",                   label: "OS",         icon: ClipboardList,   exact: false, featureKey: "modulo_os"         },
          ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Settings2, exact: false, featureKey: undefined }] : []),
        ]
          .filter(({ featureKey }) => isAdmin || !featureKey || hasFeature(featureKey))
          .map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
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
