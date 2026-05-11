// Layout do dashboard — Server Component com dados reais do usuário e lojas
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { logout } from "@/app/actions/auth";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { NavLinks } from "@/components/dashboard/nav-links";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Buscar lojas usando service role para bypassar RLS nesta query de admin
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Buscar os tenant_ids do usuário, depois as lojas ativas desses tenants
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

  // Usar a parte do email antes do @ como nome de exibição até ter profiles completos
  const displayName = user.email?.split("@")[0] ?? "Usuário";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-slate-200">
          <span className="text-xl font-bold text-slate-900">LC Dashboard</span>
        </div>

        {/* Navegação — Client Component para detectar rota ativa */}
        <NavLinks lojas={lojas} selectedLojaId={selectedLojaId} />

        {/* Rodapé com usuário e botão de logout */}
        <div className="px-4 py-4 border-t border-slate-200 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600 shrink-0">
              {initial}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-slate-700 truncate">
                {displayName}
              </span>
              <span className="text-xs text-slate-400 truncate">{user.email}</span>
            </div>
          </div>

          {/* Logout via Server Action — não precisa de Client Component */}
          <form action={logout} className="px-3">
            <button
              type="submit"
              className="w-full text-left text-sm text-slate-500 hover:text-slate-700 py-1 transition-colors"
            >
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
