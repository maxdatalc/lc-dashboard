"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, LogOut, MoreHorizontal, Settings2 } from "lucide-react";
import { logout, trocarEmpresa } from "@/app/actions/auth";
import { GRUPOS, type NavLeaf } from "@/lib/nav/grupos";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

/**
 * Item "Mais" da bottom nav: abre a árvore completa de navegação (mesma fonte
 * GRUPOS do rail desktop) — nenhuma seção fica inacessível no mobile.
 */
export function MobileMoreDrawer({
  isAdmin,
  multiEmpresa,
  hasFeature,
}: {
  isAdmin: boolean;
  multiEmpresa?: boolean;
  hasFeature: (key: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const leafVisible = (l: NavLeaf) => isAdmin || !l.featureKey || hasFeature(l.featureKey);
  const isLeafActive = (l: NavLeaf) =>
    l.exact ? pathname === l.href : pathname.startsWith(l.href);

  const renderLeaf = (leaf: NavLeaf) => {
    const active = isLeafActive(leaf);
    const Icon = leaf.icon;
    return (
      <Link
        key={leaf.href}
        href={leaf.href}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px]"
        style={{
          color: active ? "var(--accent-cyan)" : "var(--text-primary)",
          background: active ? "var(--sidebar-item-active-bg)" : "transparent",
          fontWeight: active ? 600 : 400,
        }}
      >
        <Icon style={{ width: 18, height: 18, flexShrink: 0 }} />
        {leaf.label}
      </Link>
    );
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        aria-label="Mais opções de navegação"
        className="flex flex-col items-center"
        style={{
          gap: "4px",
          padding: "6px 12px",
          borderRadius: "10px",
          color: open ? "var(--accent-cyan)" : "var(--text-muted)",
          minWidth: "52px",
        }}
      >
        <MoreHorizontal size={20} />
        <span style={{ fontSize: "10px", lineHeight: 1 }}>Mais</span>
      </DrawerTrigger>

      <DrawerContent
        side="left"
        className="border-0"
        style={{
          background: "var(--bg-card)",
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        <DrawerTitle className="sr-only">Navegação completa</DrawerTitle>

        <div className="flex items-center gap-2.5 px-4 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lc-logo.ico" alt="" className="rounded-lg" style={{ width: 28, height: 28 }} />
          <span className="text-[15px] font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.3px" }}>
            Gestor
          </span>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
          {GRUPOS.map((grupo) => {
            if (!isAdmin && grupo.featureKey && !hasFeature(grupo.featureKey)) return null;

            const leaves: NavLeaf[] = [
              ...(grupo.items ?? []),
              ...(grupo.categories?.flatMap((cat) =>
                cat.sections.flatMap((sec) => sec.items),
              ) ?? []),
            ].filter(leafVisible);

            if (leaves.length === 0) return null;

            return (
              <div key={grupo.key}>
                <p
                  className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {grupo.label}
                </p>
                <div className="space-y-0.5">{leaves.map(renderLeaf)}</div>
              </div>
            );
          })}

          {isAdmin && (
            <div>
              <p
                className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: "var(--text-muted)" }}
              >
                Administração
              </p>
              {renderLeaf({ href: "/admin", label: "Centro de Comando", icon: Settings2 })}
            </div>
          )}
        </nav>

        <div className="px-2 py-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {multiEmpresa && (
            <form action={trocarEmpresa}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px]"
                style={{ color: "var(--text-secondary)" }}
              >
                <Building2 style={{ width: 16, height: 16, flexShrink: 0 }} />
                Trocar empresa
              </button>
            </form>
          )}
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px]"
              style={{ color: "var(--text-muted)" }}
            >
              <LogOut style={{ width: 16, height: 16, flexShrink: 0 }} />
              Sair
            </button>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
