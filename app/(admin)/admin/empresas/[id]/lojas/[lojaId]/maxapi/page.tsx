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
    <div className="adm-rise mx-auto max-w-2xl space-y-6 p-6">
      <div className="space-y-2">
        <Link
          href={`/admin/empresas/${tenantId}?aba=lojas`}
          className="adm-focusable inline-flex items-center gap-1.5 rounded text-xs font-medium transition-colors"
          style={{ color: "var(--adm-text-faint)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para lojas
        </Link>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--adm-text)" }}>MaxAPI</h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--adm-text-dim)" }}>
            <span className="adm-mono">{loja.name}</span>{" "}
            <span style={{ color: "var(--adm-line-strong)" }}>·</span>{" "}
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
