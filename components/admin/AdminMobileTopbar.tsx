"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

/**
 * Topbar mobile do Centro de Comando (md:hidden).
 * Recebe o conteúdo da sidebar (marca + nav + rodapé) já renderizado no
 * servidor e o exibe num drawer lateral; fecha automaticamente ao navegar.
 */
export function AdminMobileTopbar({
  roleLabel,
  children,
}: {
  roleLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className="sticky top-0 z-40 flex h-[52px] shrink-0 items-center gap-3 px-3 md:hidden"
      style={{
        background: "var(--adm-surface)",
        borderBottom: "1px solid var(--adm-line)",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger
          aria-label="Abrir menu"
          className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          style={{ color: "var(--adm-text)" }}
        >
          <Menu className="h-5 w-5" />
        </DrawerTrigger>
        <DrawerContent
          side="left"
          className="border-0 p-0"
          style={{
            background: "var(--adm-surface)",
            borderRight: "1px solid var(--adm-line)",
          }}
        >
          <DrawerTitle className="sr-only">Menu do Centro de Comando</DrawerTitle>
          {children}
        </DrawerContent>
      </Drawer>

      <div className="flex items-center gap-2">
        <span
          className="text-base font-bold tracking-tight"
          style={{ color: "var(--adm-text)" }}
        >
          LC
        </span>
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
          style={{
            background: "var(--adm-accent-soft)",
            color: "var(--adm-accent)",
          }}
        >
          {roleLabel}
        </span>
        <span
          className="text-[11px] uppercase tracking-[0.14em]"
          style={{ color: "var(--adm-text-faint)" }}
        >
          Centro de Comando
        </span>
      </div>
    </header>
  );
}
