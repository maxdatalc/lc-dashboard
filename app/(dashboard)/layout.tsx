import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { PeriodProvider } from "@/lib/contexts/period-context";
import { LojaProvider } from "@/lib/contexts/loja-context";
import { FilterProvider } from "@/lib/contexts/filter-context";
import { EmpresaProvider } from "@/lib/contexts/empresa-context";
import type { Plan, UserRole } from "@/lib/plans";

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

  const cookieStore = await cookies();
  const selectedTenantId = cookieStore.get("selected_tenant_id")?.value ?? null;

  const [profileRes, tenantAccessRes, empresaRes] = await Promise.all([
    adminClient
      .from("profiles")
      .select("is_system_admin")
      .eq("id", user.id)
      .maybeSingle(),

    selectedTenantId
      ? adminClient
          .from("tenant_users")
          .select("role")
          .eq("user_id", user.id)
          .eq("tenant_id", selectedTenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    selectedTenantId
      ? adminClient
          .from("tenants")
          .select("id, name, plan")
          .eq("id", selectedTenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const isAdmin =
    (profileRes.data as { is_system_admin?: boolean } | null)?.is_system_admin === true;

  if (!isAdmin && (!selectedTenantId || !tenantAccessRes.data)) {
    redirect("/login");
  }

  const empresaData = empresaRes.data as { id: string; name: string; plan: string } | null;
  const plan     = (empresaData?.plan ?? "free") as Plan;
  const userRole = ((tenantAccessRes.data as { role?: string } | null)?.role ?? "viewer") as UserRole;

  const { data: lojasData } = selectedTenantId
    ? await adminClient
        .from("lojas")
        .select("id, name")
        .eq("tenant_id", selectedTenantId)
        .eq("is_active", true)
        .order("name", { ascending: true })
    : { data: [] };

  const lojas = (lojasData ?? []) as { id: string; name: string }[];

  let selectedLojaId = await getSelectedLojaId();
  if (selectedLojaId === null && lojas.length > 0) {
    selectedLojaId = lojas[0].id;
  }

  return (
    <EmpresaProvider
      empresaId={selectedTenantId ?? ""}
      empresaNome={empresaData?.name ?? ""}
      plan={plan}
      userRole={isAdmin ? "owner" : userRole}
    >
      <LojaProvider lojas={lojas} selectedLojaId={selectedLojaId}>
        <PeriodProvider>
          <FilterProvider>
            <div
              className="min-h-screen"
              style={{ backgroundColor: "var(--bg-primary)" }}
            >
              <Sidebar isAdmin={isAdmin} />

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
    </EmpresaProvider>
  );
}
