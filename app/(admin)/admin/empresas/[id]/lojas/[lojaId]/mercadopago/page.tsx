export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

import { AdminCard } from "@/components/admin/AdminCard";
import MercadoPagoCard from "./mercadopago-card";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

interface Loja {
  id: string;
  name: string;
  tenant_id: string;
}

interface MercadoPagoConfig {
  mp_user_id: string | null;
  live_mode: boolean;
  status: "conectado" | "desconectado" | "erro";
  conectado_em: string | null;
}

async function carregarDados(lojaId: string, tenantId: string) {
  const supabase = supabaseAdmin();

  const { data: loja } = await supabase
    .from("lojas")
    .select("id, name, tenant_id")
    .eq("id", lojaId)
    .single<Loja>();

  if (!loja || loja.tenant_id !== tenantId) return null;

  const { data: config } = await supabase
    .from("mercadopago_configuracoes")
    .select("mp_user_id, live_mode, status, conectado_em")
    .eq("loja_id", lojaId)
    .maybeSingle<MercadoPagoConfig>();

  return { loja, config };
}

/**
 * Desconecta a loja do Mercado Pago: limpa os tokens armazenados (nunca
 * chama a API do MP para revogar — não documentado/garantido da mesma
 * forma; simplesmente paramos de usar a credencial local).
 */
async function desconectarMercadoPago(lojaId: string, tenantId: string): Promise<void> {
  "use server";

  const supabase = supabaseAdmin();
  await supabase
    .from("mercadopago_configuracoes")
    .update({
      status: "desconectado",
      desconectado_em: new Date().toISOString(),
      access_token: null,
      refresh_token: null,
    })
    .eq("loja_id", lojaId);

  const { redirect } = await import("next/navigation");
  redirect(`/admin/empresas/${tenantId}/lojas/${lojaId}/mercadopago`);
}

export default async function MercadoPagoConfigPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; lojaId: string }>;
  searchParams: Promise<{ conectado?: string; erro?: string }>;
}) {
  const { id: tenantId, lojaId } = await params;
  const { conectado, erro } = await searchParams;

  const dados = await carregarDados(lojaId, tenantId);
  if (!dados) notFound();

  const { loja, config } = dados;
  const action = desconectarMercadoPago.bind(null, lojaId, tenantId);

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
          <h1 className="text-2xl font-bold" style={{ color: "var(--adm-text)" }}>
            Mercado Pago — Pagamento (PIX)
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--adm-text-dim)" }}>
            <span className="adm-mono">{loja.name}</span>
          </p>
        </div>
        <p className="text-sm" style={{ color: "var(--adm-text-dim)" }}>
          Cada loja conecta sua própria conta Mercado Pago — não existe conta central da
          plataforma. O pagamento PIX do storefront é gerado em nome da conta conectada aqui.
        </p>
      </div>

      {conectado === "1" && (
        <AdminCard
          className="px-4 py-3"
          style={{ background: "var(--adm-signal-soft)", border: "1px solid var(--adm-signal)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--adm-signal)" }}>
            Conta conectada com sucesso.
          </p>
        </AdminCard>
      )}

      {erro === "oauth_cancelado" && (
        <AdminCard
          className="px-4 py-3"
          style={{ background: "var(--adm-warn-soft)", border: "1px solid var(--adm-warn)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--adm-warn)" }}>
            Conexão cancelada — a autorização não foi concluída no Mercado Pago.
          </p>
        </AdminCard>
      )}

      {erro === "falha_oauth" && (
        <AdminCard
          className="px-4 py-3"
          style={{ background: "var(--adm-alert-soft)", border: "1px solid var(--adm-alert)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--adm-alert)" }}>
            Não foi possível concluir a conexão. Tente novamente.
          </p>
        </AdminCard>
      )}

      <MercadoPagoCard
        lojaId={lojaId}
        tenantId={tenantId}
        conectado={config?.status === "conectado"}
        comErro={config?.status === "erro"}
        dados={
          config
            ? {
                mpUserId: config.mp_user_id,
                liveMode: config.live_mode,
                conectadoEm: config.conectado_em,
              }
            : null
        }
        action={action}
      />
    </div>
  );
}
