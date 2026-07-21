"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Eye, EyeOff, Copy, Check, Plug, Loader2, CheckCircle2, XCircle,
} from "lucide-react";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminButton } from "@/components/admin/AdminButton";

type TestStatus = "idle" | "testing" | "ok" | "erro";

interface Props {
  action: (formData: FormData) => Promise<void>;
  loja: { sqlEnabled: boolean; bridgeUrl: string; hasToken: boolean };
  lojaId: string;
  tenantId: string;
}

export default function BridgeForm({ action, loja, lojaId, tenantId }: Props) {
  const [bridgeUrl, setBridgeUrl] = useState(loja.bridgeUrl);
  // O token nunca é enviado ao browser. Campo começa vazio: em branco = manter o atual.
  const [token, setToken] = useState("");
  const [enabled, setEnabled] = useState(loja.sqlEnabled);
  const [verToken, setVerToken] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [revealErro, setRevealErro] = useState("");
  const [revelado, setRevelado] = useState(false);

  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testErro, setTestErro] = useState("");
  const [testRow, setTestRow] = useState<Record<string, unknown> | null>(null);

  async function copiarToken() {
    await navigator.clipboard.writeText(token);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function revelarToken() {
    setRevealing(true);
    setRevealErro("");
    setRevelado(false);
    try {
      const res = await fetch(`/api/admin/lojas/${lojaId}/reveal-token`, {
        method: "POST",
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (res.ok && data.token) {
        setToken(data.token);
        setVerToken(true);
        setRevelado(true);
      } else {
        setRevealErro(data.error ?? "Falha ao revelar token");
      }
    } catch {
      setRevealErro("Erro de rede ao revelar token");
    } finally {
      setRevealing(false);
    }
  }

  async function testarConexao() {
    // Testa com o token digitado; se em branco e já existe um salvo, o servidor
    // usa o token armazenado (via lojaId) sem nunca trafegá-lo até o browser.
    if (!bridgeUrl || (!token && !loja.hasToken)) return;
    setTestStatus("testing");
    setTestErro("");
    setTestRow(null);
    try {
      const res = await fetch("/api/admin/testar-bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token ? { bridgeUrl, token } : { bridgeUrl, lojaId }),
      });
      const data = (await res.json()) as {
        success: boolean;
        erro?: string;
        rows?: Record<string, unknown>[];
      };
      if (data.success) {
        setTestStatus("ok");
        setTestRow(data.rows?.[0] ?? null);
      } else {
        setTestStatus("erro");
        setTestErro(data.erro ?? "Falha na conexão");
      }
    } catch {
      setTestStatus("erro");
      setTestErro("Erro de rede ao testar bridge");
    }
  }

  return (
    <form action={action}>
    <AdminCard className="space-y-5 p-6">

      {/* ── Habilitar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 rounded-lg p-3" style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-line)" }}>
        <input
          type="checkbox"
          id="enabled"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="adm-focusable rounded"
          style={{ accentColor: "var(--adm-accent)" }}
        />
        <label htmlFor="enabled" className="cursor-pointer">
          <p className="text-sm font-medium" style={{ color: "var(--adm-text)" }}>Bridge SQL habilitada</p>
          <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>Desmarque para pausar sem apagar as credenciais.</p>
        </label>
      </div>

      {/* ── URL ───────────────────────────────────────────────────────── */}
      <div>
        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>URL da Bridge</label>
        <input
          type="url"
          name="bridgeUrl"
          value={bridgeUrl}
          onChange={(e) => setBridgeUrl(e.target.value)}
          placeholder="https://sql-cliente.lctecnologias.com.br"
          className="adm-field adm-focusable w-full px-3.5 py-2.5 text-sm"
        />
        <p className="mt-1 text-xs" style={{ color: "var(--adm-text-faint)" }}>
          Cloudflare Tunnel apontando para porta 3055 da bridge.
        </p>
      </div>

      {/* ── Token ─────────────────────────────────────────────────────── */}
      <div>
        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
          Token de segurança
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              id="bridge-token"
              type={verToken ? "text" : "password"}
              name="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={loja.hasToken ? "•••••• (token salvo — digite para substituir)" : "Token gerado pelo instalar-bridge.ps1"}
              className="adm-field adm-focusable adm-mono w-full px-3.5 py-2.5 pr-10 text-sm"
            />
            <button
              type="button"
              onClick={() => setVerToken((v) => !v)}
              className="adm-focusable absolute right-2.5 top-1/2 -translate-y-1/2 rounded"
              style={{ color: "var(--adm-text-faint)" }}
            >
              {verToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {token && (
            <AdminButton type="button" variant="secondary" size="sm" onClick={copiarToken} className="shrink-0">
              {copiado ? <Check className="h-3.5 w-3.5" style={{ color: "var(--adm-signal)" }} /> : <Copy className="h-3.5 w-3.5" />}
              {copiado ? "Copiado" : "Copiar"}
            </AdminButton>
          )}
        </div>
        <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>
          Armazenado criptografado (AES-256-GCM). Deixe em branco para manter o token atual.
        </p>
        {loja.hasToken && !token && (
          <div className="mt-2">
            <AdminButton type="button" variant="secondary" size="sm" onClick={revelarToken} disabled={revealing}>
              {revealing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              {revealing ? "Revelando..." : "Revelar token atual"}
            </AdminButton>
          </div>
        )}
        {revelado && (
          <p className="mt-1.5 text-xs" style={{ color: "var(--adm-warn)" }}>
            Token revelado — este acesso foi registrado.
          </p>
        )}
        {revealErro && (
          <p className="mt-1.5 text-xs" style={{ color: "var(--adm-alert)" }}>{revealErro}</p>
        )}
      </div>

      {/* ── Testar conexão ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={testarConexao}
          disabled={testStatus === "testing" || !bridgeUrl || (!token && !loja.hasToken)}
          className="adm-focusable inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
          style={{ border: "1px solid var(--adm-line-strong)", color: "var(--adm-text-dim)" }}
        >
          {testStatus === "idle"    && <Plug         className="h-3.5 w-3.5" />}
          {testStatus === "testing" && <Loader2      className="h-3.5 w-3.5 animate-spin" />}
          {testStatus === "ok"      && <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--adm-signal)" }} />}
          {testStatus === "erro"    && <XCircle      className="h-3.5 w-3.5" style={{ color: "var(--adm-alert)" }} />}
          <span style={{ color: testStatus === "ok" ? "var(--adm-signal)" : testStatus === "erro" ? "var(--adm-alert)" : undefined }}>
            {testStatus === "idle"    && "Testar conexão"}
            {testStatus === "testing" && "Testando..."}
            {testStatus === "ok"      && "Conexão OK"}
            {testStatus === "erro"    && "Falha — clique para tentar de novo"}
          </span>
        </button>

        {testStatus === "erro" && testErro && (
          <p
            className="adm-mono rounded px-3 py-2 text-xs"
            style={{ background: "var(--adm-alert-soft)", border: "1px solid var(--adm-alert)", color: "var(--adm-alert)" }}
          >
            {testErro}
          </p>
        )}

        {testStatus === "ok" && testRow && (
          <div className="rounded-lg p-3" style={{ background: "var(--adm-signal-soft)", border: "1px solid var(--adm-signal)" }}>
            <p className="mb-2 text-xs font-medium" style={{ color: "var(--adm-signal)" }}>Primeira linha retornada:</p>
            <pre className="adm-mono overflow-x-auto whitespace-pre-wrap break-all text-xs" style={{ color: "var(--adm-signal)" }}>
              {JSON.stringify(testRow, null, 2)}
            </pre>
          </div>
        )}

        {testStatus === "ok" && !testRow && (
          <p className="text-xs" style={{ color: "var(--adm-signal)" }}>Bridge respondeu mas não há registros na tabela de teste.</p>
        )}
      </div>

      {/* ── Ações ─────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3 pt-2" style={{ borderTop: "1px solid var(--adm-line)" }}>
        <Link
          href={`/admin/empresas/${tenantId}?aba=lojas`}
          className="adm-focusable rounded px-4 py-2 text-sm transition-colors"
          style={{ color: "var(--adm-text-dim)" }}
        >
          Cancelar
        </Link>
        <AdminButton type="submit">
          Salvar configuração
        </AdminButton>
      </div>
    </AdminCard>
    </form>
  );
}
