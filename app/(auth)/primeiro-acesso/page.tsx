"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { definirSenhaPermanente } from "@/app/actions/auth";

export default function PrimeiroAcessoPage() {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (novaSenha.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setError("As senhas não coincidem");
      return;
    }

    startTransition(async () => {
      const result = await definirSenhaPermanente(novaSenha);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="pa-root">
      <div aria-hidden className="pa-bg">
        <div className="pa-silk pa-silk-tr" />
        <div className="pa-silk pa-silk-bl" />
        <div className="pa-glow" />
      </div>

      <div className="pa-content">
        <div className="pa-logo-wrap">
          <div className="pa-logo">
            <Image src="/lc-logo.ico" alt="LC Gestor" width={96} height={96} className="pa-logo-img" unoptimized />
          </div>
        </div>

        <div className="pa-badge">Primeiro acesso</div>

        <h1 className="pa-title">Defina sua senha permanente</h1>
        <p className="pa-subtitle">
          Esta é uma senha temporária. Escolha uma senha exclusiva para continuar.
        </p>

        <form onSubmit={handleSubmit} className="pa-form">
          <div className="pa-field">
            <label className="pa-label">Nova senha</label>
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              required
              disabled={isPending}
              className="pa-input"
            />
          </div>

          <div className="pa-field">
            <label className="pa-label">Confirmar senha</label>
            <input
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              placeholder="Repita a nova senha"
              autoComplete="new-password"
              required
              disabled={isPending}
              className="pa-input"
            />
          </div>

          {novaSenha.length > 0 && (
            <div className="pa-strength">
              <div className="pa-strength-bars">
                {[6, 8, 12].map((threshold) => (
                  <div
                    key={threshold}
                    className={`pa-strength-bar ${
                      novaSenha.length >= threshold ? "pa-strength-bar--active" : ""
                    }`}
                  />
                ))}
              </div>
              <span className="pa-strength-label">
                {novaSenha.length < 6
                  ? "Muito curta"
                  : novaSenha.length < 8
                  ? "Fraca"
                  : novaSenha.length < 12
                  ? "Média"
                  : "Forte"}
              </span>
            </div>
          )}

          {error && (
            <div className="pa-error">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="7" cy="7" r="6" stroke="#f87171" strokeWidth="1.5" />
                <path d="M7 4v3.5M7 9.5v.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending || novaSenha.length < 6 || novaSenha !== confirmarSenha}
            className={`pa-btn ${
              isPending || novaSenha.length < 6 || novaSenha !== confirmarSenha
                ? "pa-btn--disabled"
                : ""
            }`}
          >
            {isPending ? (
              <>
                <svg className="pa-spin" viewBox="0 0 24 24" fill="none" width="14" height="14">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                  <path fill="currentColor" opacity="0.75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Salvando...
              </>
            ) : (
              "Salvar senha"
            )}
          </button>
        </form>
      </div>

      <style jsx>{`
        .pa-root {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #08101e;
        }

        .pa-bg {
          pointer-events: none;
          position: absolute;
          inset: 0;
        }

        .pa-glow {
          position: absolute;
          left: 50%;
          top: 40%;
          width: 640px;
          height: 640px;
          transform: translate(-50%, -50%);
          background: radial-gradient(ellipse at center, rgba(37, 99, 235, 0.04) 0%, transparent 65%);
          border-radius: 50%;
        }

        .pa-silk {
          position: absolute;
          border-radius: 38% 62% 55% 45% / 42% 38% 62% 58%;
          overflow: hidden;
        }

        .pa-silk-tr {
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

        .pa-silk-tr::after {
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

        .pa-silk-bl {
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

        .pa-silk-bl::after {
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

        .pa-content {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 380px;
          padding: 0 20px;
        }

        .pa-logo-wrap {
          display: flex;
          justify-content: center;
          margin-bottom: 20px;
        }

        .pa-logo {
          width: 96px;
          height: 96px;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pa-logo-img {
          display: block;
          animation: float 3.5s ease-in-out infinite;
          filter: drop-shadow(0 8px 24px rgba(37, 99, 235, 0.18));
        }

        @keyframes float {
          0%   { transform: translateY(0px); }
          50%  { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }

        .pa-badge {
          display: flex;
          justify-content: center;
          margin-bottom: 16px;
        }

        .pa-badge {
          text-align: center;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--accent-cyan);
          background: rgba(37, 99, 235, 0.08);
          border: 1px solid rgba(37, 99, 235, 0.18);
          border-radius: 20px;
          padding: 4px 12px;
          width: fit-content;
          margin: 0 auto 16px;
        }

        .pa-title {
          text-align: center;
          font-size: 22px;
          font-weight: 600;
          color: #f1f5f9;
          letter-spacing: -0.02em;
          margin: 0 0 8px;
          line-height: 1.3;
        }

        .pa-subtitle {
          text-align: center;
          font-size: 13px;
          color: #475569;
          margin: 0 0 28px;
          line-height: 1.6;
        }

        .pa-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .pa-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .pa-label {
          font-size: 12px;
          font-weight: 500;
          color: #64748b;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .pa-input {
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

        .pa-input::placeholder {
          color: #334155;
        }

        .pa-input:focus {
          border-color: rgba(37, 99, 235, 0.35);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.07);
        }

        .pa-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pa-strength {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pa-strength-bars {
          display: flex;
          gap: 4px;
          flex: 1;
        }

        .pa-strength-bar {
          height: 3px;
          flex: 1;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.08);
          transition: background 0.2s;
        }

        .pa-strength-bar--active:nth-child(1) { background: #f87171; }
        .pa-strength-bar--active:nth-child(2) { background: #fb923c; }
        .pa-strength-bar--active:nth-child(3) { background: #34d399; }

        .pa-strength-label {
          font-size: 11px;
          color: #475569;
          white-space: nowrap;
        }

        .pa-error {
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

        .pa-btn {
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

        .pa-btn:hover:not(:disabled) {
          background: #1e2a40;
          border-color: rgba(37, 99, 235, 0.2);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.06);
        }

        .pa-btn--disabled,
        .pa-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .pa-spin {
          animation: spin 0.8s linear infinite;
          flex-shrink: 0;
        }

        @media (max-width: 480px) {
          .pa-silk-bl { display: none; }
          .pa-silk-tr {
            width: 460px;
            height: 420px;
            top: -160px;
            right: -150px;
          }
          .pa-title { font-size: 20px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .pa-spin, .pa-logo-img { animation: none; }
        }
      `}</style>
    </div>
  );
}
