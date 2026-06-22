"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Eye, EyeOff, ArrowLeft, Loader2, CheckCircle2, AlertCircle,
  Plus, X, Database, CheckCircle, RefreshCw,
  LayoutDashboard, Landmark, Package, ShoppingCart, Users,
  MessageCircle, Bell, Sparkles, Building2, UserCheck,
  TrendingUp, Zap, BarChart3,
} from "lucide-react";
import { FEATURES_CATALOG } from "@/lib/features";

const ICONE_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, Landmark, Package, ShoppingCart, Users,
  MessageCircle, Bell, Sparkles, Building2, UserCheck,
  TrendingUp, Zap, BarChart3,
};

const INPUT =
  "w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-500 transition-all bg-white";
const LABEL = "block text-xs font-semibold text-slate-700 mb-1.5";
const SELECT =
  "border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-500 transition-all bg-white";
const SECTION_NUM =
  "w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0";

type BridgeStatus = "idle" | "loading" | "connected" | "error";

type BridgeLoja = {
  empId: number;
  razao: string;
  fantasia: string;
  cnpj: string;
};

type LojaForm = {
  id: string;
  empId: string;
  nome: string;
  cnpj: string;
  fromBridge: boolean;
  selecionada: boolean;
};

interface FormState {
  empresaNome: string;
  empresaSlug: string;
  empresaPlano: "free" | "premium";
  featuresAtivas: string[];
  usuarioNome: string;
  usuarioEmail: string;
  usuarioSenha: string;
  usuarioPapel: "owner" | "admin" | "viewer";
}

const FORM_INICIAL: FormState = {
  empresaNome: "",
  empresaSlug: "",
  empresaPlano: "free",
  featuresAtivas: [],
  usuarioNome: "",
  usuarioEmail: "",
  usuarioSenha: "",
  usuarioPapel: "owner",
};

