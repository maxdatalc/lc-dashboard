export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAdminRole } from "@/lib/db/admin";
import { getClienteBaseById, getGrupoByCliente } from "@/lib/db/clientes-base";
import { ClienteDetalheClient } from "@/components/admin/ClienteDetalheClient";
import { TokenBridgeInput } from "@/components/admin/TokenBridgeInput";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminButton } from "@/components/admin/AdminButton";

export default async function ClienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await getAdminRole(user.id);
  if (!role) redirect("/dashboard");

  const isAdmin = role === "admin";

  const { id } = await params;
  const cliente = await getClienteBaseById(id);
  if (!cliente) notFound();

  const grupoCadastrado = await getGrupoByCliente(
    cliente.codigo_externo ?? null,
    cliente.cnpj_cpf ?? null
  );

  return (
    <div className="adm-rise max-w-2xl space-y-5 p-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/admin/clientes"
          className="adm-focusable inline-flex items-center gap-1.5 rounded text-xs font-medium transition-colors"
          style={{ color: "var(--adm-text-faint)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Clientes
        </Link>
        <span style={{ color: "var(--adm-line-strong)" }}>·</span>
        <span className="max-w-xs truncate text-xs" style={{ color: "var(--adm-text-faint)" }}>
          {cliente.nome_fantasia || cliente.razao_social}
        </span>
      </div>

      {/* Detalhe editável (admin) ou leitura (suporte) */}
      <ClienteDetalheClient cliente={cliente} isAdmin={isAdmin} />

      {/* Token Bridge SQL — suporte preenche, admin lê */}
      <TokenBridgeInput
        clienteId={cliente.id}
        initialToken={cliente.sql_bridge_token ?? null}
        isAdmin={isAdmin}
      />

      {/* CTA Onboarding — apenas para admin */}
      {isAdmin && (
        <AdminCard
          className="p-4"
          style={grupoCadastrado ? { borderColor: "var(--adm-signal)", background: "var(--adm-signal-soft)" } : undefined}
        >
          {grupoCadastrado ? (
            <>
              <div className="mb-1 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--adm-signal)" }} />
                <p className="text-sm font-semibold" style={{ color: "var(--adm-signal)" }}>Já cadastrado como Grupo</p>
              </div>
              <p className="mb-3 text-xs" style={{ color: "var(--adm-signal)" }}>
                Este cliente já está no sistema como o grupo{" "}
                <span className="font-semibold">{grupoCadastrado.tenantName || "—"}</span>.
              </p>
              <AdminButton href={`/admin/empresas/${grupoCadastrado.tenantId}`} variant="secondary" size="sm">
                <ExternalLink className="h-3.5 w-3.5" />
                Ver Grupo no sistema
              </AdminButton>
            </>
          ) : (
            <>
              <p className="mb-1 text-sm font-semibold" style={{ color: "var(--adm-text)" }}>Onboarding</p>
              <p className="mb-3 text-xs" style={{ color: "var(--adm-text-faint)" }}>
                Quando este cliente for contratado, cadastre-o como um Grupo no sistema.
                {cliente.sql_bridge_token && (
                  <span className="font-medium" style={{ color: "var(--adm-accent)" }}> Token Bridge SQL já preenchido pelo suporte.</span>
                )}
              </p>
              <AdminButton href="/admin/empresas/novo" variant="secondary" size="sm">
                <ExternalLink className="h-3.5 w-3.5" />
                Criar Grupo para este cliente
              </AdminButton>
            </>
          )}
        </AdminCard>
      )}
    </div>
  );
}
