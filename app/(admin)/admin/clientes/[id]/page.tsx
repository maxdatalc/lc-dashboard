export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getClienteBaseById } from "@/lib/db/clientes-base";
import { ClienteDetalheClient } from "@/components/admin/ClienteDetalheClient";

export default async function ClienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cliente = await getClienteBaseById(id);
  if (!cliente) notFound();

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

      {/* CTA: Criar como Grupo */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
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
      </div>
    </div>
  );
}
