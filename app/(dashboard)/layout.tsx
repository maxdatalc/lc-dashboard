import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { NavLinks } from "@/components/dashboard/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Buscar lojas usando service role para bypassar RLS nesta query de admin
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: tenantUsers } = await adminClient
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id);

  const tenantIds = (tenantUsers ?? []).map(
    (row: { tenant_id: string }) => row.tenant_id
  );

  const { data: lojasData } = tenantIds.length
    ? await adminClient
        .from("lojas")
        .select("id, name")
        .in("tenant_id", tenantIds)
        .eq("is_active", true)
        .order("name", { ascending: true })
    : { data: [] };

  const lojas = (lojasData ?? []) as { id: string; name: string }[];

  // Determinar loja selecionada — usar a primeira como fallback se nenhuma estiver no cookie
  let selectedLojaId = await getSelectedLojaId();
  if (selectedLojaId === null && lojas.length > 0) {
    selectedLojaId = lojas[0].id;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col
        bg-card border-r border-border">

        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-border flex-shrink-0">
          <span className="text-lg font-black tracking-tight">
            <span className="text-primary">LC</span>
            <span className="text-muted-foreground font-normal text-sm ml-1">
              Dashboard
            </span>
          </span>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto py-3">
          <NavLinks lojas={lojas} selectedLojaId={selectedLojaId} />
        </div>

        {/* Rodapé */}
        <div className="border-t border-border p-3 flex-shrink-0 flex items-center justify-between gap-2">
          <ThemeToggle />
          <form action={logout}>
            <button
              type="submit"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  );
}
