"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { login, getTenantsByEmail } from "@/app/actions/auth";
import type { TenantOption } from "@/app/actions/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectOpen, setSelectOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isFetchingTenants, setIsFetchingTenants] = useState(false);
  const emailDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(e.target as Node)) {
        setSelectOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);

    const emailValido = email.includes("@") && email.includes(".");
    if (!emailValido) {
      setTenants([]);
      setSelectedTenantId("");
      return;
    }

    emailDebounceRef.current = setTimeout(async () => {
      setIsFetchingTenants(true);
      const result = await getTenantsByEmail(email);
      setTenants(result.tenants ?? []);
      if (result.tenants?.length === 1) {
        setSelectedTenantId(result.tenants[0].id);
      } else {
        setSelectedTenantId("");
      }
      setIsFetchingTenants(false);
    }, 600);

    return () => {
      if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);
    };
  }, [email]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);
    if (selectedTenantId) formData.set("tenantId", selectedTenantId);

    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) setError(result.error);
    });
  }

  const tenantSelecionado = tenants.find((t) => t.id === selectedTenantId);
  const mostrarSeletorEmpresa = tenants.length > 1;

  return (
    <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center p-4">
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
                <path
                  d="M4 5.5L8 3L16 7.5V12.5L12 15L4 10.5V5.5Z"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M4 5.5L12 10L16 7.5M12 10V15"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
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
          <p className="text-slate-500 text-sm mt-1">Entre na sua conta</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-blue-100 rounded-2xl p-8 shadow-xl shadow-blue-100/50">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
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

            {/* Senha */}
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

            {/* Seletor de empresa — aparece quando há múltiplas empresas */}
            {mostrarSeletorEmpresa && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <rect x="1" y="4" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M4 4V3a2 2 0 014 0v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  Empresa
                </label>

                <div className="relative" ref={selectRef}>
                  <button
                    type="button"
                    onClick={() => setSelectOpen(!selectOpen)}
                    disabled={isPending}
                    className={`w-full flex items-center gap-3 bg-slate-50 border rounded-lg px-3.5 py-2.5 text-sm text-left transition-all disabled:opacity-50 ${
                      selectOpen
                        ? "border-blue-500 bg-white ring-2 ring-blue-500/10"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {tenantSelecionado ? (
                      <>
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-white uppercase">
                            {tenantSelecionado.name.charAt(0)}
                          </span>
                        </div>
                        <span className="font-medium text-slate-900 flex-1 truncate">
                          {tenantSelecionado.name}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400 flex-1">
                        Selecione a empresa...
                      </span>
                    )}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className={`text-slate-400 shrink-0 transition-transform ${selectOpen ? "rotate-180" : ""}`}
                    >
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>

                  {selectOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10">
                      {tenants.map((tenant) => (
                        <button
                          key={tenant.id}
                          type="button"
                          onClick={() => {
                            setSelectedTenantId(tenant.id);
                            setSelectOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3.5 py-3 text-sm text-left transition-colors ${
                            selectedTenantId === tenant.id
                              ? "bg-blue-50 text-blue-700"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-white uppercase">
                              {tenant.name.charAt(0)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{tenant.name}</p>
                            <p className="text-xs text-slate-400 truncate">
                              {tenant.slug}
                            </p>
                          </div>
                          {selectedTenantId === tenant.id && (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-blue-600 shrink-0">
                              <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Loading empresas */}
            {isFetchingTenants && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Buscando empresas...
              </div>
            )}

            {/* Erro */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                  <circle cx="7" cy="7" r="6" stroke="#dc2626" strokeWidth="1.5"/>
                  <path d="M7 4v3.5M7 9.5v.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={isPending || (mostrarSeletorEmpresa && !selectedTenantId)}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-medium rounded-lg py-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
