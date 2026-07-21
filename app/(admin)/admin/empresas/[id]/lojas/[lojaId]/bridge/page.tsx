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
          <h1 className="text-2xl font-bold" style={{ color: "var(--adm-text)" }}>Bridge SQL</h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--adm-text-dim)" }}>
            <span className="adm-mono">{loja.name}</span>{" "}
            <span style={{ color: "var(--adm-line-strong)" }}>·</span>{" "}
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
