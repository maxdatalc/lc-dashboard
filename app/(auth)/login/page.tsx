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
  const submitDisabled = isPending || (mostrarSeletorEmpresa && !selectedTenantId);

  return (
    <div className="login-root">
      {/* ── Decorações de fundo ── */}
      <div aria-hidden className="login-bg">
        <div className="login-silk login-silk-tr" />
        <div className="login-silk login-silk-bl" />
        <div className="login-glow" />
      </div>

      {/* ── Conteúdo ── */}
      <div className="login-content">

        {/* Logo */}
        <div className="login-logo-wrap">
          <div className="login-logo">
            <img src="/lc-logo.ico" alt="LC Gestor" width={96} height={96} className="login-logo-img" />
          </div>
        </div>

        {/* Título */}
        <h1 className="login-title">Entrar no LC Gestor</h1>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="login-form">

          {/* E-mail */}
          <div className="login-field">
            <label className="login-label">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              required
              disabled={isPending}
              className="login-input"
            />
          </div>

          {/* Senha */}
          <div className="login-field">
            <label className="login-label">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              disabled={isPending}
              className="login-input"
            />
          </div>

          {/* Seletor de empresa */}
          {mostrarSeletorEmpresa && (
            <div className="login-field">
              <label className="login-label">Empresa</label>
              <div className="login-select-wrap" ref={selectRef}>
                <button
                  type="button"
                  onClick={() => setSelectOpen(!selectOpen)}
                  disabled={isPending}
                  className={`login-select-btn ${selectOpen ? "login-select-btn--open" : ""}`}
                >
                  {tenantSelecionado ? (
                    <>
                      <div className="login-tenant-avatar">
                        {tenantSelecionado.name.charAt(0)}
                      </div>
                      <span className="login-select-value">{tenantSelecionado.name}</span>
                    </>
                  ) : (
                    <span className="login-select-placeholder">Selecione a empresa...</span>
                  )}
                  <svg
                    width="14" height="14" viewBox="0 0 14 14" fill="none"
                    className={`login-chevron ${selectOpen ? "login-chevron--open" : ""}`}
                  >
                    <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {selectOpen && (
                  <div className="login-dropdown">
                    {tenants.map((tenant) => (
                      <button
                        key={tenant.id}
                        type="button"
                        onClick={() => { setSelectedTenantId(tenant.id); setSelectOpen(false); }}
                        className={`login-dropdown-item ${selectedTenantId === tenant.id ? "login-dropdown-item--active" : ""}`}
                      >
                        <div className="login-tenant-avatar">{tenant.name.charAt(0)}</div>
                        <div className="login-tenant-info">
                          <p className="login-tenant-name">{tenant.name}</p>
                          <p className="login-tenant-slug">{tenant.slug}</p>
                        </div>
                        {selectedTenantId === tenant.id && (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: "#00e5ff", flexShrink: 0 }}>
                            <path d="M2.5 7l3.5 3.5L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Buscando empresas */}
          {isFetchingTenants && (
            <div className="login-fetching">
              <svg className="login-spin" viewBox="0 0 24 24" fill="none" width="12" height="12">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                <path fill="currentColor" opacity="0.75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Buscando empresas...
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="login-error">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="7" cy="7" r="6" stroke="#f87171" strokeWidth="1.5" />
                <path d="M7 4v3.5M7 9.5v.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {error}
            </div>
          )}

          {/* Botão */}
          <button
            type="submit"
            disabled={submitDisabled}
            className={`login-btn ${submitDisabled ? "login-btn--disabled" : ""}`}
          >
            {isPending ? (
              <>
                <svg className="login-spin" viewBox="0 0 24 24" fill="none" width="14" height="14">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                  <path fill="currentColor" opacity="0.75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        {/* Texto legal */}
        <p className="login-legal">
          Ao entrar, você concorda com nossos{" "}
          <a href="#" className="login-legal-link">Termos</a>
          {" "}e{" "}
          <a href="#" className="login-legal-link">Política de Privacidade</a>.
        </p>
      </div>

      <style jsx>{`
        /* ── Base ── */
        .login-root {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #08101e;
        }

        /* ── Background decorativo ── */
        .login-bg {
          pointer-events: none;
          position: absolute;
          inset: 0;
        }

        .login-glow {
          position: absolute;
          left: 50%;
          top: 40%;
          width: 640px;
          height: 640px;
          transform: translate(-50%, -50%);
          background: radial-gradient(ellipse at center, rgba(0, 229, 255, 0.04) 0%, transparent 65%);
          border-radius: 50%;
        }

        .login-silk {
          position: absolute;
          border-radius: 38% 62% 55% 45% / 42% 38% 62% 58%;
          overflow: hidden;
        }

        /* Painel superior-direito */
        .login-silk-tr {
          width: 720px;
          height: 660px;
          top: -260px;
          right: -220px;
          background: linear-gradient(
            148deg,
            rgba(170, 185, 220, 0.42) 0%,
            rgba(110, 125, 170, 0.28) 28%,
            rgba(55, 70, 115, 0.14) 55%,
            rgba(20, 35, 75, 0.05) 75%,
            transparent 90%
          );
          transform: rotate(-16deg);
        }

        /* Faixa de highlight superior-direito */
        .login-silk-tr::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(
            205deg,
            rgba(230, 238, 255, 0.22) 0%,
            rgba(180, 195, 230, 0.10) 22%,
            transparent 48%
          );
        }

        /* Painel inferior-esquerdo */
        .login-silk-bl {
          width: 620px;
          height: 560px;
          bottom: -210px;
          left: -210px;
          background: linear-gradient(
            -38deg,
            rgba(145, 160, 200, 0.36) 0%,
            rgba(85, 100, 145, 0.20) 32%,
            rgba(40, 55, 100, 0.09) 58%,
            transparent 78%
          );
          border-radius: 58% 42% 48% 52% / 52% 48% 52% 48%;
          transform: rotate(14deg);
        }

        .login-silk-bl::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(
            -160deg,
            rgba(210, 220, 245, 0.18) 0%,
            rgba(160, 175, 215, 0.08) 25%,
            transparent 50%
          );
        }

        /* ── Conteúdo central ── */
        .login-content {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 380px;
          padding: 0 20px;
        }

        /* ── Logo ── */
        .login-logo-wrap {
          display: flex;
          justify-content: center;
          margin-bottom: 24px;
        }

        .login-logo {
          width: 96px;
          height: 96px;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .login-logo-img {
          display: block;
          animation: float 3.5s ease-in-out infinite;
          filter: drop-shadow(0 8px 24px rgba(0, 229, 255, 0.18));
        }

        @keyframes float {
          0%   { transform: translateY(0px); }
          50%  { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }

        /* ── Título ── */
        .login-title {
          text-align: center;
          font-size: 22px;
          font-weight: 600;
          color: #f1f5f9;
          letter-spacing: -0.02em;
          margin: 0 0 32px;
          line-height: 1.3;
        }

        /* ── Formulário ── */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        /* ── Campo ── */
        .login-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .login-label {
          font-size: 12px;
          font-weight: 500;
          color: #64748b;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .login-input {
          width: 100%;
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 10px;
          padding: 11px 14px;
          font-size: 14px;
          color: #f1f5f9;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
        }

        .login-input::placeholder {
          color: #334155;
        }

        .login-input:focus {
          border-color: rgba(0, 229, 255, 0.35);
          box-shadow: 0 0 0 3px rgba(0, 229, 255, 0.07);
        }

        .login-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ── Select empresa ── */
        .login-select-wrap {
          position: relative;
        }

        .login-select-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 14px;
          color: #f1f5f9;
          cursor: pointer;
          text-align: left;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .login-select-btn--open,
        .login-select-btn:focus-visible {
          border-color: rgba(0, 229, 255, 0.35);
          box-shadow: 0 0 0 3px rgba(0, 229, 255, 0.07);
          outline: none;
        }

        .login-select-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .login-select-value {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .login-select-placeholder {
          flex: 1;
          color: #334155;
        }

        .login-chevron {
          color: #475569;
          flex-shrink: 0;
          transition: transform 0.2s;
        }

        .login-chevron--open {
          transform: rotate(180deg);
        }

        .login-tenant-avatar {
          width: 24px;
          height: 24px;
          border-radius: 7px;
          background: linear-gradient(135deg, #0891b2, #00e5ff22);
          border: 1px solid rgba(0, 229, 255, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
          color: #00e5ff;
          flex-shrink: 0;
          text-transform: uppercase;
        }

        /* ── Dropdown ── */
        .login-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 12px;
          overflow: hidden;
          z-index: 20;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
        }

        .login-dropdown-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          font-size: 13px;
          color: #cbd5e1;
          cursor: pointer;
          text-align: left;
          background: transparent;
          border: none;
          transition: background 0.12s;
        }

        .login-dropdown-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .login-dropdown-item--active {
          background: rgba(0, 229, 255, 0.07);
          color: #f1f5f9;
        }

        .login-tenant-info {
          flex: 1;
          min-width: 0;
        }

        .login-tenant-name {
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 13px;
        }

        .login-tenant-slug {
          font-size: 11px;
          color: #475569;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ── States ── */
        .login-fetching {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          color: #475569;
        }

        .login-error {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 12px;
          color: #f87171;
        }

        /* ── Botão ── */
        .login-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #1a2338;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          padding: 12px;
          font-size: 14px;
          font-weight: 500;
          color: #f1f5f9;
          cursor: pointer;
          margin-top: 4px;
          transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
        }

        .login-btn:hover:not(:disabled) {
          background: #1e2a40;
          border-color: rgba(0, 229, 255, 0.2);
          box-shadow: 0 0 0 3px rgba(0, 229, 255, 0.06);
        }

        .login-btn--disabled,
        .login-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* ── Texto legal ── */
        .login-legal {
          text-align: center;
          font-size: 12px;
          color: #334155;
          margin-top: 28px;
          line-height: 1.6;
        }

        .login-legal-link {
          color: #475569;
          text-decoration: underline;
          text-underline-offset: 2px;
          text-decoration-color: rgba(71, 85, 105, 0.5);
          transition: color 0.12s;
        }

        .login-legal-link:hover {
          color: #94a3b8;
        }

        /* ── Spinner ── */
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .login-spin {
          animation: spin 0.8s linear infinite;
          flex-shrink: 0;
        }

        /* ── Mobile ── */
        @media (max-width: 480px) {
          .login-silk-bl {
            display: none;
          }
          .login-silk-tr {
            width: 460px;
            height: 420px;
            top: -160px;
            right: -150px;
          }
          .login-title {
            font-size: 20px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .login-spin, .login-logo-img {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