export default function NovaEmpresaPage() {
  const router = useRouter();

  // Bridge SQL
  const [bridgeUrl, setBridgeUrl] = useState("");
  const [bridgeToken, setBridgeToken] = useState("");
  const [verToken, setVerToken] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>("idle");
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [editandoBridge, setEditandoBridge] = useState(false);

  // Lojas
  const [lojas, setLojas] = useState<LojaForm[]>([]);

  // Form
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [loading, setLoading] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [clientesVinculados, setClientesVinculados] = useState(0);
  const [verSenha, setVerSenha] = useState(false);

  async function handleConectarBridge() {
    if (!bridgeUrl || !bridgeToken) {
      setBridgeError("Informe a URL e o token da bridge.");
      return;
    }
    setBridgeStatus("loading");
    setBridgeError(null);

    try {
      const res = await fetch("/api/admin/listar-empresas-bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bridgeUrl, token: bridgeToken }),
      });
      const data = (await res.json()) as { success: boolean; empresas?: BridgeLoja[]; error?: string };

      if (!data.success || !data.empresas) {
        setBridgeStatus("error");
        setBridgeError(data.error ?? "Falha ao conectar à bridge.");
        return;
      }

      const novasBridge: LojaForm[] = data.empresas.map((e) => ({
        id: `bridge-${e.empId}`,
        empId: String(e.empId),
        nome: e.fantasia || e.razao,
        cnpj: e.cnpj ?? "",
        fromBridge: true,
        selecionada: true,
      }));

      // mantém lojas manuais já adicionadas
      const manuais = lojas.filter((l) => !l.fromBridge);
      setLojas([...novasBridge, ...manuais]);
      setBridgeStatus("connected");
      setEditandoBridge(false);
    } catch {
      setBridgeStatus("error");
      setBridgeError("Erro de rede ao conectar à bridge.");
    }
  }

  function handleReconectar() {
    setLojas((prev) => prev.filter((l) => !l.fromBridge));
    setBridgeStatus("idle");
    setEditandoBridge(true);
    setBridgeError(null);
  }

  function handleEmpresaNome(valor: string) {
    const slug = valor
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    setForm((prev) => ({ ...prev, empresaNome: valor, empresaSlug: slug }));
  }

  function atualizarLoja(id: string, campo: keyof LojaForm, valor: string | boolean) {
    setLojas((prev) => prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
  }

  function toggleFeature(key: string) {
    setForm((prev) => {
      const novaLista = prev.featuresAtivas.includes(key)
        ? prev.featuresAtivas.filter((k) => k !== key)
        : [...prev.featuresAtivas, key];
      const temPremium = novaLista.some(
        (k) => FEATURES_CATALOG.find((f) => f.key === k)?.categoria === "premium"
      );
      return { ...prev, featuresAtivas: novaLista, empresaPlano: temPremium ? "premium" : "free" };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErroGeral(null);

    if (!form.empresaNome || !form.empresaSlug) {
      setErroGeral("Preencha o nome e slug da empresa.");
      return;
    }

    const lojasFinal = lojas.filter((l) => l.selecionada);

    if (lojasFinal.length === 0) {
      setErroGeral("Selecione ou adicione ao menos uma loja.");
      return;
    }

    for (let i = 0; i < lojasFinal.length; i++) {
      const l = lojasFinal[i];
      if (!l.nome || !l.empId) {
        setErroGeral(`Preencha nome e EmpId da loja ${i + 1}.`);
        return;
      }
    }

    const empIds = lojasFinal.map((l) => l.empId);
    for (let i = 0; i < empIds.length; i++) {
      for (let j = i + 1; j < empIds.length; j++) {
        if (empIds[i] === empIds[j]) {
          setErroGeral(`EmpId ${empIds[i]} duplicado em duas lojas.`);
          return;
        }
      }
    }

    const temUsuario = !!(form.usuarioNome || form.usuarioEmail || form.usuarioSenha);
    if (temUsuario) {
      if (!form.usuarioNome || !form.usuarioEmail || !form.usuarioSenha) {
        setErroGeral("Preencha todos os dados do usuário ou deixe todos em branco.");
        return;
      }
      if (form.usuarioSenha.length < 8) {
        setErroGeral("A senha deve ter no mínimo 8 caracteres.");
        return;
      }
    }

    const bridgeConectada = bridgeStatus === "connected" && !editandoBridge;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/criar-cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant: {
            name: form.empresaNome,
            slug: form.empresaSlug,
            plan: form.empresaPlano,
          },
          lojas: lojasFinal.map((l) => ({
            name: l.nome,
            empId: Number(l.empId),
            cnpj: l.cnpj || undefined,
            sqlEnabled: l.fromBridge && bridgeConectada,
            sqlBridgeUrl: l.fromBridge && bridgeConectada ? bridgeUrl : undefined,
            sqlBridgeToken: l.fromBridge && bridgeConectada ? bridgeToken : undefined,
          })),
          features: form.featuresAtivas,
          usuario: (form.usuarioNome && form.usuarioEmail && form.usuarioSenha)
            ? {
                email: form.usuarioEmail,
                senha: form.usuarioSenha,
                nomeCompleto: form.usuarioNome,
                papel: form.usuarioPapel,
              }
            : null,
        }),
      });

      const data = (await res.json()) as { error?: string; clientesVinculados?: number };
      if (!res.ok) {
        setErroGeral(data.error ?? "Erro ao cadastrar empresa.");
        return;
      }

      setClientesVinculados(data.clientesVinculados ?? 0);
      setSucesso(true);
      router.refresh();
      setTimeout(() => router.push("/admin/empresas"), 1500);
    } catch {
      setErroGeral("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const coreFeatures = FEATURES_CATALOG.filter((f) => f.categoria === "core");
  const premiumFeatures = FEATURES_CATALOG.filter((f) => f.categoria === "premium");
  const bridgeConectada = bridgeStatus === "connected" && !editandoBridge;
  const lojasCount = lojas.filter((l) => l.selecionada).length;

  if (sucesso) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-96 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="h-9 w-9 text-emerald-500" />
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-slate-900">Empresa cadastrada!</p>
          {clientesVinculados > 0 ? (
            <p className="text-sm text-emerald-600 mt-1 font-medium">
              {clientesVinculados} {clientesVinculados === 1 ? "empresa vinculada" : "empresas vinculadas"} automaticamente na base de clientes.
            </p>
          ) : (
            <p className="text-sm text-slate-400 mt-1">Nenhum cliente encontrado na base para vincular.</p>
          )}
          <p className="text-xs text-slate-400 mt-2">Redirecionando para a lista...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">

      {/* Cabeçalho */}
      <div className="space-y-2" style={{ animation: "fadeInUp 0.3s ease-out both" }}>
        <Link
          href="/admin/empresas"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Todas as empresas
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Empresa</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Conecte ao banco do cliente para importar as lojas automaticamente.
          </p>
        </div>
      </div>

      {erroGeral && (
        <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {erroGeral}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Seção 1 — Lojas / Bridge SQL ─────────────────────────────────────── */}
        <section
          className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
          style={{ animation: "fadeInUp 0.3s ease-out both", animationDelay: "50ms" }}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className={SECTION_NUM}>1</span>
              <h2 className="text-sm font-semibold text-slate-900">Lojas do Cliente</h2>
              {bridgeConectada && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                  <CheckCircle className="h-3 w-3" />
                  Bridge conectada
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 pl-7">
              Conecte à bridge SQL para importar lojas do MaxManager automaticamente, ou adicione manualmente.
            </p>
          </div>

          {/* Painel de conexão Bridge */}
          {!bridgeConectada ? (
            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-medium text-slate-700">Conectar via Bridge SQL</p>
              </div>

              {bridgeError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {bridgeError}
                </div>
              )}

              <div>
                <label className={LABEL}>URL da Bridge</label>
                <input
                  type="url"
                  value={bridgeUrl}
                  onChange={(e) => setBridgeUrl(e.target.value)}
                  className={INPUT}
                  placeholder="https://sql-cliente.lctecnologias.com.br"
                />
              </div>

              <div>
                <label className={LABEL}>Token</label>
                <div className="relative">
                  <input
                    type={verToken ? "text" : "password"}
                    value={bridgeToken}
                    onChange={(e) => setBridgeToken(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleConectarBridge())}
                    className={INPUT + " pr-10 font-mono"}
                    placeholder="Token gerado pelo instalar-bridge.ps1"
                  />
                  <button
                    type="button"
                    onClick={() => setVerToken((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {verToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConectarBridge}
                disabled={bridgeStatus === "loading" || !bridgeUrl || !bridgeToken}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {bridgeStatus === "loading"
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Database className="h-4 w-4" />}
                {bridgeStatus === "loading" ? "Conectando..." : "Conectar e Buscar Lojas"}
              </button>
            </div>
          ) : (
            /* Bridge conectada — barra de status */
            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-emerald-700 truncate">{bridgeUrl}</p>
                <p className="text-xs text-emerald-600">
                  {lojasCount} {lojasCount === 1 ? "loja selecionada" : "lojas selecionadas"} de{" "}
                  {lojas.filter((l) => l.fromBridge).length} encontradas
                </p>
              </div>
              <button
                type="button"
                onClick={handleReconectar}
                className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-800 shrink-0 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Reconectar
              </button>
            </div>
          )}

          {/* Lista de lojas */}
          {lojas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">
                {bridgeConectada
                  ? "Lojas encontradas — selecione as que deseja cadastrar:"
                  : "Lojas adicionadas:"}
              </p>

              {lojas.map((loja, idx) => (
                <div
                  key={loja.id}
                  className={`rounded-xl border p-3.5 space-y-3 transition-colors ${
                    loja.selecionada ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {loja.fromBridge ? (
                      <input
                        type="checkbox"
                        checked={loja.selecionada}
                        onChange={(e) => atualizarLoja(loja.id, "selecionada", e.target.checked)}
                        className="rounded border-slate-300 text-slate-700 focus:ring-slate-400 shrink-0"
                      />
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}

                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 shrink-0">
                      {loja.fromBridge ? `EmpId ${loja.empId}` : `Loja manual ${idx + 1}`}
                    </span>

                    {loja.fromBridge && (
                      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                        bridge
                      </span>
                    )}

                    <span className="flex-1" />

                    {!loja.fromBridge && (
                      <button
                        type="button"
                        onClick={() => setLojas((prev) => prev.filter((l) => l.id !== loja.id))}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                        Remover
                      </button>
                    )}
                  </div>

                  {loja.selecionada && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                      <div>
                        <label className={LABEL}>
                          Nome <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={loja.nome}
                          onChange={(e) => atualizarLoja(loja.id, "nome", e.target.value)}
                          className={INPUT}
                          placeholder="Nome da loja"
                        />
                      </div>

                      <div>
                        <label className={LABEL}>CNPJ</label>
                        <input
                          type="text"
                          value={loja.cnpj}
                          onChange={(e) => atualizarLoja(loja.id, "cnpj", e.target.value)}
                          className={INPUT}
                          placeholder="00.000.000/0000-00"
                        />
                      </div>

                      {!loja.fromBridge && (
                        <div>
                          <label className={LABEL}>
                            EmpId <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={loja.empId}
                            onChange={(e) => atualizarLoja(loja.id, "empId", e.target.value)}
                            className={INPUT}
                            placeholder="ID no MaxManager"
                          />
                          <p className="text-xs text-slate-400 mt-1">cofId da tabela config</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setLojas((prev) => [...prev, { id: `manual-${Date.now()}`, empId: "", nome: "", cnpj: "", fromBridge: false, selecionada: true }])}
            className="w-full flex items-center justify-center gap-2 border border-dashed border-slate-200 rounded-xl py-2.5 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all"
          >
            <Plus className="h-4 w-4" />
            Adicionar loja manualmente
          </button>
        </section>

        {/* ── Seção 2 — Dados da Empresa ─────────────────────────────────────── */}
        <section
          className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
          style={{ animation: "fadeInUp 0.3s ease-out both", animationDelay: "100ms" }}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className={SECTION_NUM}>2</span>
              <h2 className="text-sm font-semibold text-slate-900">Dados da Empresa</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 pl-7">Nome de exibição e identificador único</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>
                Nome da Empresa <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.empresaNome}
                onChange={(e) => handleEmpresaNome(e.target.value)}
                required
                className={INPUT}
                placeholder="Ex: Supermercado Modelo"
              />
            </div>

            <div>
              <label className={LABEL}>Slug</label>
              <input
                type="text"
                value={form.empresaSlug}
                onChange={(e) => setForm((prev) => ({ ...prev, empresaSlug: e.target.value }))}
                required
                className={INPUT + " font-mono"}
                placeholder="supermercado-modelo"
              />
            </div>
          </div>

          <div>
            <label className={LABEL}>Plano inicial</label>
            <select
              value={form.empresaPlano}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, empresaPlano: e.target.value as "free" | "premium" }))
              }
              className={SELECT}
            >
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
            <p className="text-xs text-slate-400 mt-1.5">
              Ajustado automaticamente ao ativar módulos premium.
            </p>
          </div>
        </section>

        {/* ── Seção 3 — Módulos ─────────────────────────────────────────────── */}
        <section
          className="bg-white rounded-xl border border-slate-200 p-5 space-y-5"
          style={{ animation: "fadeInUp 0.3s ease-out both", animationDelay: "150ms" }}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className={SECTION_NUM}>3</span>
              <h2 className="text-sm font-semibold text-slate-900">Módulos Contratados</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 pl-7">Ative os módulos premium incluídos no contrato</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Core — sempre incluídos
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {coreFeatures.map((f) => {
                const Icone = ICONE_MAP[f.icone] ?? Package;
                return (
                  <div key={f.key} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <Icone className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">{f.label}</p>
                      <p className="text-xs text-slate-400">{f.descricao}</p>
                    </div>
                    <div className="w-8 h-4 bg-slate-300 rounded-full shrink-0 mt-0.5 cursor-not-allowed" />
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Premium — módulos pagos
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {premiumFeatures.map((f) => {
                const Icone = ICONE_MAP[f.icone] ?? Zap;
                const ativo = form.featuresAtivas.includes(f.key);
                return (
                  <div
                    key={f.key}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      ativo ? "bg-purple-50 border-purple-200" : "bg-white border-slate-200"
                    } ${!f.disponivel ? "opacity-60" : ""}`}
                  >
                    <Icone className={`h-4 w-4 mt-0.5 shrink-0 ${ativo ? "text-purple-500" : "text-slate-400"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-700">{f.label}</p>
                        {!f.disponivel && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Em breve</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{f.descricao}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!f.disponivel}
                      onClick={() => toggleFeature(f.key)}
                      className={`relative w-8 h-4 rounded-full transition-colors shrink-0 mt-0.5 ${
                        !f.disponivel ? "bg-slate-200 cursor-not-allowed" : ativo ? "bg-purple-500" : "bg-slate-300"
                      }`}
                    >
                      <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${ativo ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-slate-500 border-t border-slate-50 pt-3">
            Plano atual:{" "}
            <strong className={form.empresaPlano === "premium" ? "text-amber-600" : "text-slate-700"}>
              {form.empresaPlano === "premium" ? "★ Premium" : "Free"}
            </strong>
          </p>
        </section>

        {/* ── Seção 4 — Acesso do Gestor ────────────────────────────────────── */}
        <section
          className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
          style={{ animation: "fadeInUp 0.3s ease-out both", animationDelay: "200ms" }}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className={SECTION_NUM}>4</span>
              <h2 className="text-sm font-semibold text-slate-900">Acesso do Gestor</h2>
              <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Opcional</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 pl-7">
              Deixe em branco para cadastrar usuários depois pela aba Usuários.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Nome Completo</label>
              <input
                type="text"
                value={form.usuarioNome}
                onChange={(e) => setForm((prev) => ({ ...prev, usuarioNome: e.target.value }))}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>E-mail</label>
              <input
                type="email"
                value={form.usuarioEmail}
                onChange={(e) => setForm((prev) => ({ ...prev, usuarioEmail: e.target.value }))}
                className={INPUT}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Senha provisória</label>
              <div className="relative">
                <input
                  type={verSenha ? "text" : "password"}
                  value={form.usuarioSenha}
                  onChange={(e) => setForm((prev) => ({ ...prev, usuarioSenha: e.target.value }))}
                  minLength={8}
                  className={INPUT + " pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setVerSenha((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.usuarioSenha.length > 0 && form.usuarioSenha.length < 8 && (
                <p className="text-xs text-red-500 mt-1">Mínimo de 8 caracteres</p>
              )}
            </div>
            <div>
              <label className={LABEL}>Papel</label>
              <select
                value={form.usuarioPapel}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    usuarioPapel: e.target.value as "owner" | "admin" | "viewer",
                  }))
                }
                className={SELECT + " w-full"}
              >
                <option value="owner">Proprietário (acesso total)</option>
                <option value="admin">Administrador (pode editar)</option>
                <option value="viewer">Visualizador (só leitura)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Botão submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl py-3 font-semibold hover:bg-slate-700 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:-translate-y-px"
          style={{ animation: "fadeInUp 0.3s ease-out both", animationDelay: "250ms" }}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading
            ? "Cadastrando..."
            : `Cadastrar empresa (${lojasCount} ${lojasCount === 1 ? "loja" : "lojas"})`}
        </button>
      </form>
    </div>
  );
}
