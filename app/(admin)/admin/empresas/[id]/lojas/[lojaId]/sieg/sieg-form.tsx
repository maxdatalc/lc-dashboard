"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import Link from "next/link";
import { Plug, Loader2, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminButton } from "@/components/admin/AdminButton";

type TestStatus = "idle" | "testing" | "ok" | "erro";

interface EmpresaConfig {
  empId: number;
  cnpj: string;
  razaoSocial: string;
  oauthTokenMascarado: string; // "••••••••" se já configurado, "" se não
  ativo: boolean;
  dataInicio: string; // ISO date — só NFs a partir desta data
}

interface Props {
  action: (
    prevState: { erro: string | null; sucesso?: boolean },
    formData: FormData,
  ) => Promise<{ erro: string | null; sucesso?: boolean }>;
  empresa: EmpresaConfig;
  lojaId: string;
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

export default function SiegForm({ action, empresa, lojaId, tenantId }: Props) {
  const [state, formAction] = useFormState(action, { erro: null });
  const [oauthToken, setOauthToken] = useState("");
  const [mostrarToken, setMostrarToken] = useState(false);
  const [ativo, setAtivo] = useState(empresa.ativo);
  const [dataInicio, setDataInicio] = useState(empresa.dataInicio.slice(0, 10));
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testErro, setTestErro] = useState("");

  const jaConfigurado = !!empresa.oauthTokenMascarado;

  async function testarConexao() {
    if (!oauthToken && !jaConfigurado) return;
    setTestStatus("testing");
    setTestErro("");
    try {
      const res = await fetch("/api/admin/sieg/testar-conexao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lojaId, empId: empresa.empId, oauthToken: oauthToken || undefined }),
      });
      const data = (await res.json()) as { ok: boolean; erro?: string };
      if (data.ok) {
        setTestStatus("ok");
      } else {
        setTestStatus("erro");
        setTestErro(data.erro ?? "Falha na autenticação SIEG");
      }
    } catch {
      setTestStatus("erro");
      setTestErro("Erro de rede ao testar conexão SIEG");
    }
  }

  return (
    <form action={formAction}>
    <AdminCard className="space-y-5 p-6">
      <input type="hidden" name="empId"       value={empresa.empId} />
      <input type="hidden" name="cnpj"        value={empresa.cnpj} />
      <input type="hidden" name="razaoSocial" value={empresa.razaoSocial} />

      {state.erro && (
        <div className="rounded-lg px-3 py-2" style={{ background: "var(--adm-alert-soft)", border: "1px solid var(--adm-alert)" }}>
          <p className="adm-mono text-xs" style={{ color: "var(--adm-alert)" }}>{state.erro}</p>
        </div>
      )}

      {state.sucesso && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "var(--adm-signal-soft)", border: "1px solid var(--adm-signal)" }}>
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: "var(--adm-signal)" }} />
          <p className="text-xs font-medium" style={{ color: "var(--adm-signal)" }}>Configuração salva com sucesso.</p>
        </div>
      )}

      {/* Empresa info (somente leitura) */}
      <div className="space-y-1 rounded-lg px-4 py-3" style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-line)" }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-faint)" }}>Empresa</p>
        <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>{empresa.razaoSocial}</p>
        <p className="adm-mono text-xs" style={{ color: "var(--adm-text-faint)" }}>
          CNPJ {empresa.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}
          {" · "}empId {empresa.empId}
        </p>
      </div>

      {/* Data de início */}
      <div>
        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
          Sincronizar NFs emitidas a partir de
        </label>
        <input
          type="date"
          name="dataInicio"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          className="adm-field adm-focusable w-full px-3.5 py-2.5 text-sm"
        />
        <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>
          NFs anteriores a esta data são ignoradas. Padrão: data de ativação do módulo.
        </p>
      </div>

      {/* OAuth Token */}
      <div>
        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
          OAuth Token SIEG{" "}
          <span className="font-normal" style={{ color: "var(--adm-text-faint)" }}>
            {jaConfigurado ? "(já configurado — deixe em branco para manter)" : ""}
          </span>
        </label>
        <div className="relative">
          <input
            type={mostrarToken ? "text" : "password"}
            name="oauthToken"
            value={oauthToken}
            onChange={(e) => setOauthToken(e.target.value)}
            placeholder={jaConfigurado ? "••••••••  (manter atual)" : "Cole o X-OAuth-Token recebido da SIEG"}
            className="adm-field adm-focusable adm-mono w-full px-3.5 py-2.5 pr-10 text-sm"
          />
          <button
            type="button"
            onClick={() => setMostrarToken(!mostrarToken)}
            className="adm-focusable absolute right-3 top-1/2 -translate-y-1/2 rounded"
            style={{ color: "var(--adm-text-faint)" }}
          >
            {mostrarToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>
          Token OAuth 2.0 obtido no portal SIEG para este CNPJ. Será armazenado criptografado.
        </p>
      </div>

      {/* Ativo */}
      <div className="flex items-center justify-between rounded-lg px-4 py-3" style={{ border: "1px solid var(--adm-line-strong)" }}>
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--adm-text)" }}>Sincronização ativa</p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>
            Quando desativado, os XMLs desta empresa não serão enviados automaticamente.
          </p>
        </div>
        <label className="adm-focusable relative inline-flex cursor-pointer items-center rounded-full">
          <input
            type="checkbox"
            name="ativo"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="peer sr-only"
          />
          <div
            className="relative h-5 w-10 rounded-full transition-colors"
            style={{ background: ativo ? "var(--adm-accent)" : "var(--adm-line-strong)" }}
          >
            <span
              className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
              style={{ transform: ativo ? "translateX(1.25rem)" : "translateX(0.125rem)" }}
            />
          </div>
        </label>
      </div>

      {/* Testar conexão */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={testarConexao}
          disabled={testStatus === "testing" || (!oauthToken && !jaConfigurado)}
          className="adm-focusable inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
          style={{ border: "1px solid var(--adm-line-strong)", color: "var(--adm-text-dim)" }}
        >
          {testStatus === "idle"    && <Plug         className="h-3.5 w-3.5" />}
          {testStatus === "testing" && <Loader2      className="h-3.5 w-3.5 animate-spin" />}
          {testStatus === "ok"      && <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--adm-signal)" }} />}
          {testStatus === "erro"    && <XCircle      className="h-3.5 w-3.5" style={{ color: "var(--adm-alert)" }} />}
          <span style={{ color: testStatus === "ok" ? "var(--adm-signal)" : testStatus === "erro" ? "var(--adm-alert)" : undefined }}>
            {testStatus === "idle"    && "Testar autenticação SIEG"}
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
