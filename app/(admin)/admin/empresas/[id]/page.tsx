export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, ExternalLink, Settings, Users, Zap } from "lucide-react";
import {
  getTenantByIdAdmin,
  updateTenantFeatures,
  updateTenantPlan,
  updateTenantCodigoExterno,
  getUsuariosTenantDetalhado,
} from "@/lib/db/admin";
import { FEATURES_CATALOG, getCoreFeatures } from "@/lib/features";
import { LojasSectionClient } from "@/components/admin/LojasSectionClient";
import { UsuariosSectionClient } from "@/components/admin/UsuariosSectionClient";
import { EditNomeTenantClient } from "@/components/admin/EditNomeTenantClient";
import { selecionarEmpresaAdmin } from "@/app/actions/auth";

type Aba = "lojas" | "features" | "usuarios";

// ── Server Actions ────────────────────────────────────────────────────────────

async function salvarFeatures(tenantId: string, formData: FormData) {
  "use server";
  const features = formData.getAll("feature").map(String);
  const featuresFinais = Array.from(new Set([...getCoreFeatures(), ...features]));
  await updateTenantFeatures(tenantId, featuresFinais);
  redirect(`/admin/empresas/${tenantId}?aba=features`);
}

async function alterarPlano(tenantId: string, formData: FormData) {
  "use server";
  const novoPlano = formData.get("plano") as "free" | "premium";
  if (novoPlano !== "free" && novoPlano !== "premium") return;
  await updateTenantPlan(tenantId, novoPlano);
  redirect(`/admin/empresas/${tenantId}`);
}

async function salvarCodigoExterno(tenantId: string, formData: FormData) {
  "use server";
  const codigo = (formData.get("codigo_externo") as string | null)?.trim() || null;
  await updateTenantCodigoExterno(tenantId, codigo);
  redirect(`/admin/empresas/${tenantId}`);
}

// ── Componente ────────────────────────────────────────────────────────────────

