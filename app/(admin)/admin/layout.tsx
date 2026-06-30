import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Activity,
  ShieldCheck,
  BookUser,
} from "lucide-react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { AdminNavLink } from "@/components/admin/AdminNavLink";
import { AdminSidebarFooter } from "@/components/admin/AdminSidebarFooter";

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--adm-text-faint)" }}
      >
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

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
    .select("is_system_admin, is_suporte, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const p = profile as
    | { is_system_admin?: boolean; is_suporte?: boolean; full_name?: string | null }
    | null;
  const isAdmin = !!p?.is_system_admin;
  const isSuporte = !!p?.is_suporte;

  if (!isAdmin && !isSuporte) redirect("/dashboard");

  const roleLabel = isAdmin ? "ADMIN" : "SUPORTE";

  return (
    <div className="admin-shell flex min-h-screen">
      {/* Sidebar */}
      <aside
        className="flex w-60 shrink-0 flex-col"
        style={{
          background: "var(--adm-surface)",
          borderRight: "1px solid var(--adm-line)",
        }}
      >
        {/* Marca */}
        <div className="px-4 py-5" style={{ borderBottom: "1px solid var(--adm-line)" }}>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
              <span
                className="adm-pulse-ring absolute h-2.5 w-2.5 rounded-full"
                style={{ background: "var(--adm-accent)" }}
              />
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: "var(--adm-accent)" }}
              />
            </span>
            <span
              className="text-lg font-bold tracking-tight"
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
          </div>
          <p
            className="mt-1 text-[11px] uppercase tracking-[0.18em]"
            style={{ color: "var(--adm-text-faint)" }}
          >
            Centro de Comando
          </p>
        </div>

        {/* Navegação */}
        <nav className="flex-1 space-y-6 px-3 py-5">
          <NavGroup label="Operação">
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
              Base de Clientes
            </AdminNavLink>
            <AdminNavLink href="/admin/acessos">
              <Activity className="h-4 w-4 shrink-0" />
              Monitoramento
            </AdminNavLink>
          </NavGroup>

          {isAdmin && (
            <NavGroup label="Sistema">
              <AdminNavLink href="/admin/usuarios">
                <Users className="h-4 w-4 shrink-0" />
                Usuários
              </AdminNavLink>
            </NavGroup>
          )}

          {isSuporte && (
            <NavGroup label="Acesso">
              <div
                className="flex items-center gap-2.5 px-3 py-2 text-xs"
                style={{ color: "var(--adm-text-dim)" }}
              >
                <ShieldCheck
                  className="h-4 w-4 shrink-0"
                  style={{ color: "var(--adm-accent)" }}
                />
                Modo leitura
              </div>
            </NavGroup>
          )}
        </nav>

        {/* Rodapé */}
        <AdminSidebarFooter
          userName={p?.full_name ?? ""}
          userEmail={user.email ?? ""}
        />
      </aside>

      {/* Conteúdo */}
      <main
        className="min-h-screen flex-1 overflow-auto"
        style={{ background: "var(--adm-bg)", color: "var(--adm-text)" }}
      >
        {children}
      </main>
    </div>
  );
}
