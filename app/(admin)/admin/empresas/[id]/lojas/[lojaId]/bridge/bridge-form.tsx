"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Eye, EyeOff, Copy, Check, Plug, Loader2, CheckCircle2, XCircle,
} from "lucide-react";

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
    <form
      action={action}
      className="bg-white rounded-xl border border-slate-200 p-6 space-y-5"
      style={{ animation: "fadeInUp 0.35s ease-out both", animationDelay: "50ms" }}
    >

      {/* ── Habilitar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
        <input
          type="checkbox"
          id="enabled"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="rounded border-slate-300 text-slate-700 focus:ring-slate-400"
        />
        <label htmlFor="enabled" className="cursor-pointer">
          <p className="text-sm font-medium text-slate-700">Bridge SQL habilitada</p>
          <p className="text-xs text-slate-400">Desmarque para pausar sem apagar as credenciais.</p>
        </label>
      </div>

      {/* ── URL ───────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">URL da Bridge</label>
        <input
          type="url"
          name="bridgeUrl"
          value={bridgeUrl}
          onChange={(e) => setBridgeUrl(e.target.value)}
          placeholder="https://sql-cliente.lctecnologias.com.br"
          className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all bg-white"
        />
        <p className="text-xs text-slate-400 mt-1">
          Cloudflare Tunnel apontando para porta 3055 da bridge.
        </p>
      </div>

      {/* ── Token ─────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
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
              className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all bg-white"
            />
            <button
              type="button"
              onClick={() => setVerToken((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              {verToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {token && (
            <button
              type="button"
              onClick={copiarToken}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
            >
              {copiado ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copiado ? "Copiado" : "Copiar"}
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          Armazenado criptografado (AES-256-GCM). Deixe em branco para manter o token atual.
        </p>
        {loja.hasToken && !token && (
          <button
            type="button"
            onClick={revelarToken}
            disabled={revealing}
            className="mt-2 inline-flex items-center gap-1.5 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {revealing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
            {revealing ? "Revelando..." : "Revelar token atual"}
          </button>
        )}
        {revelado && (
          <p className="text-xs text-amber-600 mt-1.5">
            Token revelado — este acesso foi registrado.
          </p>
        )}
        {revealErro && (
          <p className="text-xs text-red-600 mt-1.5">{revealErro}</p>
        )}
      </div>

      {/* ── Testar conexão ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={testarConexao}
          disabled={testStatus === "testing" || !bridgeUrl || (!token && !loja.hasToken)}
          className="inline-flex items-center gap-2 border border-slate-200 rounded-lg px-3.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {testStatus === "idle"    && <Plug         className="h-3.5 w-3.5" />}
          {testStatus === "testing" && <Loader2      className="h-3.5 w-3.5 animate-spin" />}
          {testStatus === "ok"      && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
          {testStatus === "erro"    && <XCircle      className="h-3.5 w-3.5 text-red-500" />}
          <span className={
            testStatus === "ok"   ? "text-green-600" :
            testStatus === "erro" ? "text-red-600"   : ""
          }>
            {testStatus === "idle"    && "Testar conexão"}
            {testStatus === "testing" && "Testando..."}
            {testStatus === "ok"      && "Conexão OK"}
            {testStatus === "erro"    && "Falha — clique para tentar de novo"}
          </span>
        </button>

        {testStatus === "erro" && testErro && (
          <p className="text-xs text-red-600 font-mono bg-red-50 border border-red-100 rounded px-3 py-2">
            {testErro}
          </p>
        )}

        {testStatus === "ok" && testRow && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-xs font-medium text-green-700 mb-2">Primeira linha retornada:</p>
            <pre className="text-xs font-mono text-green-800 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(testRow, null, 2)}
            </pre>
          </div>
        )}

        {testStatus === "ok" && !testRow && (
          <p className="text-xs text-green-600">Bridge respondeu mas não há registros na tabela de teste.</p>
        )}
      </div>

      {/* ── Ações ─────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
        <Link
          href={`/admin/empresas/${tenantId}?aba=lojas`}
          className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 hover:shadow-md transition-all hover:-translate-y-px"
        >
          Salvar configuração
        </button>
      </div>
    </form>
  );
}
