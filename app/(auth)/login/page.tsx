"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { login } from "@/app/actions/auth";

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);

    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="login-root">
      <div aria-hidden className="login-bg">
        <div className="login-silk login-silk-tr" />
        <div className="login-silk login-silk-bl" />
        <div className="login-glow" />
      </div>

      <div className="login-content">
        <div className="login-logo-wrap">
          <div className="login-logo">
            <Image src="/lc-logo.ico" alt="LC Gestor" width={96} height={96} className="login-logo-img" unoptimized />
          </div>
        </div>

        <h1 className="login-title">Entrar no LC Gestor</h1>

        <form onSubmit={handleSubmit} className="login-form">
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

          {error && (
            <div className="login-error">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="7" cy="7" r="6" stroke="#f87171" strokeWidth="1.5" />
                <path d="M7 4v3.5M7 9.5v.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className={`login-btn ${isPending ? "login-btn--disabled" : ""}`}
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

        <p className="login-legal">
          Ao entrar, você concorda com nossos{" "}
          <a href="#" className="login-legal-link">Termos</a>
          {" "}e{" "}
          <a href="#" className="login-legal-link">Política de Privacidade</a>.
        </p>
      </div>

      <style jsx>{`
        .login-root {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #08101e;
        }

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

        .login-content {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 380px;
          padding: 0 20px;
        }

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

        .login-title {
          text-align: center;
          font-size: 22px;
          font-weight: 600;
          color: #f1f5f9;
          letter-spacing: -0.02em;
          margin: 0 0 32px;
          line-height: 1.3;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

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

        .login-input::placeholder { color: #334155; }

        .login-input:focus {
          border-color: rgba(0, 229, 255, 0.35);
          box-shadow: 0 0 0 3px rgba(0, 229, 255, 0.07);
        }

        .login-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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

        .login-legal-link:hover { color: #94a3b8; }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .login-spin {
          animation: spin 0.8s linear infinite;
          flex-shrink: 0;
        }

        @media (max-width: 480px) {
          .login-silk-bl { display: none; }
          .login-silk-tr {
            width: 460px;
            height: 420px;
            top: -160px;
            right: -150px;
          }
          .login-title { font-size: 20px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .login-spin, .login-logo-img { animation: none; }
        }
      `}</style>
    </div>
  );
}
