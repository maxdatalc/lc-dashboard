import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  ArrowLeft,
  Activity,
  BookUser,
} from "lucide-react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { AdminNavLink } from "@/components/admin/AdminNavLink";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("is_system_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!(profile as { is_system_admin?: boolean } | null)?.is_system_admin) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 flex flex-col shrink-0">

        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-lg tracking-tight">LC Admin</span>
            <span className="text-xs font-semibold bg-amber-400 text-slate-900 px-1.5 py-0.5 rounded">
              ADMIN
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">LC Tecnologias</p>
        </div>

        {/* Navegação */}
        <nav className="flex-1 px-3 py-4 space-y-6">

          <div>
            <p className="text-slate-600 text-xs uppercase font-semibold tracking-wider mb-2 px-3">
              Gestão
            </p>
            <div className="space-y-0.5">
              <AdminNavLink href="/admin" exact>
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                Visão Geral
              </AdminNavLink>
              <AdminNavLink href="/admin/empresas">
                <Building2 className="h-4 w-4 shrink-0" />
                Grupos
              </AdminNavLink>
              <AdminNavLink href="/admin/clientes">
                <BookUser className="h-4 w-4 shrink-0" />
                Clientes
              </AdminNavLink>
              <AdminNavLink href="/admin/acessos">
                <Activity className="h-4 w-4 shrink-0" />
                Acessos
              </AdminNavLink>
            </div>
          </div>

          <div>
            <p className="text-slate-600 text-xs uppercase font-semibold tracking-wider mb-2 px-3">
              Sistema
            </p>
            <div className="space-y-0.5">
              <AdminNavLink href="/admin/usuarios">
                <Users className="h-4 w-4 shrink-0" />
                Usuários
              </AdminNavLink>
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-md text-slate-600 text-sm cursor-default">
                <CreditCard className="h-4 w-4 shrink-0" />
                <span>Planos</span>
                <span className="ml-auto text-xs bg-slate-800 text-slate-500 px-1.5 rounded">
                  em breve
                </span>
              </div>
            </div>
          </div>
        </nav>

        {/* Rodapé */}
        <div className="px-3 py-4 border-t border-white/5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-300 text-sm transition-colors rounded-md hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Voltar ao Dashboard
          </Link>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 bg-slate-50 min-h-screen overflow-auto">{children}</main>
    </div>
  );
}
