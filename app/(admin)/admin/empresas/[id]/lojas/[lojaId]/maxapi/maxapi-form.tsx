"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import Link from "next/link";
import { Plug, Loader2, CheckCircle2, XCircle } from "lucide-react";

type TestStatus = "idle" | "testing" | "ok" | "erro";

interface Props {
  action: (
    prevState: { erro: string | null },
    formData: FormData,
  ) => Promise<{ erro: string | null }>;
  loja: { maxApiUrl: string; terminalMaxdata: string; empId: number };
  tenantId: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 hover:shadow-md disabled:opacity-60 transition-all hover:-translate-y-px"
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {pending ? "Salvando..." : "Salvar configuração"}
    </button>
  );
}

export default function MaxApiForm({ action, loja, tenantId }: Props) {
  const [state, formAction] = useFormState(action, { erro: null });
  const [maxApiUrl, setMaxApiUrl] = useState(loja.maxApiUrl);
  const [terminal, setTerminal] = useState(loja.terminalMaxdata);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testErro, setTestErro] = useState("");
  const [testInfo, setTestInfo] = useState<string | null>(null);

  async function testarConexao() {
    if (!maxApiUrl || !terminal) return;
    setTestStatus("testing");
    setTestErro("");
    setTestInfo(null);
    try {
      const res = await fetch("/api/admin/testar-maxapi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxApiUrl, terminal, empId: loja.empId }),
      });
      const data = (await res.json()) as { success: boolean; erro?: string; info?: string };
      if (data.success) {
        setTestStatus("ok");
        setTestInfo(data.info ?? null);
      } else {
        setTestStatus("erro");
        setTestErro(data.erro ?? "Falha na conexão");
      }
    } catch {
      setTestStatus("erro");
      setTestErro("Erro de rede ao testar MaxAPI");
    }
  }

  return (
    <form
      action={formAction}
      className="bg-white rounded-xl border border-slate-200 p-6 space-y-5"
      style={{ animation: "fadeInUp 0.35s ease-out both", animationDelay: "50ms" }}
    >

      {state.erro && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs text-red-700 font-mono">{state.erro}</p>
        </div>
      )}

      {/* URL */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">URL da MaxAPI</label>
        <input
          type="text"
          name="maxApiUrl"
          value={maxApiUrl}
          onChange={(e) => setMaxApiUrl(e.target.value)}
          placeholder="https://maxapi.exemplo.com:8080"
          className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all bg-white"
        />
        <p className="text-xs text-slate-400 mt-0.5">
          Cloudflare Tunnel apontando para a porta da MaxAPI no servidor MaxManager.
        </p>
      </div>

      {/* Terminal */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Terminal</label>
        <input
          type="text"
          name="terminalMaxdata"
          value={terminal}
          onChange={(e) => setTerminal(e.target.value)}
          placeholder="1"
          className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all bg-white"
        />
        <p className="text-xs text-slate-400 mt-0.5">
          Número do terminal configurado no MaxManager. Padrão: 1.
        </p>
      </div>

      {/* Testar conexão */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={testarConexao}
          disabled={testStatus === "testing" || !maxApiUrl || !terminal}
          className="inline-flex items-center gap-2 border border-slate-200 rounded-lg px-3.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {testStatus === "idle"    && <Plug         className="h-3.5 w-3.5" />}
          {testStatus === "testing" && <Loader2      className="h-3.5 w-3.5 animate-spin" />}
          {testStatus === "ok"      && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
          {testStatus === "erro"    && <XCircle      className="h-3.5 w-3.5 text-red-500" />}
          <span
            className={
              testStatus === "ok"   ? "text-green-600" :
              testStatus === "erro" ? "text-red-600"   : ""
            }
          >
            {testStatus === "idle"    && "Testar conexão"}
            {testStatus === "testing" && "Testando..."}
            {testStatus === "ok"      && "Autenticação OK"}
            {testStatus === "erro"    && "Falha — clique para tentar de novo"}
          </span>
        </button>

        {testStatus === "erro" && testErro && (
          <p className="text-xs text-red-600 font-mono bg-red-50 border border-red-100 rounded px-3 py-2">
            {testErro}
          </p>
        )}

        {testStatus === "ok" && testInfo && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
            <p className="text-xs text-green-700">{testInfo}</p>
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
        <Link
          href={`/admin/empresas/${tenantId}?aba=lojas`}
          className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
        >
          Cancelar
        </Link>
        <SubmitButton />
      </div>
    </form>
  );
}
