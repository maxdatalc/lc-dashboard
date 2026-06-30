export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { BookUser } from "lucide-react";
import { getAllTenants, isSystemAdmin, getAdminRole } from "@/lib/db/admin";
import { EmpresasListClient } from "@/components/admin/EmpresasListClient";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getClientesBaseStats } from "@/lib/db/clientes-base";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminButton } from "@/components/admin/AdminButton";

async function acessarDashboard(formData: FormData) {
  "use server";
  const tenantId = formData.get("tenantId") as string;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isSystemAdmin(user.id)) redirect("/admin");

  const admin = createAdminClient();

  const { data: loja } = await admin
    .from("lojas")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const cookieStore = await cookies();
  const domain = process.env.NODE_ENV === "production" ? ".lcgestor.com.br" : undefined;
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    ...(domain ? { domain } : {}),
  };
  cookieStore.set("selected_tenant_id", tenantId, opts);
  if (loja?.id) cookieStore.set("selected_loja_id", loja.id, opts);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.lcgestor.com.br";
  redirect(`${appUrl}/dashboard`);
}

export default async function AdminEmpresasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await getAdminRole(user.id);
  if (!role) redirect("/dashboard");

  const isAdmin = role === "admin";

  const [tenants, clientesStats] = await Promise.all([
    getAllTenants(),
    getClientesBaseStats(),
  ]);

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        eyebrow="Operação"
        title="Grupos"
        subtitle={`${tenants.length} ${tenants.length === 1 ? "grupo cadastrado" : "grupos cadastrados"}`}
        actions={
          <>
            <AdminButton href="/admin/clientes" variant="secondary">
              <BookUser className="h-4 w-4" />
              Base de Clientes
              {clientesStats.total > 0 && (
                <span
                  className="adm-mono ml-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold"
                  style={{ background: "var(--adm-surface-3)", color: "var(--adm-text-dim)" }}
                >
                  {clientesStats.total}
                </span>
              )}
            </AdminButton>
            {isAdmin && (
              <AdminButton href="/admin/empresas/novo" variant="primary">
                + Novo Grupo
              </AdminButton>
            )}
          </>
        }
      />

      <EmpresasListClient
        tenants={tenants}
        acessarDashboard={isAdmin ? acessarDashboard : undefined}
        isAdmin={isAdmin}
      />
    </div>
  );
}
