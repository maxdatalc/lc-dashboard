export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLojaAdminWithMaxApi, updateLojaMaxApiConfig } from "@/lib/db/tenants";
import MaxApiForm from "./maxapi-form";

async function salvarMaxApi(
  lojaId: string,
  tenantId: string,
  formData: FormData,
) {
  "use server";

  const maxApiUrl = (formData.get("maxApiUrl") as string).trim();
  const terminalMaxdata = ((formData.get("terminalMaxdata") as string).trim()) || "1";

  await updateLojaMaxApiConfig(lojaId, { maxApiUrl, terminalMaxdata });
  redirect(`/admin/empresas/${tenantId}?aba=lojas`);
}

export default async function MaxApiPage({
  params,
}: {
  params: Promise<{ id: string; lojaId: string }>;
}) {
  const { id: tenantId, lojaId } = await params;
  const loja = await getLojaAdminWithMaxApi(lojaId);

  if (!loja || loja.tenantId !== tenantId) notFound();

  const action = salvarMaxApi.bind(null, lojaId, tenantId);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/empresas/${tenantId}?aba=lojas`}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <span className="text-slate-300">/</span>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Configurar MaxAPI</h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {loja.name} · EmpId {loja.empId}
          </p>
        </div>
      </div>

      <MaxApiForm
        action={action}
        loja={{
          maxApiUrl: loja.maxApiUrl ?? "",
          terminalMaxdata: loja.terminalMaxdata ?? "1",
          empId: loja.empId,
        }}
        tenantId={tenantId}
      />
    </div>
  );
}
