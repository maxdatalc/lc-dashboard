// Página de gerenciamento de uma empresa — abas: Lojas | Módulos | Usuários
// Server Component com Server Action para atualização de features
// force-dynamic garante que cada visita busca dados frescos do banco (sem Router Cache stale)
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getTenantByIdAdmin,
  updateTenantFeatures,
  getUsuariosTenant,
} from "@/lib/db/admin";
import { FEATURES_CATALOG, getCoreFeatures } from "@/lib/features";
import { LojasSectionClient } from "@/components/admin/LojasSectionClient";
import { UsuariosSectionClient } from "@/components/admin/UsuariosSectionClient";

type Aba = "lojas" | "features" | "usuarios";

// ── Server Actions ───────────────────────────────────────────────────────────

async function salvarFeatures(tenantId: string, formData: FormData) {
  "use server";
  const features = formData.getAll("feature").map(String);
  const featuresFinais = Array.from(new Set([...getCoreFeatures(), ...features]));
  await updateTenantFeatures(tenantId, featuresFinais);
  redirect(`/admin/empresas/${tenantId}?aba=features`);
}

async function ativarPremium(tenantId: string) {
  "use server";
  const todasPremium = FEATURES_CATALOG
    .filter((f) => f.disponivel)
    .map((f) => f.key);
  const featuresFinais = Array.from(new Set([...getCoreFeatures(), ...todasPremium]));
  await updateTenantFeatures(tenantId, featuresFinais);
  redirect(`/admin/empresas/${tenantId}?aba=features`);
}

async function downgradeFree(tenantId: string) {
  "use server";
  await updateTenantFeatures(tenantId, getCoreFeatures());
  redirect(`/admin/empresas/${tenantId}?aba=features`);
}

// ── Componente ──────────────────────────────────────────────────────────────

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

  const usuarios = abaAtiva === "usuarios" ? await getUsuariosTenant(id) : [];

  const coreFeatures = FEATURES_CATALOG.filter((f) => f.categoria === "core");
  const premiumFeatures = FEATURES_CATALOG.filter((f) => f.categoria === "premium");

  const ABAS: { valor: Aba; label: string }[] = [
    { valor: "lojas", label: "Lojas" },
    { valor: "features", label: "Módulos" },
    { valor: "usuarios", label: "Usuários" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/admin/empresas"
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Empresas
        </Link>
        <span className="text-slate-300">/</span>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{tenant.name}</h1>
          <span className="text-xs text-slate-400 font-mono">{tenant.slug}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {tenant.plan === "premium" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
              ★ Premium
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
              Free
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {ABAS.map((a) => (
          <Link
            key={a.valor}
            href={`/admin/empresas/${id}?aba=${a.valor}`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              abaAtiva === a.valor
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {a.label}
          </Link>
        ))}
      </div>

      {/* ── Aba Lojas ─────────────────────────────────────────────────────── */}
      {abaAtiva === "lojas" && (
        <LojasSectionClient lojas={tenant.lojas} tenantId={id} />
      )}

      {/* ── Aba Módulos ───────────────────────────────────────────────────── */}
      {abaAtiva === "features" && (
        <div className="space-y-6">
          {/* Seletor rápido de plano */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-slate-800">Plano atual</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Altere diretamente ou selecione módulos individualmente abaixo.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <form action={downgradeFree.bind(null, id)}>
                  <button
                    type="submit"
                    disabled={tenant.plan === "free"}
                    className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={
                      tenant.plan === "free"
                        ? { backgroundColor: "#1e293b", color: "#fff", borderColor: "#1e293b" }
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
                    className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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

        <form action={salvarFeatures.bind(null, id)} className="space-y-6">
          {/* Core — sempre ativas, sem toggle */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              Core (sempre incluídos)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {coreFeatures.map((f) => (
                <div
                  key={f.key}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">{f.label}</p>
                    <p className="text-xs text-slate-400">{f.descricao}</p>
                  </div>
                  <div className="w-8 h-4 bg-slate-300 rounded-full shrink-0 cursor-not-allowed" />
                </div>
              ))}
            </div>
          </div>

          {/* Premium — checkboxes */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              Premium
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {premiumFeatures.map((f) => {
                const ativo = tenant.features.includes(f.key);
                return (
                  <label
                    key={f.key}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
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
                      <div className="flex items-center gap-2">
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
          </div>

          <button
            type="submit"
            className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            Salvar módulos
          </button>
        </form>
        </div>
      )}

      {/* ── Aba Usuários ──────────────────────────────────────────────────── */}
      {abaAtiva === "usuarios" && (
        <UsuariosSectionClient tenantId={id} usuarios={usuarios} />
      )}

    </div>
  );
}
