import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSelectedLojaId } from "@/app/actions/lojas";
import { Sidebar } from "@/components/layout/Sidebar";
import { PeriodProvider } from "@/lib/contexts/period-context";
import { LojaProvider } from "@/lib/contexts/loja-context";
import { FilterProvider } from "@/lib/contexts/filter-context";
import { EmpresaProvider } from "@/lib/contexts/empresa-context";
import { DashLojaSync } from "@/components/layout/DashLojaSync";
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

  const [profileRes, tenantAccessRes, empresaRes, featuresRes, userSettingsRes, tenantCountRes] = await Promise.all([
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

    selectedTenantId
      ? adminClient
          .from("tenant_features")
          .select("feature_key")
          .eq("tenant_id", selectedTenantId)
      : Promise.resolve({ data: [] }),

    // Configurações por usuário: módulos liberados e grupo atribuído
    selectedTenantId
      ? adminClient
          .from("user_tenant_settings")
          .select("modulos, group_id")
          .eq("user_id", user.id)
          .eq("tenant_id", selectedTenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    // Contagem de empresas do usuário (para exibir "Trocar empresa" no sidebar)
    adminClient
      .from("tenant_users")
      .select("tenant_id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const isAdmin =
    (profileRes.data as { is_system_admin?: boolean } | null)?.is_system_admin === true;

  if (!isAdmin && selectedTenantId && !tenantAccessRes.data) {
    redirect("/login");
  }

  const empresaData = empresaRes.data as { id: string; name: string; plan: string } | null;
  const plan         = (empresaData?.plan ?? "free") as Plan;
  const userRole     = ((tenantAccessRes.data as { role?: string } | null)?.role ?? "viewer") as UserRole;

  // Features do tenant (source of truth para o que está ativado)
  const rawFeatures  = (featuresRes.data ?? []) as { feature_key: string }[];
  const allTenantFeatures = rawFeatures.map((r) => r.feature_key);

  // Configurações por usuário + grupo
  const userSettings = (userSettingsRes.data as { modulos?: Record<string, boolean>; group_id?: string | null } | null);
  const userModulos = userSettings?.modulos ?? null;
  const groupId = userSettings?.group_id ?? null;
  const effectiveRole = isAdmin ? "owner" : userRole;

  // Carrega modulos do grupo se o usuário pertence a um
  let groupModulos: Record<string, boolean> | null = null;
  if (groupId && selectedTenantId) {
    const { data: grp } = await adminClient
      .from("tenant_groups")
      .select("modulos")
      .eq("id", groupId)
      .maybeSingle();
    groupModulos = (grp as { modulos?: Record<string, boolean> } | null)?.modulos ?? null;
  }

  // Resolução de permissões em 3 níveis: tenant → grupo → usuário
  let effectiveFeatures: string[] | undefined;
  if (allTenantFeatures.length === 0) {
    effectiveFeatures = undefined; // sem features = usa planHasFeature como fallback
  } else if (isAdmin || effectiveRole === "owner") {
    effectiveFeatures = allTenantFeatures; // proprietários e admins globais: acesso total
  } else if (groupModulos && Object.keys(groupModulos).length > 0) {
    // Nível grupo: interseção tenant ∩ grupo
    const groupFeatures = allTenantFeatures.filter((k) => groupModulos![k] === true);
    if (userModulos && Object.keys(userModulos).length > 0) {
      // Nível usuário: restrição adicional sobre o grupo
      effectiveFeatures = groupFeatures.filter((k) => userModulos[k] === true);
    } else {
      effectiveFeatures = groupFeatures;
    }
  } else if (userModulos && Object.keys(userModulos).length > 0) {
    // Sem grupo, com restrições individuais
    effectiveFeatures = allTenantFeatures.filter((k) => userModulos[k] === true);
  } else {
    // Sem grupo, sem configuração → apenas home e vendas (modules com acesso padrão)
    effectiveFeatures = allTenantFeatures.filter(
      (k) => k === "dashboard_visao_geral" || k === "modulo_vendas"
    );
  }

  const multiEmpresa = (tenantCountRes.count ?? 0) > 1;

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
      features={effectiveFeatures}
    >
      <DashLojaSync lojaId={selectedLojaId} />
      <LojaProvider lojas={lojas} selectedLojaId={selectedLojaId}>
        <PeriodProvider>
          <FilterProvider>
            <div
              className="min-h-screen"
              style={{ backgroundColor: "var(--bg-primary)" }}
            >
              <Sidebar isAdmin={isAdmin} multiEmpresa={multiEmpresa} />

              <div
                style={{ marginLeft: "var(--sidebar-width)" }}
                className="flex flex-col min-h-screen mobile-safe-bottom"
              >
                {children}
              </div>
            </div>
          </FilterProvider>
        </PeriodProvider>
      </LojaProvider>
    </EmpresaProvider>
  );
}
