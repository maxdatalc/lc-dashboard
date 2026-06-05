"use client";

// Formulário para adicionar uma loja a uma empresa existente
// Client Component — precisa de estado para teste de conexão

import { useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Plug,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

type TestStatus = "idle" | "testing" | "ok" | "erro";

export default function NovaLojaPage() {
  const router = useRouter();
  const { id: tenantId } = useParams<{ id: string }>();

  const [nome, setNome] = useState("");
  const [empId, setEmpId] = useState("");
  const [erpBaseUrl, setErpBaseUrl] = useState("");
  const [terminal, setTerminal] = useState("");
  const [verTerminal, setVerTerminal] = useState(false);

  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testErro, setTestErro] = useState("");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const testarConexao = useCallback(async () => {
    if (!erpBaseUrl || !empId || !terminal) return;

    setTestStatus("testing");
    setTestErro("");

    try {
      const res = await fetch("/api/admin/testar-conexao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ erpBaseUrl, empId: Number(empId), terminal }),
      });
      const data = (await res.json()) as { success: boolean; erro?: string };
      setTestStatus(data.success ? "ok" : "erro");
      if (!data.success) setTestErro(data.erro ?? "Falha na conexão");
    } catch {
      setTestStatus("erro");
      setTestErro("Erro de rede ao testar conexão");
    }
  }, [erpBaseUrl, empId, terminal]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome || !empId || !erpBaseUrl || !terminal) {
      setErro("Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/adicionar-loja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, name: nome, empId: Number(empId), erpBaseUrl, terminal }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || !data.success) {
        setErro(data.error ?? "Erro ao adicionar loja.");
        return;
      }

      router.push(`/admin/empresas/${tenantId}?aba=lojas`);
    } catch {
      setErro("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/empresas/${tenantId}?aba=lojas`}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-xl font-bold text-slate-900">Adicionar Loja</h1>
      </div>

      {erro && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {erro}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Nome da Empresa no MaxData <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            placeholder="Ex: Comercial Aliança — Filial Centro"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            EmpId <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={1}
            value={empId}
            onChange={(e) => setEmpId(e.target.value)}
            required
            placeholder="Ex: 2"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <p className="text-xs text-slate-400 mt-0.5">Consulte MaxData → Empresas</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            URL do Túnel Cloudflare <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={erpBaseUrl}
            onChange={(e) => setErpBaseUrl(e.target.value)}
            required
            placeholder="https://erp-cliente.lctecnologias.com.br"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Terminal MaxData <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={verTerminal ? "text" : "password"}
              value={terminal}
              onChange={(e) => setTerminal(e.target.value)}
              required
              placeholder="Cole o terminal gerado no painel MaxData"
              className="w-full border border-slate-300 rounded-md px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <button
              type="button"
              onClick={() => setVerTerminal((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              {verTerminal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-red-500 mt-0.5">
            Nunca compartilhe este código. Armazenado criptografado.
          </p>
        </div>

        <button
          type="button"
          onClick={testarConexao}
          disabled={testStatus === "testing" || !erpBaseUrl || !empId || !terminal}
          className="inline-flex items-center gap-2 border border-slate-300 rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {testStatus === "idle" && <Plug className="h-3.5 w-3.5" />}
          {testStatus === "testing" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {testStatus === "ok" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
          {testStatus === "erro" && <XCircle className="h-3.5 w-3.5 text-red-500" />}
          <span className={testStatus === "ok" ? "text-green-600" : testStatus === "erro" ? "text-red-600" : ""}>
            {testStatus === "idle" && "Testar conexão"}
            {testStatus === "testing" && "Testando..."}
            {testStatus === "ok" && "Conexão OK"}
            {testStatus === "erro" && (testErro || "Falha na conexão")}
          </span>
        </button>

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <Link
            href={`/admin/empresas/${tenantId}?aba=lojas`}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading ? "Salvando..." : "Adicionar Loja"}
          </button>
        </div>
      </form>
    </div>
  );
}
