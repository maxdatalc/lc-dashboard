"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, Loader2, AlertCircle, Building2, RefreshCw } from "lucide-react";

interface EmpresaBridge {
  empId: number;
  razao: string;
  fantasia: string;
}

export default function NovaLojaPage() {
  const router = useRouter();
  const { id: tenantId } = useParams<{ id: string }>();

  const [nome, setNome] = useState("");
  const [empId, setEmpId] = useState("");
  const [sqlEnabled, setSqlEnabled] = useState(false);
  const [bridgeUrl, setBridgeUrl] = useState("");
  const [bridgeToken, setBridgeToken] = useState("");
  const [verToken, setVerToken] = useState(false);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Empresas disponíveis na bridge
  const [empresas, setEmpresas] = useState<EmpresaBridge[]>([]);
  const [buscandoEmpresas, setBuscandoEmpresas] = useState(false);
  const [erroEmpresas, setErroEmpresas] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Busca automática ao preencher url + token
  useEffect(() => {
    if (!sqlEnabled || !bridgeUrl || !bridgeToken) {
      setEmpresas([]);
      setErroEmpresas(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      buscarEmpresas();
    }, 600);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sqlEnabled, bridgeUrl, bridgeToken]);

  async function buscarEmpresas() {
    setBuscandoEmpresas(true);
    setErroEmpresas(null);
    setEmpresas([]);
    try {
      const res = await fetch("/api/admin/listar-empresas-bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bridgeUrl, token: bridgeToken }),
      });
      const data = await res.json() as { success?: boolean; empresas?: EmpresaBridge[]; error?: string };
      if (!data.success) {
        setErroEmpresas(data.error ?? "Erro ao consultar bridge.");
        return;
      }
      setEmpresas(data.empresas ?? []);
      // Auto-seleciona se só tiver uma
      if ((data.empresas ?? []).length === 1) {
        const e = data.empresas![0];
        setEmpId(String(e.empId));
        if (!nome) setNome(e.fantasia || e.razao);
      }
    } catch {
      setErroEmpresas("Erro de rede ao consultar bridge.");
    } finally {
      setBuscandoEmpresas(false);
    }
  }

  function selecionarEmpresa(e: EmpresaBridge) {
    setEmpId(String(e.empId));
    if (!nome) setNome(e.fantasia || e.razao);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome || !empId) {
      setErro("Nome e EmpId são obrigatórios.");
      return;
    }
    if (sqlEnabled && (!bridgeUrl || !bridgeToken)) {
      setErro("Informe URL e token da bridge para habilitar a conexão SQL.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/adicionar-loja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          name: nome,
          empId: Number(empId),
          sqlEnabled,
          sqlBridgeUrl: sqlEnabled ? bridgeUrl : undefined,
          sqlBridgeToken: sqlEnabled ? bridgeToken : undefined,
        }),
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

  const empresaSelecionada = empresas.find((e) => String(e.empId) === empId);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
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

        {/* Bridge SQL — agora primeiro para descobrir empresas */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="sql-enabled"
              checked={sqlEnabled}
              onChange={(e) => setSqlEnabled(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
            />
            <label htmlFor="sql-enabled" className="cursor-pointer">
              <p className="text-sm font-medium text-slate-700">Habilitar Dashboard SQL (lc-sql-bridge)</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Conecta ao SQL Server desta loja via bridge instalada na máquina do cliente.
              </p>
            </label>
          </div>

          {sqlEnabled && (
            <div className="space-y-4 pl-6 border-l-2 border-cyan-100">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  URL da Bridge <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={bridgeUrl}
                  onChange={(e) => setBridgeUrl(e.target.value)}
                  placeholder="https://sql-cliente.lctecnologias.com.br"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
                <p className="text-xs text-slate-400 mt-0.5">
                  Cloudflare Tunnel apontando para porta 3055 da bridge.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Token de segurança <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={verToken ? "text" : "password"}
                    value={bridgeToken}
                    onChange={(e) => setBridgeToken(e.target.value)}
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
                <p className="text-xs text-slate-400 mt-0.5">Armazenado criptografado (AES-256-GCM).</p>
              </div>

              {/* Empresas encontradas na bridge */}
              {buscandoEmpresas && (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Consultando empresas no banco...
                </div>
              )}

              {erroEmpresas && (
                <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {erroEmpresas}
                </div>
              )}

              {empresas.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      Empresas encontradas no banco ({empresas.length})
                    </p>
                    <button
                      type="button"
                      onClick={buscarEmpresas}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Atualizar
                    </button>
                  </div>
                  <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                    {empresas.map((emp) => {
                      const selected = String(emp.empId) === empId;
                      return (
                        <button
                          key={emp.empId}
                          type="button"
                          onClick={() => selecionarEmpresa(emp)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                            selected
                              ? "bg-cyan-50 border-l-2 border-l-cyan-500"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`text-xs font-mono font-semibold min-w-[28px] text-center rounded px-1 py-0.5 ${
                              selected ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {emp.empId}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${selected ? "text-cyan-700" : "text-slate-800"}`}>
                              {emp.fantasia || emp.razao}
                            </p>
                            {emp.fantasia && emp.razao !== emp.fantasia && (
                              <p className="text-xs text-slate-400 truncate">{emp.razao}</p>
                            )}
                          </div>
                          {selected && (
                            <span className="text-xs text-cyan-600 font-medium shrink-0">Selecionada</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <hr className="border-slate-100" />

        {/* Nome e EmpId */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Nome da Loja <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              placeholder="Ex: Comercial Aliança — Centro"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            {empresaSelecionada && (
              <p className="text-xs text-slate-400 mt-0.5">
                Pré-preenchido da empresa selecionada. Edite se quiser.
              </p>
            )}
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
              placeholder={empresas.length ? "Selecione acima ou digite" : "Ex: 2"}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <p className="text-xs text-slate-400 mt-0.5">
              {empresas.length
                ? "Preenchido ao selecionar a empresa acima."
                : "ID da empresa no MaxManager"}
            </p>
          </div>
        </div>

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
