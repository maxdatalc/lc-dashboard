import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Activity,
  ShieldCheck,
  BookUser,
  Zap,
} from "lucide-react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { AdminNavLink } from "@/components/admin/AdminNavLink";
import { AdminSidebarFooter } from "@/components/admin/AdminSidebarFooter";
import { AdminMobileTopbar } from "@/components/admin/AdminMobileTopbar";

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--adm-text-faint)" }}
      >
        {label}
      </p>
      <div className="space-y-px">{children}</div>
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

  // Conteúdo da sidebar, renderizado uma única vez e usado no aside (desktop)
  // e dentro do drawer mobile.
  const sidebarContent = (
    <>
      {/* Marca */}
      <div className="flex items-center gap-2 px-4 py-4" style={{ borderBottom: "1px solid var(--adm-line)" }}>
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
          style={{ background: "var(--adm-accent-soft)", color: "var(--adm-accent)" }}
        >
          LC
        </span>
        <span
          className="min-w-0 truncate text-[13px] font-semibold"
          style={{ color: "var(--adm-text)" }}
        >
          Centro de Comando
        </span>
        <span
          className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider"
          style={{ background: "var(--adm-surface-3)", color: "var(--adm-text-faint)" }}
        >
          {roleLabel}
        </span>
      </div>

      {/* Navegação */}
      <nav className="flex-1 space-y-5 px-2.5 py-4">
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
            <AdminNavLink href="/admin/modulos">
              <Zap className="h-4 w-4 shrink-0" />
              Módulos
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
    </>
  );

  return (
    <div className="admin-shell flex min-h-screen">
      {/* Sidebar — apenas desktop */}
      <aside
        className="hidden w-52 shrink-0 flex-col md:flex"
        style={{
          background: "var(--adm-surface)",
          borderRight: "1px solid var(--adm-line)",
        }}
      >
        {sidebarContent}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar mobile com drawer — mesma nav do aside */}
        <AdminMobileTopbar roleLabel={roleLabel}>{sidebarContent}</AdminMobileTopbar>

        {/* Conteúdo */}
        <main
          className="min-h-0 flex-1 overflow-auto"
          style={{ background: "var(--adm-bg)", color: "var(--adm-text)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
