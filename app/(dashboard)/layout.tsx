import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { PeriodProvider } from "@/lib/contexts/period-context";
import { LojaProvider } from "@/lib/contexts/loja-context";
import { FilterProvider } from "@/lib/contexts/filter-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Buscar lojas e checar permissão admin em paralelo
  const [tenantUsersRes, profileRes] = await Promise.all([
    adminClient.from("tenant_users").select("tenant_id").eq("user_id", user.id),
    adminClient
      .from("profiles")
      .select("is_system_admin")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const tenantIds = (tenantUsersRes.data ?? []).map(
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

  let selectedLojaId = await getSelectedLojaId();
  if (selectedLojaId === null && lojas.length > 0) {
    selectedLojaId = lojas[0].id;
  }

  const isAdmin =
    (profileRes.data as { is_system_admin?: boolean } | null)?.is_system_admin === true;

  return (
    <LojaProvider lojas={lojas} selectedLojaId={selectedLojaId}>
      <PeriodProvider>
      <FilterProvider>
        <div
          className="min-h-screen"
          style={{ backgroundColor: "var(--bg-primary)" }}
        >
          <Sidebar isAdmin={isAdmin} lojas={lojas} selectedLojaId={selectedLojaId} />

          <div
            style={{ marginLeft: "var(--sidebar-width)" }}
            className="flex flex-col min-h-screen"
          >
            <Header />

            <main
              className="flex-1 overflow-y-auto pb-20 md:pb-0"
              style={{ paddingTop: "var(--header-height)" }}
            >
              {children}
            </main>
          </div>
        </div>
      </FilterProvider>
      </PeriodProvider>
    </LojaProvider>
  );
}
