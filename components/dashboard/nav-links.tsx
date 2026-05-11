"use client";

// Navegação lateral do dashboard — Client Component para usar usePathname()

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Landmark,
  Package,
  ShoppingCart,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LojaSelector } from "@/components/dashboard/loja-selector";

interface Props {
  lojas: { id: string; name: string }[];
  selectedLojaId: string | null;
}

// Links dos módulos — todos com placeholder "Em breve"
const MODULOS = [
  {
    href: "/dashboard/financeiro",
    label: "Financeiro",
    icon: Landmark,
  },
  {
    href: "/dashboard/produtos",
    label: "Produtos & Estoque",
    icon: Package,
  },
  {
    href: "/dashboard/vendas",
    label: "Vendas",
    icon: ShoppingCart,
  },
  {
    href: "/dashboard/clientes",
    label: "Clientes",
    icon: Users,
  },
];

// Classes compartilhadas para links de navegação
const BASE_LINK =
  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer w-full";
const LINK_ATIVO = "bg-slate-100 text-slate-900";
const LINK_INATIVO = "text-slate-600 hover:bg-slate-50 hover:text-slate-900";

export function NavLinks({ lojas, selectedLojaId }: Props) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-4 py-6 overflow-y-auto space-y-1">
      {/* Dashboard principal */}
      <Link
        href="/dashboard"
        className={`${BASE_LINK} ${pathname === "/dashboard" ? LINK_ATIVO : LINK_INATIVO}`}
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" />
        Dashboard
      </Link>

      {/* Separador */}
      <div className="h-px bg-slate-100 my-2" />

      {/* Label da seção de módulos */}
      <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1">
        Módulos
      </span>

      {/* Links de módulos */}
      {MODULOS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`${BASE_LINK} ${
            pathname.startsWith(href) ? LINK_ATIVO : LINK_INATIVO
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
          <span className="ml-auto text-xs bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-normal">
            Em breve
          </span>
        </Link>
      ))}

      {/* Separador antes das lojas */}
      <div className="h-px bg-slate-100 my-2" />

      {/* Seção de lojas — mantida exatamente como estava */}
      <div>
        <div className="flex items-center justify-between px-3 mb-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Lojas
          </span>
          <Badge variant="secondary" className="text-xs">
            {lojas.length}
          </Badge>
        </div>
        {lojas.length > 0 ? (
          <LojaSelector lojas={lojas} selectedLojaId={selectedLojaId} />
        ) : (
          <p className="px-3 text-xs text-slate-400">Nenhuma loja ativa</p>
        )}
      </div>
    </nav>
  );
}
