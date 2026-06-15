"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Eye, EyeOff, Copy, Check, Plug, Loader2, CheckCircle2, XCircle, BookOpen,
} from "lucide-react";

type TestStatus = "idle" | "testing" | "ok" | "erro";

type InventarioRow = { invId: number; data: string; obs: string };

interface Props {
  action: (formData: FormData) => Promise<void>;
  loja: { sqlEnabled: boolean; bridgeUrl: string; bridgeToken: string };
  inventarios: InventarioRow[];
  inventarioIdBase: number | null;
  tenantId: string;
}

export default function BridgeForm({
  action,
  loja,
  inventarios,
  inventarioIdBase,
  tenantId,
}: Props) {
  const [bridgeUrl, setBridgeUrl] = useState(loja.bridgeUrl);
  const [token, setToken] = useState(loja.bridgeToken);
  const [enabled, setEnabled] = useState(loja.sqlEnabled);
  const [verToken, setVerToken] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [invSelecionado, setInvSelecionado] = useState<string>(
    inventarioIdBase ? String(inventarioIdBase) : "",
  );

  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testErro, setTestErro] = useState("");
  const [testRow, setTestRow] = useState<Record<string, unknown> | null>(null);

  async function copiarToken() {
    await navigator.clipboard.writeText(token);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function testarConexao() {
    if (!bridgeUrl || !token) return;
    setTestStatus("testing");
    setTestErro("");
    setTestRow(null);
    try {
      const res = await fetch("/api/admin/testar-bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bridgeUrl, token }),
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
    <form action={action} className="space-y-6">
      {/* ── Bridge config ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">

        {/* Habilitar */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
          <input
            type="checkbox"
            id="enabled"
            name="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
          />
          <label htmlFor="enabled" className="cursor-pointer">
            <p className="text-sm font-medium text-slate-700">Bridge SQL habilitada</p>
            <p className="text-xs text-slate-400">Desmarque para pausar sem apagar as credenciais.</p>
          </label>
        </div>

        {/* URL */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">URL da Bridge</label>
          <input
            type="url"
            name="bridgeUrl"
            value={bridgeUrl}
            onChange={(e) => setBridgeUrl(e.target.value)}
            placeholder="https://sql-cliente.lctecnologias.com.br"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <p className="text-xs text-slate-400 mt-0.5">
            Cloudflare Tunnel apontando para porta 3055 da bridge.
          </p>
        </div>

        {/* Token */}
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
                placeholder="Token gerado pelo instalar-bridge.ps1"
                className="w-full border border-slate-300 rounded-md px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-300"
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
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-md text-xs text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
              >
                {copiado ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copiado ? "Copiado" : "Copiar"}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Armazenado criptografado (AES-256-GCM). Deixe em branco para manter o token atual.
          </p>
        </div>

        {/* Testar conexão */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={testarConexao}
            disabled={testStatus === "testing" || !bridgeUrl || !token}
            className="inline-flex items-center gap-2 border border-slate-300 rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
      </div>

      {/* ── Inventário Base Fiscal ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">Inventário Base Fiscal</h2>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Ponto de partida para o cálculo de estoque fiscal no módulo OS.
          As movimentações de NF são acumuladas a partir da data deste inventário.
          Deixe em branco para usar automaticamente o mais recente.
        </p>

        {inventarios.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-400">
              Configure e salve a Bridge SQL para visualizar os inventários disponíveis.
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Inventário selecionado
            </label>
            <select
              name="inventario_id_base"
              value={invSelecionado}
              onChange={(e) => setInvSelecionado(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">— Automático (mais recente não suspenso) —</option>
              {inventarios.map((inv) => (
                <option key={inv.invId} value={String(inv.invId)}>
                  #{inv.invId} — {inv.data}
                  {inv.obs ? ` — ${inv.obs.slice(0, 60)}${inv.obs.length > 60 ? "…" : ""}` : ""}
                </option>
              ))}
            </select>
            {invSelecionado && (
              <p className="mt-1.5 text-xs text-slate-400">
                Inventário #{invSelecionado} fixado como base fiscal para esta loja.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Ações ─────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3">
        <Link
          href={`/admin/empresas/${tenantId}?aba=lojas`}
          className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          Salvar configuração
        </button>
      </div>
    </form>
  );
}
