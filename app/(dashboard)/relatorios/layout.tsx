import type { ReactNode } from "react";

export default function RelatoriosLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
      {children}
    </main>
  );
}
