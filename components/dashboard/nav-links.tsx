"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Landmark,
  Package,
  ShoppingCart,
  Users,
} from "lucide-react";
import { LojaSelector } from "@/components/dashboard/loja-selector";

interface Props {
  lojas: { id: string; name: string }[];
  selectedLojaId: string | null;
}

const MODULOS = [
  { href: "/dashboard/financeiro", label: "Financeiro", icon: Landmark },
  { href: "/dashboard/produtos",   label: "Produtos & Estoque", icon: Package },
  { href: "/dashboard/vendas",     label: "Vendas", icon: ShoppingCart },
  { href: "/dashboard/clientes",   label: "Clientes", icon: Users },
];

const LINK_ATIVO =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium " +
  "bg-primary/10 text-primary border border-primary/20 transition-colors";

const LINK_INATIVO =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium " +
  "text-muted-foreground hover:text-foreground hover:bg-accent transition-colors";

export function NavLinks({ lojas, selectedLojaId }: Props) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {/* Dashboard principal */}
      <Link
        href="/dashboard"
        className={pathname === "/dashboard" ? LINK_ATIVO : LINK_INATIVO}
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" />
        Dashboard
      </Link>

      {/* Separador */}
      <div className="h-px bg-border my-2" />

      {/* Módulos */}
      {MODULOS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={pathname.startsWith(href) ? LINK_ATIVO : LINK_INATIVO}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
          <span className="ml-auto text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-normal">
            Em breve
          </span>
        </Link>
      ))}

      {/* Separador antes das lojas */}
      <div className="h-px bg-border my-2" />

      {/* Seção de lojas */}
      <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Loja ativa
      </p>
      {lojas.length > 0 ? (
        <LojaSelector lojas={lojas} selectedLojaId={selectedLojaId} />
      ) : (
        <p className="px-3 text-xs text-muted-foreground">Nenhuma loja ativa</p>
      )}
    </nav>
  );
}
