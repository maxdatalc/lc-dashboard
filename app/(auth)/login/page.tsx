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
    <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center p-4">
      {/* Padrão de grade sutil no fundo */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(#2563eb 1px, transparent 1px), linear-gradient(90deg, #2563eb 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-200">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 5.5L8 3L16 7.5V12.5L12 15L4 10.5V5.5Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M4 5.5L12 10L16 7.5M12 10V15" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="text-left">
              <span className="text-slate-900 font-bold text-xl tracking-tight block leading-tight">
                LC Gestor
              </span>
              <span className="text-blue-500 text-xs font-medium tracking-wide">
                LC Tecnologia
              </span>
            </div>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            {step === "credentials" ? "Entre na sua conta" : "Selecione a empresa"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-blue-100 rounded-2xl p-8 shadow-xl shadow-blue-100/50">
          {/* Indicador de etapas */}
          <div className="flex items-center gap-2 mb-6">
            <div
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                step === "credentials" ? "text-blue-500" : "text-slate-500"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                  step === "credentials"
                    ? "bg-blue-600 text-white"
                    : "bg-emerald-500 text-white"
                }`}
              >
                {step === "credentials" ? "1" : "✓"}
              </div>
              Acesso
            </div>
            <div className="flex-1 h-px bg-slate-200" />
            <div
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                step === "select-company" ? "text-blue-500" : "text-slate-400"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                  step === "select-company"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-400"
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
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all disabled:opacity-50"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
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
                      stroke="#dc2626"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M7 4v3.5M7 9.5v.5"
                      stroke="#dc2626"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-medium rounded-lg py-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
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
                        ? "border-blue-500/50 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/30"
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
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-white uppercase">
                        {tenant.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {tenant.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {tenant.slug}
                      </p>
                    </div>
                    {/* Indicador de seleção */}
                    <div
                      className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                        selectedTenant === tenant.id
                          ? "border-blue-500 bg-blue-500"
                          : "border-slate-300"
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
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isPending || !selectedTenant}
                className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-medium rounded-lg py-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors py-1"
              >
                ← Usar outra conta
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
