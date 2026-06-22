import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  ArrowLeft,
  Activity,
  ShieldCheck,
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
    .select("is_system_admin, is_suporte")
    .eq("id", user.id)
    .maybeSingle();

  const p = profile as { is_system_admin?: boolean; is_suporte?: boolean } | null;
  const isAdmin   = !!p?.is_system_admin;
  const isSuporte = !!p?.is_suporte;

  if (!isAdmin && !isSuporte) redirect("/dashboard");

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 flex flex-col shrink-0">

        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-lg tracking-tight">LC Admin</span>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${isSuporte ? "bg-sky-400 text-slate-900" : "bg-amber-400 text-slate-900"}`}>
              {isSuporte ? "SUPORTE" : "ADMIN"}
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">LC Tecnologias</p>
        </div>

        {/* Navegação */}
        <nav className="flex-1 px-3 py-4 space-y-6">

          <div>
            <p className="text-slate-600 text-xs uppercase font-semibold tracking-wider mb-2 px-3">
              Cadastros
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
              {isAdmin && (
                <AdminNavLink href="/admin/acessos">
                  <Activity className="h-4 w-4 shrink-0" />
                  Acessos
                </AdminNavLink>
              )}
            </div>
          </div>

          {isAdmin && (
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
          )}

          {isSuporte && (
            <div>
              <p className="text-slate-600 text-xs uppercase font-semibold tracking-wider mb-2 px-3">
                Acesso
              </p>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-md text-slate-600 text-xs">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-sky-500" />
                  <span className="text-slate-500">Modo leitura</span>
                </div>
              </div>
            </div>
          )}
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
