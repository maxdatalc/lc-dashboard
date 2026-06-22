export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { BookUser } from "lucide-react";
import { getAllTenants } from "@/lib/db/admin";
import { EmpresasListClient } from "@/components/admin/EmpresasListClient";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";
import { getClientesBaseStats } from "@/lib/db/clientes-base";

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
  const [tenants, clientesStats] = await Promise.all([
    getAllTenants(),
    getClientesBaseStats(),
  ]);

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div
        className="flex justify-between items-start gap-4 flex-wrap"
        style={{ animation: "fadeInUp 0.3s ease-out both" }}
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Grupos</h1>
          <p className="text-slate-500 text-sm mt-1">
            {tenants.length}{" "}
            {tenants.length === 1 ? "grupo cadastrado" : "grupos cadastrados"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/clientes"
            className="inline-flex items-center gap-2 border border-slate-200 text-slate-700 bg-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 hover:shadow-sm transition-all"
          >
            <BookUser className="h-4 w-4" />
            Base de Clientes
            {clientesStats.total > 0 && (
              <span className="ml-0.5 text-xs bg-slate-100 text-slate-500 font-semibold px-1.5 py-0.5 rounded-full">
                {clientesStats.total}
              </span>
            )}
          </Link>
          <Link
            href="/admin/empresas/novo"
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 hover:shadow-md transition-all hover:-translate-y-px"
          >
            + Novo Grupo
          </Link>
        </div>
      </div>

      <EmpresasListClient
        tenants={tenants}
        acessarDashboard={acessarDashboard}
      />
    </div>
  );
}
