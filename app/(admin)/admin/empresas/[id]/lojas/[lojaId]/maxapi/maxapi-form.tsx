"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import Link from "next/link";
import { Plug, Loader2, CheckCircle2, XCircle, Copy } from "lucide-react";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminBadge } from "@/components/admin/AdminBadge";
import type { LojaMaxApiStatus } from "@/lib/db/tenants";
import TerminalPicker from "./terminal-picker";

type TestStatus = "idle" | "testing" | "ok" | "erro";

export type MaxApiFormState = { erro: string | null; ok: boolean; aplicadas: number };

interface Props {
  action: (prevState: MaxApiFormState, formData: FormData) => Promise<MaxApiFormState>;
  loja: {
    id: string;
    maxApiUrl: string;
    terminalMaxdata: string;
    empId: number;
    sqlEnabled: boolean;
  };
  outrasLojas: LojaMaxApiStatus[];
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

export default function MaxApiForm({ action, loja, outrasLojas, tenantId }: Props) {
  const [state, formAction] = useFormState(action, { erro: null, ok: false, aplicadas: 0 });
  const [maxApiUrl, setMaxApiUrl] = useState(loja.maxApiUrl);
  const [terminal, setTerminal] = useState(loja.terminalMaxdata);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testErro, setTestErro] = useState("");
  const [testInfo, setTestInfo] = useState<string | null>(null);
  const [aplicarEm, setAplicarEm] = useState<Set<string>>(new Set());
  const [mostrarAplicar, setMostrarAplicar] = useState(false);

  function toggleLoja(id: string) {
    setAplicarEm((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

      {state.ok && (
        <div
          className="rounded-lg px-3 py-2"
          style={{ background: "var(--adm-signal-soft)", border: "1px solid var(--adm-signal)" }}
        >
          <p className="text-xs" style={{ color: "var(--adm-signal)" }}>
            Configuração salva
            {state.aplicadas > 0
              ? ` e aplicada em mais ${state.aplicadas} ${state.aplicadas === 1 ? "loja" : "lojas"}.`
              : "."}
          </p>
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
          placeholder="5643E3167417E9D8D055BD65BD47095E"
          className="adm-field adm-focusable w-full px-3.5 py-2.5 text-sm"
        />
        <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>
          Código do dispositivo cadastrado na tela 470 do MaxManager (32 caracteres hexadecimais).
        </p>

        {loja.sqlEnabled && (
          <TerminalPicker lojaId={loja.id} valorAtual={terminal} onSelect={setTerminal} />
        )}
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

      {/* Aplicar em outras lojas */}
      {outrasLojas.length > 0 && (
        <div className="space-y-3" style={{ borderTop: "1px solid var(--adm-line)", paddingTop: "1.25rem" }}>
          <button
            type="button"
            onClick={() => setMostrarAplicar((v) => !v)}
            className="adm-focusable flex items-center gap-1.5 rounded text-xs font-medium transition-colors"
            style={{ color: "var(--adm-text-dim)" }}
          >
            <Copy className="h-3.5 w-3.5" />
            Aplicar também em outras lojas
            {aplicarEm.size > 0 && (
              <span className="ml-1">
                <AdminBadge variant="accent">{aplicarEm.size} selecionada{aplicarEm.size !== 1 ? "s" : ""}</AdminBadge>
              </span>
            )}
            <span className="ml-0.5">{mostrarAplicar ? "▴" : "▾"}</span>
          </button>

          {mostrarAplicar && (
            <div className="space-y-2">
              <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>
                A mesma URL e o mesmo terminal serão gravados nas lojas marcadas, substituindo o que
                estiver lá.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setAplicarEm(new Set(outrasLojas.map((l) => l.id)))}
                  className="adm-focusable rounded text-xs underline"
                  style={{ color: "var(--adm-accent)" }}
                >
                  marcar todas
                </button>
                <button
                  type="button"
                  onClick={() => setAplicarEm(new Set())}
                  className="adm-focusable rounded text-xs underline"
                  style={{ color: "var(--adm-text-faint)" }}
                >
                  limpar
                </button>
              </div>

              <div className="overflow-hidden rounded-lg" style={{ border: "1px solid var(--adm-line)" }}>
                {outrasLojas.map((l, i) => {
                  const jaConfigurada = !!(l.maxApiUrl || l.terminalMaxdata);
                  return (
                    <label
                      key={l.id}
                      className="adm-row flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors"
                      style={{ borderTop: i === 0 ? "none" : "1px solid var(--adm-line)" }}
                    >
                      <input
                        type="checkbox"
                        checked={aplicarEm.has(l.id)}
                        onChange={() => toggleLoja(l.id)}
                        className="adm-focusable mt-0.5 h-4 w-4 shrink-0 rounded"
                        style={{ accentColor: "var(--adm-accent)" }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm" style={{ color: "var(--adm-text)" }}>{l.name}</span>
                          <span className="text-xs" style={{ color: "var(--adm-text-faint)" }}>EmpId {l.empId}</span>
                          {jaConfigurada && <AdminBadge variant="warning">já configurada</AdminBadge>}
                        </span>
                        {jaConfigurada && (
                          <span className="adm-mono mt-0.5 block truncate text-xs" style={{ color: "var(--adm-text-faint)" }}>
                            {l.terminalMaxdata || "sem terminal"}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <input type="hidden" name="aplicarEm" value={Array.from(aplicarEm).join(",")} />

      {/* Ações */}
      <div className="flex justify-end gap-3 pt-2" style={{ borderTop: "1px solid var(--adm-line)" }}>
        <Link
          href={`/admin/empresas/${tenantId}?aba=lojas`}
          className="adm-focusable rounded px-4 py-2 text-sm transition-colors"
          style={{ color: "var(--adm-text-dim)" }}
        >
          Voltar
        </Link>
        <SubmitButton />
      </div>
    </AdminCard>
    </form>
  );
}
