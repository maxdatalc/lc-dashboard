import { FiscalAuthProvider } from "@/lib/fiscal-auth-context";
import type { ReactNode } from "react";

export default function OsLayout({ children }: { children: ReactNode }) {
  return (
    <FiscalAuthProvider>
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {children}
      </main>
    </FiscalAuthProvider>
  );
}
