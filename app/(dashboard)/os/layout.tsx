import { FiscalAuthProvider } from "@/lib/fiscal-auth-context";
import type { ReactNode } from "react";

export default function OsLayout({ children }: { children: ReactNode }) {
  return <FiscalAuthProvider>{children}</FiscalAuthProvider>;
}
