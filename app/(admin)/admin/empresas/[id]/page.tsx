export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, Settings, Users, Zap } from "lucide-react";
import {
  getTenantByIdAdmin,
  updateTenantFeatures,
  getUsuariosTenantDetalhado,
} from "@/lib/db/admin";
import { FEATURES_CATALOG, getCoreFeatures } from "@/lib/features";
import { LojasSectionClient } from "@/components/admin/LojasSectionClient";
import { UsuariosSectionClient } from "@/components/admin/UsuariosSectionClient";

type Aba = "lojas" | "features" | "usuarios";

// ── Server Actions ────────────────────────────────────────────────────────────

async function salvarFeatures(tenantId: string, formData: FormData) {
  "use server";
  const features = formData.getAll("feature").map(String);
  const featuresFinais = Array.from(new Set([...getCoreFeatures(), ...features]));
  await updateTenantFeatures(tenantId, featuresFinais);
  redirect(`/admin/empresas/${tenantId}?aba=features`);
}

async function ativarPremium(tenantId: string) {
  "use server";
  const todasPremium = FEATURES_CATALOG.filter((f) => f.disponivel).map((f) => f.key);
  const featuresFinais = Array.from(new Set([...getCoreFeatures(), ...todasPremium]));
  await updateTenantFeatures(tenantId, featuresFinais);
  redirect(`/admin/empresas/${tenantId}?aba=features`);
}

async function downgradeFree(tenantId: string) {
  "use server";
  await updateTenantFeatures(tenantId, getCoreFeatures());
  redirect(`/admin/empresas/${tenantId}?aba=features`);
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

  const coreFeatures = FEATURES_CATALOG.filter((f) => f.categoria === "core");
  const MODULOS_PRINCIPAIS_KEYS = ["modulo_vendas", "modulo_financeiro", "modulo_produtos"];
  const modulosPrincipais = FEATURES_CATALOG.filter((f) =>
    MODULOS_PRINCIPAIS_KEYS.includes(f.key)
  );
  const outrosModulos = FEATURES_CATALOG.filter(
    (f) => f.categoria === "premium" && !MODULOS_PRINCIPAIS_KEYS.includes(f.key)
  );
  const algumOutroAtivo = outrosModulos.some((f) => tenant.features.includes(f.key));

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
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">
              {tenant.name}
            </h1>
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
          </div>

          {/* Badge de plano */}
          {tenant.plan === "premium" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-sm font-semibold text-amber-700 shrink-0">
              ★ Premium
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-500 shrink-0">
              Free
            </span>
          )}
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
          <div className="space-y-5">

            {/* Seletor rápido de plano */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Plano atual</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Atalho para ativar ou remover todos os módulos de uma vez.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <form action={downgradeFree.bind(null, id)}>
                    <button
                      type="submit"
                      disabled={tenant.plan === "free"}
                      className="px-4 py-2 rounded-lg text-sm font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={
                        tenant.plan === "free"
                          ? { backgroundColor: "#0f172a", color: "#fff", borderColor: "#0f172a" }
                          : { backgroundColor: "transparent", color: "#64748b", borderColor: "#e2e8f0" }
                      }
                    >
                      Free
                    </button>
                  </form>
                  <form action={ativarPremium.bind(null, id)}>
                    <button
                      type="submit"
                      disabled={tenant.plan === "premium"}
                      className="px-4 py-2 rounded-lg text-sm font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={
                        tenant.plan === "premium"
                          ? { backgroundColor: "#d97706", color: "#fff", borderColor: "#d97706" }
                          : { backgroundColor: "transparent", color: "#64748b", borderColor: "#e2e8f0" }
                      }
                    >
                      ★ Premium
                    </button>
                  </form>
                </div>
              </div>
            </div>

            <form action={salvarFeatures.bind(null, id)} className="space-y-4">

              {/* Core features — sempre ativas */}
              {coreFeatures.map((f) => (
                <div
                  key={f.key}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">{f.label}</p>
                    <p className="text-xs text-slate-400">{f.descricao}</p>
                  </div>
                  <div className="w-8 h-4 bg-slate-300 rounded-full shrink-0 cursor-not-allowed" title="Sempre ativo" />
                </div>
              ))}

              {/* Módulos principais */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {modulosPrincipais.map((f) => {
                  const ativo = tenant.features.includes(f.key);
                  return (
                    <label
                      key={f.key}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:-translate-y-px hover:shadow-sm ${
                        ativo ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200"
                      } ${!f.disponivel ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <input
                        type="checkbox"
                        name="feature"
                        value={f.key}
                        defaultChecked={ativo}
                        disabled={!f.disponivel}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-700">{f.label}</p>
                          {!f.disponivel && (
                            <span className="text-xs bg-slate-100 text-slate-500 px-1.5 rounded">
                              Em breve
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{f.descricao}</p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Outros módulos */}
              <details open={algumOutroAtivo} className="group rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer select-none list-none hover:bg-slate-100 transition-colors">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Outros módulos
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
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white">
                  {outrosModulos.map((f) => {
                    const ativo = tenant.features.includes(f.key);
                    return (
                      <label
                        key={f.key}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:-translate-y-px hover:shadow-sm ${
                          ativo ? "bg-purple-50 border-purple-200" : "bg-white border-slate-200"
                        } ${!f.disponivel ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        <input
                          type="checkbox"
                          name="feature"
                          value={f.key}
                          defaultChecked={ativo}
                          disabled={!f.disponivel}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-slate-700">{f.label}</p>
                            {!f.disponivel && (
                              <span className="text-xs bg-slate-100 text-slate-500 px-1.5 rounded">
                                Em breve
                              </span>
                            )}
                            {f.key === "modulo_os" && f.disponivel && (
                              <Link
                                href={`/admin/empresas/${id}/modulo-os`}
                                className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                                title="Configurações do módulo OS"
                              >
                                <Settings className="h-3.5 w-3.5" />
                                Configurar
                              </Link>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">{f.descricao}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </details>

              <button
                type="submit"
                className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 hover:shadow-md transition-all hover:-translate-y-px"
              >
                Salvar módulos
              </button>
            </form>
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
