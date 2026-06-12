"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Eye, EyeOff, ArrowLeft, Loader2, CheckCircle2, AlertCircle,
  Plus, X,
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

type LojaForm = {
  id: string;
  nome: string;
  empId: string;
  sqlEnabled: boolean;
  sqlBridgeUrl: string;
  sqlBridgeToken: string;
  verToken: boolean;
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

function novaLoja(): LojaForm {
  return {
    id: Date.now().toString(),
    nome: "",
    empId: "",
    sqlEnabled: false,
    sqlBridgeUrl: "",
    sqlBridgeToken: "",
    verToken: false,
  };
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
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [lojas, setLojas] = useState<LojaForm[]>([novaLoja()]);
  const [loading, setLoading] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [verSenha, setVerSenha] = useState(false);

  function handleEmpresaNome(valor: string) {
    const slug = valor
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    setForm((prev) => ({ ...prev, empresaNome: valor, empresaSlug: slug }));
  }

  function adicionarFilial() {
    setLojas((prev) => [...prev, novaLoja()]);
  }

  function removerLoja(id: string) {
    if (lojas.length > 1) {
      setLojas((prev) => prev.filter((l) => l.id !== id));
    }
  }

  function atualizarLoja(id: string, campo: keyof LojaForm, valor: string | boolean) {
    setLojas((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l))
    );
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

    for (let i = 0; i < lojas.length; i++) {
      const loja = lojas[i];
      if (!loja.nome || !loja.empId) {
        setErroGeral(`Preencha nome e EmpId da Loja ${i + 1}.`);
        return;
      }
      if (loja.sqlEnabled && (!loja.sqlBridgeUrl || !loja.sqlBridgeToken)) {
        setErroGeral(`Informe URL e token da bridge na Loja ${i + 1}.`);
        return;
      }
    }

    const empIds = lojas.map((l) => l.empId);
    for (let i = 0; i < empIds.length; i++) {
      for (let j = i + 1; j < empIds.length; j++) {
        if (empIds[i] === empIds[j]) {
          setErroGeral(`EmpId ${empIds[i]} duplicado nas Lojas ${i + 1} e ${j + 1}.`);
          return;
        }
      }
    }

    if (!form.usuarioNome || !form.usuarioEmail || !form.usuarioSenha) {
      setErroGeral("Preencha todos os dados do usuário.");
      return;
    }
    if (form.usuarioSenha.length < 8) {
      setErroGeral("A senha deve ter no mínimo 8 caracteres.");
      return;
    }

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
          lojas: lojas.map((l) => ({
            name: l.nome,
            empId: Number(l.empId),
            sqlEnabled: l.sqlEnabled,
            sqlBridgeUrl: l.sqlEnabled ? l.sqlBridgeUrl : undefined,
            sqlBridgeToken: l.sqlEnabled ? l.sqlBridgeToken : undefined,
          })),
          features: form.featuresAtivas,
          usuario: {
            email: form.usuarioEmail,
            senha: form.usuarioSenha,
            nomeCompleto: form.usuarioNome,
            papel: form.usuarioPapel,
          },
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErroGeral(data.error ?? "Erro ao cadastrar empresa.");
        return;
      }

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

  if (sucesso) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <p className="text-xl font-semibold text-slate-800">Empresa cadastrada com sucesso!</p>
        <p className="text-slate-500 text-sm">Redirecionando...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/empresas"
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-xl font-bold text-slate-900">Nova Empresa</h1>
      </div>

      {erroGeral && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {erroGeral}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Seção 1 — Dados da Empresa ──────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-800">Dados da Empresa</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nome da Empresa <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.empresaNome}
                onChange={(e) => handleEmpresaNome(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Ex: Supermercado Modelo"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Slug</label>
              <input
                type="text"
                value={form.empresaSlug}
                onChange={(e) => setForm((prev) => ({ ...prev, empresaSlug: e.target.value }))}
                required
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="supermercado-modelo"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Plano inicial</label>
            <select
              value={form.empresaPlano}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, empresaPlano: e.target.value as "free" | "premium" }))
              }
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Ajustado automaticamente ao ativar módulos premium.
            </p>
          </div>
        </section>

        {/* ── Seção 2 — Lojas ─────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-slate-800">Lojas / Filiais</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Cada EmpId do MaxManager é uma loja separada. A bridge SQL pode ser configurada depois.
            </p>
          </div>

          {lojas.map((loja, idx) => (
            <div key={loja.id}>
              {idx > 0 && <hr className="border-slate-100 -mx-5" />}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    Loja {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removerLoja(loja.id)}
                    disabled={lojas.length === 1}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    Remover
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Nome <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={loja.nome}
                      onChange={(e) => atualizarLoja(loja.id, "nome", e.target.value)}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                      placeholder="Ex: Comercial Aliança — Centro"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      EmpId <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={loja.empId}
                      onChange={(e) => atualizarLoja(loja.id, "empId", e.target.value)}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                      placeholder="Ex: 1"
                    />
                    <p className="text-xs text-slate-400 mt-0.5">ID da empresa no MaxManager</p>
                  </div>
                </div>

                {/* Bridge SQL */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <input
                    type="checkbox"
                    id={`sql-${loja.id}`}
                    checked={loja.sqlEnabled}
                    onChange={(e) => atualizarLoja(loja.id, "sqlEnabled", e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <label htmlFor={`sql-${loja.id}`} className="cursor-pointer flex-1">
                    <p className="text-sm font-medium text-slate-700">Habilitar Dashboard SQL (lc-sql-bridge)</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Conecta ao SQL Server via bridge instalada na máquina do cliente.
                    </p>
                  </label>
                </div>

                {loja.sqlEnabled && (
                  <div className="space-y-3 pl-4 border-l-2 border-cyan-100">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        URL da Bridge <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="url"
                        value={loja.sqlBridgeUrl}
                        onChange={(e) => atualizarLoja(loja.id, "sqlBridgeUrl", e.target.value)}
                        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                        placeholder="https://sql-cliente.lctecnologias.com.br"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Token <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={loja.verToken ? "text" : "password"}
                          value={loja.sqlBridgeToken}
                          onChange={(e) => atualizarLoja(loja.id, "sqlBridgeToken", e.target.value)}
                          className="w-full border border-slate-300 rounded-md px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-300"
                          placeholder="Token gerado pelo instalar-bridge.ps1"
                        />
                        <button
                          type="button"
                          onClick={() => atualizarLoja(loja.id, "verToken", !loja.verToken)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                        >
                          {loja.verToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">Armazenado criptografado (AES-256-GCM).</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={adicionarFilial}
            className="w-full flex items-center justify-center gap-2 border border-dashed border-slate-300 rounded-lg py-2.5 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            + Adicionar outra filial
          </button>
        </section>

        {/* ── Seção 3 — Módulos Contratados ───────────────────────────────── */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
          <h2 className="font-semibold text-slate-800">Módulos Contratados</h2>

          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              Core (sempre incluídos — gratuitos)
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
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              Premium (módulos pagos)
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

          <p className="text-xs text-slate-500">
            Plano atual:{" "}
            <strong className={form.empresaPlano === "premium" ? "text-amber-600" : "text-slate-700"}>
              {form.empresaPlano === "premium" ? "★ Premium" : "Free"}
            </strong>
          </p>
        </section>

        {/* ── Seção 4 — Acesso do Gestor ──────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-800">Acesso do Gestor</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nome Completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.usuarioNome}
                onChange={(e) => setForm((prev) => ({ ...prev, usuarioNome: e.target.value }))}
                required
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                E-mail <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.usuarioEmail}
                onChange={(e) => setForm((prev) => ({ ...prev, usuarioEmail: e.target.value }))}
                required
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Senha provisória <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={verSenha ? "text" : "password"}
                  value={form.usuarioSenha}
                  onChange={(e) => setForm((prev) => ({ ...prev, usuarioSenha: e.target.value }))}
                  required
                  minLength={8}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setVerSenha((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.usuarioSenha.length > 0 && form.usuarioSenha.length < 8 && (
                <p className="text-xs text-red-500 mt-1">Mínimo de 8 caracteres</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Papel</label>
              <select
                value={form.usuarioPapel}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, usuarioPapel: e.target.value as "owner" | "admin" | "viewer" }))
                }
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="owner">Proprietário (acesso total)</option>
                <option value="admin">Administrador (pode editar)</option>
                <option value="viewer">Visualizador (só leitura)</option>
              </select>
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl py-3 font-medium hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Cadastrando..." : `Cadastrar Empresa (${lojas.length} ${lojas.length === 1 ? "loja" : "lojas"})`}
        </button>
      </form>
    </div>
  );
}
