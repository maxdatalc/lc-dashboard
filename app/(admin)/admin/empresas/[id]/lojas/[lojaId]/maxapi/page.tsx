export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getLojaAdminWithMaxApi,
  updateLojaMaxApiConfig,
  listLojasMaxApiStatus,
  applyMaxApiConfigToLojas,
} from "@/lib/db/tenants";
import MaxApiForm, { type MaxApiFormState } from "./maxapi-form";

async function salvarMaxApi(
  lojaId: string,
  tenantId: string,
  _prevState: MaxApiFormState,
  formData: FormData,
): Promise<MaxApiFormState> {
  "use server";

  const maxApiUrl = (formData.get("maxApiUrl") as string ?? "").trim();
  const terminalMaxdata = (formData.get("terminalMaxdata") as string ?? "").trim();

  if (!terminalMaxdata) {
    return { erro: "Informe o terminal.", ok: false, aplicadas: 0 };
  }

  const aplicarEm = ((formData.get("aplicarEm") as string ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean));

  try {
    await updateLojaMaxApiConfig(lojaId, { maxApiUrl, terminalMaxdata });
    const aplicadas = await applyMaxApiConfigToLojas(tenantId, aplicarEm, {
      maxApiUrl,
      terminalMaxdata,
    });
    return { erro: null, ok: true, aplicadas };
  } catch (e) {
    return {
      erro: e instanceof Error ? e.message : "Falha ao salvar configuração.",
      ok: false,
      aplicadas: 0,
    };
  }
}

export default async function MaxApiPage({
  params,
}: {
  params: Promise<{ id: string; lojaId: string }>;
}) {
  const { id: tenantId, lojaId } = await params;
  const loja = await getLojaAdminWithMaxApi(lojaId);

  if (!loja || loja.tenantId !== tenantId) notFound();

  const outrasLojas = await listLojasMaxApiStatus(tenantId, lojaId);
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
          id: loja.id,
          maxApiUrl: loja.maxApiUrl ?? "",
          terminalMaxdata: loja.terminalMaxdata ?? "",
          empId: loja.empId,
          sqlEnabled: loja.sqlEnabled,
        }}
        outrasLojas={outrasLojas}
        tenantId={tenantId}
      />
    </div>
  );
}
