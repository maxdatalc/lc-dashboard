"use client";

import { usePathname } from "next/navigation";

export function DashboardMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasHeader = !pathname.startsWith("/os");

  return (
    <main
      className="flex-1 overflow-y-auto pb-20 md:pb-0"
      style={{ paddingTop: hasHeader ? "var(--header-height)" : 0 }}
    >
      {children}
    </main>
  );
}
