export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLojaAdmin, updateLojaSqlConfig } from "@/lib/db/tenants";
import BridgeForm from "./bridge-form";

async function salvarBridge(
  lojaId: string,
  tenantId: string,
  tokenAtual: string | null,
  formData: FormData
) {
  "use server";

  const bridgeUrl = (formData.get("bridgeUrl") as string).trim();
  const novoToken = (formData.get("token") as string).trim();
  const enabled = formData.get("enabled") === "on";

  const token = novoToken !== "" ? novoToken : (tokenAtual ?? "");

  if (enabled && (!bridgeUrl || !token)) {
    throw new Error("URL e token são obrigatórios para habilitar a bridge.");
  }

  await updateLojaSqlConfig(lojaId, { bridgeUrl, token, enabled });
  redirect(`/admin/empresas/${tenantId}?aba=lojas`);
}

export default async function BridgePage({
  params,
}: {
  params: Promise<{ id: string; lojaId: string }>;
}) {
  const { id: tenantId, lojaId } = await params;
  const loja = await getLojaAdmin(lojaId);

  if (!loja || loja.tenantId !== tenantId) notFound();

  const action = salvarBridge.bind(null, lojaId, tenantId, loja.bridgeToken);

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
          <h1 className="text-2xl font-bold text-slate-900">Bridge SQL</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-mono">{loja.name}</span>{" "}
            <span className="text-slate-300">·</span>{" "}
            EmpId {loja.empId}
          </p>
        </div>
      </div>

      <BridgeForm
        action={action}
        loja={{
          sqlEnabled: loja.sqlEnabled,
          bridgeUrl: loja.bridgeUrl ?? "",
          hasToken: !!loja.bridgeToken,
        }}
        lojaId={lojaId}
        tenantId={tenantId}
      />
    </div>
  );
}
