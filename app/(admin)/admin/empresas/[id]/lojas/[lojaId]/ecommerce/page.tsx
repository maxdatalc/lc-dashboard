export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Plug } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

import { AdminCard } from "@/components/admin/AdminCard";
import EcommerceForm from "./ecommerce-form";

// ─── Helpers de dados ─────────────────────────────────────────────────────────

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

interface EcomLoja {
  slug: string;
  nome_publico: string;
  ativo: boolean;
  logo_url: string | null;
  cor_primaria: string | null;
  whatsapp: string | null;
}

interface MercadoPagoStatus {
  status: "conectado" | "desconectado" | "erro";
}

interface PedidoComErro {
  id: string;
  total: number;
  erp_ultimo_erro: string | null;
  criado_em: string;
}

async function carregarDados(lojaId: string, tenantId: string) {
  const supabase = supabaseAdmin();

  const { data: loja } = await supabase
    .from("lojas")
    .select("id, name, tenant_id")
    .eq("id", lojaId)
    .single<Loja>();

  if (!loja || loja.tenant_id !== tenantId) return null;

  // ecom_lojas é do banco compartilhado com o lc-storefront (Fase 1) — lc-dashboard
  // lê/escreve com service role, bypassando o RLS que só libera `anon` para ativo=true.
  const [{ data: ecomLoja }, { data: mpConfig }] = await Promise.all([
    supabase
      .from("ecom_lojas")
      .select("slug, nome_publico, ativo, logo_url, cor_primaria, whatsapp")
      .eq("loja_id", lojaId)
      .maybeSingle<EcomLoja>(),
    supabase
      .from("mercadopago_configuracoes")
      .select("status")
      .eq("loja_id", lojaId)
      .maybeSingle<MercadoPagoStatus>(),
  ]);

  // Fase 5 — alerta mínimo, só leitura: pedidos que ficaram presos após
  // esgotar as tentativas automáticas de push ao ERP (ver
  // lib/ecommerce/pedidos-erp.ts). Lançamento manual no MaxManager é o
  // último recurso — sem ação nenhuma aqui, gestão completa fica pra Fase 6.
  const { data: clientesDaLoja } = await supabase
    .from("ecom_clientes")
    .select("id")
    .eq("loja_id", lojaId);
  const clienteIds = (clientesDaLoja ?? []).map((c) => c.id as string);

  const { data: pedidosComErro } =
    clienteIds.length > 0
      ? await supabase
          .from("ecom_pedidos")
          .select("id, total, erp_ultimo_erro, criado_em")
          .in("cliente_id", clienteIds)
          .eq("status", "pago_pendente_erp")
          .order("criado_em", { ascending: false })
          .returns<PedidoComErro[]>()
      : { data: [] as PedidoComErro[] };

  return {
    loja,
    ecomLoja,
    mpConectado: mpConfig?.status === "conectado",
    pedidosComErro: pedidosComErro ?? [],
  };
}

// ─── Server Action ────────────────────────────────────────────────────────────

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

