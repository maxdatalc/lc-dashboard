"use client";

import { useState, useTransition } from "react";
import { loginStep1, loginStep2 } from "@/app/actions/auth";
import type { TenantOption } from "@/app/actions/auth";

type Step = "credentials" | "select-company";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);

    startTransition(async () => {
      const result = await loginStep1(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.tenants && result.tenants.length > 0) {
        setTenants(result.tenants);
        setSelectedTenant(result.tenants[0].id);
        setStep("select-company");
      }
    });
  }

  function handleSelectCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTenant) return;
    setError(null);

    startTransition(async () => {
      await loginStep2(selectedTenant);
    });
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      {/* Padrão de grade sutil no fundo */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 3h4v4H3V3zM9 3h4v4H9V3zM3 9h4v4H3V9zM9 9h4v4H9V9z"
                  fill="white"
                  fillOpacity="0.9"
                />
              </svg>
            </div>
            <span className="text-white font-semibold text-lg tracking-tight">
              LC Gestor
            </span>
          </div>
          <p className="text-slate-500 text-sm">
            {step === "credentials"
              ? "Entre na sua conta"
              : "Selecione a empresa"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#16181f] border border-white/[0.06] rounded-2xl p-8 shadow-2xl">
          {/* Indicador de etapas */}
          <div className="flex items-center gap-2 mb-6">
            <div
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                step === "credentials" ? "text-violet-400" : "text-slate-500"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                  step === "credentials"
                    ? "bg-violet-500 text-white"
                    : "bg-emerald-500 text-white"
                }`}
              >
                {step === "credentials" ? "1" : "✓"}
              </div>
              Acesso
            </div>
            <div className="flex-1 h-px bg-white/[0.06]" />
            <div
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                step === "select-company"
                  ? "text-violet-400"
                  : "text-slate-600"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                  step === "select-company"
                    ? "bg-violet-500 text-white"
                    : "bg-white/[0.06] text-slate-600"
                }`}
              >
                2
              </div>
              Empresa
            </div>
          </div>

          {/* Etapa 1 — Credenciais */}
          {step === "credentials" && (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  required
                  disabled={isPending}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-all disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={isPending}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-all disabled:opacity-50"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-2.5">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    className="shrink-0"
                  >
                    <circle
                      cx="7"
                      cy="7"
                      r="6"
                      stroke="#f87171"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M7 4v3.5M7 9.5v.5"
                      stroke="#f87171"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-sm font-medium rounded-lg py-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <svg
                      className="animate-spin w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Verificando...
                  </>
                ) : (
                  <>
                    Continuar
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                    >
                      <path
                        d="M3 7h8M7 3l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Etapa 2 — Seleção de empresa */}
          {step === "select-company" && (
            <form onSubmit={handleSelectCompany} className="space-y-4">
              <div className="space-y-2">
                {tenants.map((tenant) => (
                  <label
                    key={tenant.id}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedTenant === tenant.id
                        ? "border-violet-500/50 bg-violet-500/10"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="tenant"
                      value={tenant.id}
                      checked={selectedTenant === tenant.id}
                      onChange={() => setSelectedTenant(tenant.id)}
                      className="sr-only"
                    />
                    {/* Avatar da empresa */}
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 border border-white/[0.08] flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-slate-300 uppercase">
                        {tenant.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {tenant.name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {tenant.slug}
                      </p>
                    </div>
                    {/* Indicador de seleção */}
                    <div
                      className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                        selectedTenant === tenant.id
                          ? "border-violet-500 bg-violet-500"
                          : "border-slate-600"
                      }`}
                    >
                      {selectedTenant === tenant.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-2.5">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isPending || !selectedTenant}
                className="w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-sm font-medium rounded-lg py-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <svg
                      className="animate-spin w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Entrando...
                  </>
                ) : (
                  "Entrar no Dashboard"
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("credentials");
                  setError(null);
                }}
                disabled={isPending}
                className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
              >
                ← Usar outra conta
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Acesso restrito ·{" "}
          <span className="text-slate-500">contato@lcgestor.com.br</span>
        </p>
      </div>
    </div>
  );
}
