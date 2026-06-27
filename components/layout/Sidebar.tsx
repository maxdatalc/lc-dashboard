"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Home,
  Settings2,
  Landmark,
  Users,
  LogOut,
  Package,
  ShoppingCart,
  ClipboardList,
  ChevronRight,
  ArrowLeftRight,
  Building2,
  FileText,
  BadgeDollarSign,
  Receipt,
} from "lucide-react";
import { logout, trocarEmpresa } from "@/app/actions/auth";
import { useEmpresa } from "@/lib/contexts/empresa-context";
import { PLAN_LABELS } from "@/lib/plans";

interface Props {
  isAdmin: boolean;
  multiEmpresa?: boolean;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

type NavLeaf = {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  featureKey?: string;
};

type NavSection = {
  key: string;
  label: string;
  icon: React.ElementType;
  items: NavLeaf[];
};

type NavCategory = {
  key: string;
  label: string;
  icon: React.ElementType;
  sections: NavSection[];
};

type NavGroup = {
  key: string;
  label: string;
  icon: React.ElementType;
  featureKey?: string;
  items?: NavLeaf[];
  categories?: NavCategory[];
};

// ─── Estrutura de navegação ───────────────────────────────────────────────────

const GRUPOS: NavGroup[] = [
  {
    key: "home",
    label: "Início",
    icon: Home,
    items: [
      { href: "/home", label: "Visão Geral", icon: LayoutDashboard, exact: true },
    ],
  },
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
  {
    key: "relatorios",
    label: "Relatórios",
    icon: FileText,
    featureKey: "modulo_relatorios",
    categories: [
      {
        key: "vendas",
        label: "Vendas",
        icon: ShoppingCart,
        sections: [
          {
            key: "comissoes",
            label: "Comissões",
            icon: BadgeDollarSign,
            items: [
              { href: "/relatorios/comissao-recebimento", label: "Comissão por Recebimento", icon: Receipt },
            ],
          },
        ],
      },
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

export function Sidebar({ isAdmin, multiEmpresa }: Props) {
  const pathname = usePathname();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const { hasFeature, plan } = useEmpresa();

  // ── Helpers de estado ativo ────────────────────────────────────────────────

  const isLeafActive = (item: NavLeaf) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const isSectionActive = (sec: NavSection) => sec.items.some(isLeafActive);

  const isCategoryActive = (cat: NavCategory) => cat.sections.some(isSectionActive);

  const isGroupActive = (grupo: NavGroup): boolean => {
    if (grupo.items) return grupo.items.some(isLeafActive);
    if (grupo.categories) return grupo.categories.some(isCategoryActive);
    return false;
  };

  // ── Estado dos grupos / categorias / seções ────────────────────────────────

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({
    dashboard: true,
    movimentacao: isGroupActive(GRUPOS[1]),
    relatorios: isGroupActive(GRUPOS[2]),
  }));

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    GRUPOS.forEach(g => g.categories?.forEach(cat => { init[cat.key] = isCategoryActive(cat); }));
    return init;
  });

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    GRUPOS.forEach(g => g.categories?.forEach(cat => cat.sections.forEach(sec => { init[sec.key] = isSectionActive(sec); })));
    return init;
  });

  const toggleGroup    = (key: string) => setOpenGroups(p => ({ ...p, [key]: !p[key] }));
  const toggleCategory = (key: string) => setOpenCategories(p => ({ ...p, [key]: !p[key] }));
  const toggleSection  = (key: string) => setOpenSections(p => ({ ...p, [key]: !p[key] }));

  // Expande para 240px quando há seção profunda aberta (evita corte em labels longos)
  const hasDeepSectionOpen = sidebarExpanded && GRUPOS.some(g =>
    g.categories && openGroups[g.key] && g.categories.some(cat =>
      openCategories[cat.key] && cat.sections.some(sec => openSections[sec.key])
    )
  );
  const expandedWidth = hasDeepSectionOpen ? 240 : 200;

  const adminActive = pathname.startsWith("/admin");

  return (
    <>
      {/* ── Desktop: sidebar expansível ao hover ─────────────────────── */}
      <aside
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
        className="hidden md:flex fixed top-0 left-0 h-screen flex-col z-40"
        style={{
          width: sidebarExpanded ? `${expandedWidth}px` : "56px",
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
            // Oculta grupo por featureKey no nível do grupo (ex: Relatórios)
            if (!isAdmin && grupo.featureKey && !hasFeature(grupo.featureKey)) return null;
            // Oculta grupos cujos TODOS os itens estão bloqueados por feature (ex: Movimentação sem O.S)
            if (!isAdmin && grupo.items && !grupo.featureKey) {
              const algumVisivel = grupo.items.some(item => !item.featureKey || hasFeature(item.featureKey));
              if (!algumVisivel) return null;
            }

            const grupoAtivo  = isGroupActive(grupo);
            const grupoAberto = openGroups[grupo.key] ?? false;
            const GrupoIcon   = grupo.icon;

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
                    borderLeft: grupoAtivo ? "3px solid var(--accent-cyan)" : "3px solid transparent",
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

                {/* ── Sub-itens diretos (Dashboard / Movimentação) ─── */}
                {grupo.items && (
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

                      const active  = isLeafActive(item);
                      const SubIcon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          style={{
                            ...SUBITEM_BASE,
                            borderLeft: active ? "3px solid var(--accent-cyan)" : "3px solid transparent",
                            backgroundColor: active ? "var(--sidebar-item-active-bg)" : "transparent",
                            color: active ? "var(--accent-cyan)" : "var(--text-secondary)",
                          }}
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
                )}

                {/* ── Categorias aninhadas (Relatórios) ───────────── */}
                {grupo.categories && (() => {
                  const maxH = grupo.categories.reduce((t, cat) => {
                    const secH = cat.sections.reduce((s, sec) => s + 32 + sec.items.length * 30 + 4, 0);
                    return t + 36 + secH;
                  }, 0);

                  return (
                    <div
                      style={{
                        maxHeight: (grupoAberto && sidebarExpanded) ? `${maxH}px` : "0px",
                        overflow: "hidden",
                        transition: "max-height 0.22s ease",
                      }}
                    >
                      {grupo.categories.map((cat, ci) => {
                        const catAtivo  = isCategoryActive(cat);
                        const catAberta = openCategories[cat.key] ?? false;
                        const CatIcon   = cat.icon;

                        const maxSecH = cat.sections.reduce((t, sec) => t + 32 + sec.items.length * 30 + 4, 0);

                        return (
                          <div key={cat.key}>

                            {/* Categoria */}
                            <button
                              onClick={() => toggleCategory(cat.key)}
                              style={{
                                height: 36,
                                paddingLeft: 24,
                                paddingRight: 14,
                                gap: 10,
                                display: "flex",
                                alignItems: "center",
                                width: "100%",
                                cursor: "pointer",
                                background: catAtivo ? "var(--sidebar-item-active-bg)" : "transparent",
                                borderLeft: catAtivo ? "3px solid var(--accent-cyan)" : "3px solid transparent",
                                color: catAtivo ? "var(--accent-cyan)" : "var(--text-secondary)",
                              }}
                              onMouseEnter={(e) => {
                                if (!catAtivo) {
                                  e.currentTarget.style.backgroundColor = "var(--sidebar-item-hover-bg)";
                                  e.currentTarget.style.color = "var(--text-primary)";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!catAtivo) {
                                  e.currentTarget.style.backgroundColor = "transparent";
                                  e.currentTarget.style.color = "var(--text-secondary)";
                                }
                              }}
                            >
                              <CatIcon style={{ width: 15, height: 15, flexShrink: 0 }} />
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: catAtivo ? 600 : 400,
                                  whiteSpace: "nowrap",
                                  flex: 1,
                                  textAlign: "left",
                                  opacity: sidebarExpanded ? 1 : 0,
                                  transform: sidebarExpanded ? "translateX(0)" : "translateX(-6px)",
                                  transition: `opacity 0.15s ease ${0.02 + ci * 0.03}s, transform 0.15s ease`,
                                }}
                              >
                                {cat.label}
                              </span>
                              <ChevronRight
                                style={{
                                  width: 11,
                                  height: 11,
                                  flexShrink: 0,
                                  opacity: sidebarExpanded ? 0.5 : 0,
                                  transform: catAberta ? "rotate(90deg)" : "rotate(0deg)",
                                  transition: "transform 0.2s ease, opacity 0.15s ease",
                                }}
                              />
                            </button>

                            {/* Seções dentro da categoria */}
                            <div
                              style={{
                                maxHeight: (catAberta && sidebarExpanded) ? `${maxSecH}px` : "0px",
                                overflow: "hidden",
                                transition: "max-height 0.2s ease",
                              }}
                            >
                              {cat.sections.map((sec, si) => {
                                const secAtivo  = isSectionActive(sec);
                                const secAberta = openSections[sec.key] ?? false;
                                const SecIcon   = sec.icon;

                                return (
                                  <div key={sec.key}>

                                    {/* Seção */}
                                    <button
                                      onClick={() => toggleSection(sec.key)}
                                      style={{
                                        height: 32,
                                        paddingLeft: 34,
                                        paddingRight: 14,
                                        gap: 8,
                                        display: "flex",
                                        alignItems: "center",
                                        width: "100%",
                                        cursor: "pointer",
                                        background: secAtivo ? "var(--sidebar-item-active-bg)" : "transparent",
                                        borderLeft: secAtivo ? "3px solid var(--accent-cyan)" : "3px solid transparent",
                                        color: secAtivo ? "var(--accent-cyan)" : "var(--text-secondary)",
                                      }}
                                      onMouseEnter={(e) => {
                                        if (!secAtivo) {
                                          e.currentTarget.style.backgroundColor = "var(--sidebar-item-hover-bg)";
                                          e.currentTarget.style.color = "var(--text-primary)";
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (!secAtivo) {
                                          e.currentTarget.style.backgroundColor = "transparent";
                                          e.currentTarget.style.color = "var(--text-secondary)";
                                        }
                                      }}
                                    >
                                      <SecIcon style={{ width: 13, height: 13, flexShrink: 0 }} />
                                      <span
                                        style={{
                                          fontSize: 11,
                                          fontWeight: secAtivo ? 600 : 400,
                                          whiteSpace: "nowrap",
                                          flex: 1,
                                          textAlign: "left",
                                          opacity: sidebarExpanded ? 1 : 0,
                                          transform: sidebarExpanded ? "translateX(0)" : "translateX(-6px)",
                                          transition: `opacity 0.15s ease ${0.01 + si * 0.02}s, transform 0.15s ease`,
                                        }}
                                      >
                                        {sec.label}
                                      </span>
                                      <ChevronRight
                                        style={{
                                          width: 10,
                                          height: 10,
                                          flexShrink: 0,
                                          opacity: sidebarExpanded ? 0.4 : 0,
                                          transform: secAberta ? "rotate(90deg)" : "rotate(0deg)",
                                          transition: "transform 0.2s ease, opacity 0.15s ease",
                                        }}
                                      />
                                    </button>

                                    {/* Itens folha */}
                                    <div
                                      style={{
                                        maxHeight: (secAberta && sidebarExpanded) ? `${sec.items.length * 30 + 4}px` : "0px",
                                        overflow: "hidden",
                                        transition: "max-height 0.18s ease",
                                      }}
                                    >
                                      {sec.items.map((leaf, li) => {
                                        const hidden = !isAdmin && !!leaf.featureKey && !hasFeature(leaf.featureKey);
                                        if (hidden) return null;
                                        const active   = isLeafActive(leaf);
                                        const LeafIcon = leaf.icon;

                                        return (
                                          <Link
                                            key={leaf.href}
                                            href={leaf.href}
                                            style={{
                                              height: 30,
                                              paddingLeft: 44,
                                              paddingRight: 14,
                                              gap: 8,
                                              display: "flex",
                                              alignItems: "center",
                                              borderLeft: active ? "3px solid var(--accent-cyan)" : "3px solid transparent",
                                              backgroundColor: active ? "var(--sidebar-item-active-bg)" : "transparent",
                                              color: active ? "var(--accent-cyan)" : "var(--text-secondary)",
                                            }}
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
                                            <LeafIcon style={{ width: 12, height: 12, flexShrink: 0 }} />
                                            <span
                                              style={{
                                                fontSize: 11,
                                                fontWeight: active ? 600 : 400,
                                                whiteSpace: "nowrap",
                                                flex: 1,
                                                opacity: sidebarExpanded ? 1 : 0,
                                                transform: sidebarExpanded ? "translateX(0)" : "translateX(-6px)",
                                                transition: `opacity 0.12s ease ${0.01 + li * 0.02}s, transform 0.12s ease`,
                                              }}
                                            >
                                              {leaf.label}
                                            </span>
                                          </Link>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
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
                borderLeft: adminActive ? "3px solid var(--accent-cyan)" : "3px solid transparent",
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
                  color: plan === "premium" ? "var(--accent-cyan)" : "var(--text-muted)",
                }}
              >
                {PLAN_LABELS[plan]}
              </span>
            </div>
          )}

          {multiEmpresa && (
            <form action={trocarEmpresa}>
              <button
                type="submit"
                className="w-full flex items-center"
                style={{
                  height: "38px",
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
                <Building2 style={{ width: 16, height: 16, flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: "13px",
                    whiteSpace: "nowrap",
                    opacity: sidebarExpanded ? 1 : 0,
                    transform: sidebarExpanded ? "translateX(0)" : "translateX(-6px)",
                    transition: "opacity 0.2s ease 0.1s, transform 0.2s ease 0.1s",
                  }}
                >
                  Trocar empresa
                </span>
              </button>
            </form>
          )}

          <form action={logout}>
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
          { href: "/dashboard",                          label: "Dashboard",  icon: LayoutDashboard, exact: true,  featureKey: undefined },
          { href: "/dashboard/financeiro",               label: "Financeiro", icon: Landmark,        exact: false, featureKey: "modulo_financeiro" },
          { href: "/dashboard/clientes",                 label: "Clientes",   icon: Users,           exact: false, featureKey: "modulo_clientes"   },
          { href: "/os",                                 label: "OS",         icon: ClipboardList,   exact: false, featureKey: "modulo_os"         },
          { href: "/relatorios/comissao-recebimento",    label: "Relatórios", icon: FileText,        exact: false, featureKey: "modulo_relatorios" },
          ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Settings2, exact: false, featureKey: undefined }] : []),
        ]
          .filter(({ featureKey }) => isAdmin || !featureKey || hasFeature(featureKey))
          .map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center"
                style={{
                  gap: "4px",
                  padding: "6px 12px",
                  borderRadius: "10px",
                  color: active ? "var(--accent-cyan)" : "var(--text-muted)",
                  background: active ? "rgba(0,229,255,0.08)" : "transparent",
                  boxShadow: active ? "0 0 18px rgba(0,229,255,0.12), inset 0 0 0 1px rgba(0,229,255,0.12)" : "none",
                  transition: "background 0.2s ease, box-shadow 0.2s ease, color 0.2s ease",
                  minWidth: "52px",
                  alignItems: "center",
                }}
              >
                <Icon size={20} />
                <span style={{ fontSize: "10px", fontWeight: active ? 600 : 400, lineHeight: 1 }}>
                  {label}
                </span>
              </Link>
            );
          })}
      </nav>
    </>
  );
}
