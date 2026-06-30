"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import Link from "next/link";
import { Plug, Loader2, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react";

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
    <form
      action={formAction}
      className="bg-white rounded-xl border border-slate-200 p-6 space-y-5"
      style={{ animation: "fadeInUp 0.35s ease-out both", animationDelay: "50ms" }}
    >
      <input type="hidden" name="empId"       value={empresa.empId} />
      <input type="hidden" name="cnpj"        value={empresa.cnpj} />
      <input type="hidden" name="razaoSocial" value={empresa.razaoSocial} />

      {state.erro && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs text-red-700 font-mono">{state.erro}</p>
        </div>
      )}

      {state.sucesso && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <p className="text-xs text-green-700 font-medium">Configuração salva com sucesso.</p>
        </div>
      )}

      {/* Empresa info (somente leitura) */}
      <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 space-y-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Empresa</p>
        <p className="text-sm font-semibold text-slate-900">{empresa.razaoSocial}</p>
        <p className="text-xs text-slate-400 font-mono">
          CNPJ {empresa.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}
          {" · "}empId {empresa.empId}
        </p>
      </div>

      {/* Data de início */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Sincronizar NFs emitidas a partir de
        </label>
        <input
          type="date"
          name="dataInicio"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all bg-white"
        />
        <p className="text-xs text-slate-400 mt-0.5">
          NFs anteriores a esta data são ignoradas. Padrão: data de ativação do módulo.
        </p>
      </div>

      {/* OAuth Token */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          OAuth Token SIEG{" "}
          <span className="text-slate-400 font-normal">
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
            className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all bg-white font-mono"
          />
          <button
            type="button"
            onClick={() => setMostrarToken(!mostrarToken)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {mostrarToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          Token OAuth 2.0 obtido no portal SIEG para este CNPJ. Será armazenado criptografado.
        </p>
      </div>

      {/* Ativo */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-700">Sincronização ativa</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Quando desativado, os XMLs desta empresa não serão enviados automaticamente.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            name="ativo"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-10 h-5 bg-slate-200 peer-checked:bg-slate-900 rounded-full transition-colors peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform" />
        </label>
      </div>

      {/* Testar conexão */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={testarConexao}
          disabled={testStatus === "testing" || (!oauthToken && !jaConfigurado)}
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
            {testStatus === "idle"    && "Testar autenticação SIEG"}
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
