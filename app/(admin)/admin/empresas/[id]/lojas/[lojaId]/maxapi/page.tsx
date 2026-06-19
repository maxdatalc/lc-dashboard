export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLojaAdminWithMaxApi, updateLojaMaxApiConfig } from "@/lib/db/tenants";
import MaxApiForm from "./maxapi-form";

async function salvarMaxApi(
  lojaId: string,
  tenantId: string,
  _prevState: { erro: string | null },
  formData: FormData,
): Promise<{ erro: string | null }> {
  "use server";

  const maxApiUrl = (formData.get("maxApiUrl") as string ?? "").trim();
  const terminalMaxdata = ((formData.get("terminalMaxdata") as string ?? "").trim()) || "1";

  try {
    await updateLojaMaxApiConfig(lojaId, { maxApiUrl, terminalMaxdata });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao salvar configuração." };
  }

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
      <div className="space-y-2" style={{ animation: "fadeInUp 0.3s ease-out both" }}>
        <Link
          href={`/admin/empresas/${tenantId}?aba=lojas`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para lojas
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">MaxAPI</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-mono">{loja.name}</span>{" "}
            <span className="text-slate-300">·</span>{" "}
            EmpId {loja.empId}
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
