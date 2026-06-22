export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, CheckCircle2 } from "lucide-react";
import { getClienteBaseById, getGrupoByCnpj } from "@/lib/db/clientes-base";
import { ClienteDetalheClient } from "@/components/admin/ClienteDetalheClient";

export default async function ClienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cliente = await getClienteBaseById(id);
  if (!cliente) notFound();

  const grupoCadastrado = cliente.cnpj_cpf
    ? await getGrupoByCnpj(cliente.cnpj_cpf)
    : null;

  return (
    <div className="p-6 max-w-2xl space-y-5" style={{ animation: "fadeInUp 0.3s ease-out both" }}>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/admin/clientes"
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-xs font-medium transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Clientes
        </Link>
        <span className="text-slate-300">·</span>
        <span className="text-xs text-slate-400 truncate max-w-xs">{cliente.nome_fantasia || cliente.razao_social}</span>
      </div>

      {/* Detalhe editável */}
      <ClienteDetalheClient cliente={cliente} />

      {/* CTA: Onboarding */}
      <div className={`rounded-xl border p-4 ${grupoCadastrado ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
        {grupoCadastrado ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-sm font-semibold text-emerald-800">Já cadastrado como Grupo</p>
            </div>
            <p className="text-xs text-emerald-700 mb-3">
              Este cliente já está no sistema como o grupo{" "}
              <span className="font-semibold">{grupoCadastrado.tenantName || "—"}</span>.
            </p>
            <Link
              href={`/admin/empresas/${grupoCadastrado.tenantId}`}
              className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 border border-emerald-200 bg-white px-3.5 py-2 rounded-lg hover:bg-emerald-50 hover:shadow-sm transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver Grupo no sistema
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-700 mb-1">Onboarding</p>
            <p className="text-xs text-slate-400 mb-3">
              Quando este cliente for contratado, cadastre-o como um Grupo no sistema.
            </p>
            <Link
              href="/admin/empresas/novo"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 border border-slate-200 bg-white px-3.5 py-2 rounded-lg hover:bg-slate-100 hover:shadow-sm transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Criar Grupo para este cliente
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