export default async function GerenciarEmpresaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const { id } = await params;
  const { aba: abaParam } = await searchParams;
  const abaAtiva: Aba = (["lojas", "features", "usuarios"].includes(abaParam ?? "")
    ? abaParam
    : "lojas") as Aba;

  const tenant = await getTenantByIdAdmin(id);
  if (!tenant) notFound();

  const usuarios = abaAtiva === "usuarios" ? await getUsuariosTenantDetalhado(id) : [];

  const emBreveFeatures  = FEATURES_CATALOG.filter((f) => !f.disponivel);
  const addonFeatures    = FEATURES_CATALOG.filter(
    (f) => f.disponivel && f.categoria === "premium"
  );

  const ABAS = [
    { valor: "lojas" as Aba, label: "Lojas", icon: Building2, count: tenant.lojas.length },
    { valor: "features" as Aba, label: "Módulos", icon: Zap },
    { valor: "usuarios" as Aba, label: "Usuários", icon: Users },
  ];

  return (
    <div className="p-6 space-y-6">

      {/* Cabeçalho */}
      <div
        className="space-y-3"
        style={{ animation: "fadeInUp 0.3s ease-out both" }}
      >
        {/* Breadcrumb */}
        <Link
          href="/admin/empresas"
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-xs font-medium transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Todas as empresas
        </Link>

        {/* Título + badges */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <EditNomeTenantClient tenantId={id} currentName={tenant.name} />
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs text-slate-400 font-mono">{tenant.slug}</span>
              <span className="text-slate-300">·</span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Building2 className="h-3.5 w-3.5" />
                {tenant.lojas.length}{" "}
                {tenant.lojas.length === 1 ? "loja" : "lojas"}
              </span>
              <span className="text-slate-300">·</span>
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  tenant.isActive ? "bg-emerald-400" : "bg-slate-300"
                }`}
              />
              <span className="text-xs text-slate-400">
                {tenant.isActive ? "Ativa" : "Inativa"}
              </span>
            </div>

            {/* Código externo — identificador no sistema do cliente */}
            <form action={salvarCodigoExterno.bind(null, id)} className="flex items-center gap-2 mt-3">
              <label className="text-xs text-slate-500 font-semibold shrink-0">Cód. externo:</label>
              <input
                name="codigo_externo"
                defaultValue={tenant.codigoExterno ?? ""}
                placeholder="ex: 15786"
                className="text-xs font-mono border border-slate-300 rounded px-2 py-1 text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 w-28"
              />
              <button
                type="submit"
                className="text-xs font-semibold text-slate-700 border border-slate-300 bg-white rounded px-2.5 py-1 hover:bg-slate-50 hover:border-slate-400 transition-colors"
              >
                Salvar
              </button>
            </form>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Toggle de plano */}
            <form action={alterarPlano.bind(null, id)}>
              <input
                type="hidden"
                name="plano"
                value={tenant.plan === "premium" ? "free" : "premium"}
              />
              <button
                type="submit"
                title={tenant.plan === "premium" ? "Clique para mudar para Free" : "Clique para mudar para Premium"}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all hover:shadow-sm hover:-translate-y-px ${
                  tenant.plan === "premium"
                    ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                    : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {tenant.plan === "premium" ? "★ Premium" : "Free"}
                <span className="text-[10px] opacity-60 font-normal">
                  {tenant.plan === "premium" ? "→ free" : "→ premium"}
                </span>
              </button>
            </form>

            {/* Acessar dashboard desta empresa */}
            <form action={selecionarEmpresaAdmin}>
              <input type="hidden" name="tenantId" value={id} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver dashboard
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-0.5 border-b border-slate-200"
        style={{ animation: "fadeInUp 0.35s ease-out both", animationDelay: "50ms" }}
      >
        {ABAS.map((a) => {
          const isActive = abaAtiva === a.valor;
          return (
            <Link
              key={a.valor}
              href={`/admin/empresas/${id}?aba=${a.valor}`}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all duration-150 ${
                isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300"
              }`}
            >
              <a.icon className="h-4 w-4" />
              {a.label}
              {a.count !== undefined && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-semibold transition-colors ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {a.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Conteúdo das abas */}
      <div style={{ animation: "fadeInUp 0.3s ease-out both", animationDelay: "80ms" }}>

        {/* ── Aba Lojas ────────────────────────────────────────────────────── */}
        {abaAtiva === "lojas" && (
          <LojasSectionClient lojas={tenant.lojas} tenantId={id} />
        )}

        {/* ── Aba Módulos ──────────────────────────────────────────────────── */}
        {abaAtiva === "features" && (
          <div className="space-y-4">

            {/* Incluídos gratuitamente — read-only */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Incluídos em todos os planos</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Disponíveis para todos os clientes sem custo adicional.</p>
                </div>
                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-semibold shrink-0">
                  Grátis
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { label: "Dashboard Visão Geral", descricao: "KPIs, gráficos e indicadores gerenciais" },
                  { label: "Financeiro", descricao: "Contas a receber, inadimplência e fluxo de caixa" },
                  { label: "Produtos & Estoque", descricao: "Catálogo, níveis de estoque e alertas de ruptura" },
                ].map((m) => (
                  <div key={m.label} className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{m.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{m.descricao}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add-ons opcionais — dinâmico via FEATURES_CATALOG */}
            <form action={salvarFeatures.bind(null, id)} className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-1">Add-ons opcionais</h3>
                <p className="text-xs text-slate-400 mb-4">Módulos que requerem ativação e configuração específica por empresa.</p>

                <div className="space-y-3">
                  {addonFeatures.map((f) => {
                    const ativo = tenant.features.includes(f.key);
                    return (
                      <div key={f.key}>
                        <label
                          className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all hover:-translate-y-px hover:shadow-sm ${
                            ativo ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            name="feature"
                            value={f.key}
                            defaultChecked={ativo}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800">{f.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{f.descricao}</p>
                          </div>
                        </label>

                        {/* Link de configuração específica do módulo OS */}
                        {f.key === "modulo_os" && ativo && (
                          <div className="mt-2 pl-4 border-l-2 border-blue-200">
                            <Link
                              href={`/admin/empresas/${id}/modulo-os`}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                            >
                              <Settings className="h-3 w-3" />
                              Configurar inventários e tipos fiscais
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 hover:shadow-md transition-all hover:-translate-y-px"
              >
                Salvar
              </button>
            </form>

            {/* Em breve */}
            <details className="group rounded-xl border border-slate-200 overflow-hidden">
              <summary className="flex items-center justify-between px-5 py-3.5 bg-slate-50 cursor-pointer select-none list-none hover:bg-slate-100 transition-colors">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Em breve — {emBreveFeatures.length} módulos
                </span>
                <svg
                  className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white">
                {emBreveFeatures.map((f) => (
                  <div
                    key={f.key}
                    className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-400">{f.label}</p>
                        <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-medium">
                          Em breve
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{f.descricao}</p>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        {/* ── Aba Usuários ─────────────────────────────────────────────────── */}
        {abaAtiva === "usuarios" && (
          <UsuariosSectionClient
            tenantId={id}
            usuarios={usuarios}
            lojas={tenant.lojas.map((l) => ({
              id: l.id,
              name: l.name,
              bridgeEnabled: l.sqlEnabled,
              empId: l.empId,
            }))}
            tenantFeatures={tenant.features}
          />
        )}
      </div>
    </div>
  );
}