async function salvarEcommerceConfig(
  lojaId: string,
  _prevState: { erro: string | null; sucesso?: boolean },
  formData: FormData,
): Promise<{ erro: string | null; sucesso?: boolean }> {
  "use server";

  const slug = ((formData.get("slug") as string) ?? "").trim().toLowerCase();
  const nomePublico = ((formData.get("nomePublico") as string) ?? "").trim();
  const ativo = formData.get("ativo") === "on";
  const logoUrl = ((formData.get("logoUrl") as string) ?? "").trim() || null;
  const corPrimaria = ((formData.get("corPrimaria") as string) ?? "").trim() || null;
  const whatsapp = ((formData.get("whatsapp") as string) ?? "").trim() || null;

  if (!nomePublico) return { erro: "Nome público é obrigatório." };
  if (!SLUG_REGEX.test(slug)) {
    return { erro: "Slug inválido — use só letras minúsculas, números e hífen, com pelo menos 3 caracteres." };
  }

  const supabase = supabaseAdmin();

  const { error } = await supabase.from("ecom_lojas").upsert(
    {
      loja_id: lojaId,
      slug,
      nome_publico: nomePublico,
      ativo,
      logo_url: logoUrl,
      cor_primaria: corPrimaria,
      whatsapp,
    },
    { onConflict: "loja_id" },
  );

  if (error) {
    if (error.code === "23505") {
      return { erro: "Esse slug já está em uso por outra loja. Escolha outro." };
    }
    return { erro: `Erro ao salvar: ${error.message}` };
  }

  return { erro: null, sucesso: true };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function EcommerceConfigPage({
  params,
}: {
  params: Promise<{ id: string; lojaId: string }>;
}) {
  const { id: tenantId, lojaId } = await params;
  const dados = await carregarDados(lojaId, tenantId);

  if (!dados) notFound();

  const { loja, ecomLoja, mpConectado, pedidosComErro } = dados;
  const action = salvarEcommerceConfig.bind(null, lojaId);

  return (
    <div className="adm-rise mx-auto max-w-2xl space-y-6 p-6">
      <div className="space-y-2">
        <Link
          href={`/admin/empresas/${tenantId}?aba=features`}
          className="adm-focusable inline-flex items-center gap-1.5 rounded text-xs font-medium transition-colors"
          style={{ color: "var(--adm-text-faint)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para módulos
        </Link>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--adm-text)" }}>Ecommerce — Vitrine online</h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--adm-text-dim)" }}>
            <span className="adm-mono">{loja.name}</span>
          </p>
        </div>
        <p className="text-sm" style={{ color: "var(--adm-text-dim)" }}>
          Configure o subdomínio público e ligue a vitrine desta loja. O catálogo é sincronizado
          automaticamente a partir dos produtos marcados como &quot;Ecommerce&quot; no MaxManager.
        </p>
      </div>

      <AdminCard className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4" style={{ color: mpConectado ? "var(--adm-signal)" : "var(--adm-text-faint)" }} />
          <p className="text-sm" style={{ color: "var(--adm-text)" }}>
            Pagamento (Mercado Pago): {mpConectado ? "conectado" : "não conectado"}
          </p>
        </div>
        <Link
          href={`/admin/empresas/${tenantId}/lojas/${lojaId}/mercadopago`}
          className="adm-focusable text-xs font-medium"
          style={{ color: "var(--adm-accent)" }}
        >
          Configurar →
        </Link>
      </AdminCard>

      {pedidosComErro.length > 0 && (
        <AdminCard className="space-y-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: "var(--adm-danger, #dc2626)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--adm-text)" }}>
              {pedidosComErro.length} pedido(s) pago(s) travado(s) no envio ao ERP
            </p>
          </div>
          <p className="text-xs" style={{ color: "var(--adm-text-dim)" }}>
            O push automático esgotou as tentativas. Lançar manualmente no MaxManager —
            nunca existe cancelamento/estorno automático pra venda em Supervisão.
          </p>
          <ul className="space-y-2 text-xs">
            {pedidosComErro.map((pedido) => (
              <li key={pedido.id} className="rounded-md border px-3 py-2" style={{ borderColor: "var(--adm-line)" }}>
                <div className="flex items-center justify-between">
                  <span className="adm-mono">{pedido.id}</span>
                  <span>{pedido.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
                <p className="mt-1" style={{ color: "var(--adm-text-dim)" }}>
                  {pedido.erp_ultimo_erro ?? "Erro desconhecido"}
                </p>
              </li>
            ))}
          </ul>
        </AdminCard>
      )}

      <EcommerceForm
        action={action}
        vitrine={{
          slug: ecomLoja?.slug ?? "",
          nomePublico: ecomLoja?.nome_publico ?? loja.name,
          ativo: ecomLoja?.ativo ?? false,
          logoUrl: ecomLoja?.logo_url ?? "",
          corPrimaria: ecomLoja?.cor_primaria ?? "",
          whatsapp: ecomLoja?.whatsapp ?? "",
        }}
        tenantId={tenantId}
      />
    </div>
  );
}
