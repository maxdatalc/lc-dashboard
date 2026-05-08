// Layout principal do dashboard — sidebar com navegação e rodapé com usuário mockado
import type { ReactNode } from "react";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-slate-200">
          <span className="text-xl font-bold text-slate-900">LC Dashboard</span>
        </div>

        {/* Navegação */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <LayoutDashboard className="h-4 w-4 text-slate-500" />
            Dashboard
          </Link>
        </nav>

        {/* Rodapé com usuário mockado */}
        <div className="px-4 py-4 border-t border-slate-200">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600">
              U
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-700">Usuário</span>
              <span className="text-xs text-slate-400">usuario@empresa.com</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
