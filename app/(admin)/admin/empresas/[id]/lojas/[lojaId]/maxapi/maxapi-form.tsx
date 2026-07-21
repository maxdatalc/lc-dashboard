"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import Link from "next/link";
import { Plug, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminButton } from "@/components/admin/AdminButton";

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
    <AdminButton type="submit" disabled={pending}>
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {pending ? "Salvando..." : "Salvar configuração"}
    </AdminButton>
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
    <form action={formAction}>
    <AdminCard className="space-y-5 p-6">

      {state.erro && (
        <div
          className="rounded-lg px-3 py-2"
          style={{ background: "var(--adm-alert-soft)", border: "1px solid var(--adm-alert)" }}
        >
          <p className="adm-mono text-xs" style={{ color: "var(--adm-alert)" }}>{state.erro}</p>
        </div>
      )}

      {/* URL */}
      <div>
        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>URL da MaxAPI</label>
        <input
          type="text"
          name="maxApiUrl"
          value={maxApiUrl}
          onChange={(e) => setMaxApiUrl(e.target.value)}
          placeholder="https://maxapi.exemplo.com:8080"
          className="adm-field adm-focusable w-full px-3.5 py-2.5 text-sm"
        />
        <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>
          Cloudflare Tunnel apontando para a porta da MaxAPI no servidor MaxManager.
        </p>
      </div>

      {/* Terminal */}
      <div>
        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>Terminal</label>
        <input
          type="text"
          name="terminalMaxdata"
          value={terminal}
          onChange={(e) => setTerminal(e.target.value)}
          placeholder="1"
          className="adm-field adm-focusable w-full px-3.5 py-2.5 text-sm"
        />
        <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>
          Número do terminal configurado no MaxManager. Padrão: 1.
        </p>
      </div>

      {/* Testar conexão */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={testarConexao}
          disabled={testStatus === "testing" || !maxApiUrl || !terminal}
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
            {testStatus === "ok"      && "Autenticação OK"}
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

        {testStatus === "ok" && testInfo && (
          <div className="rounded-lg px-3 py-2" style={{ background: "var(--adm-signal-soft)", border: "1px solid var(--adm-signal)" }}>
            <p className="text-xs" style={{ color: "var(--adm-signal)" }}>{testInfo}</p>
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="flex justify-end gap-3 pt-2" style={{ borderTop: "1px solid var(--adm-line)" }}>
        <Link
          href={`/admin/empresas/${tenantId}?aba=lojas`}
          className="adm-focusable rounded px-4 py-2 text-sm transition-colors"
          style={{ color: "var(--adm-text-dim)" }}
        >
          Cancelar
        </Link>
        <SubmitButton />
      </div>
    </AdminCard>
    </form>
  );
}
