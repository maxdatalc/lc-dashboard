"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Eye, EyeOff, ArrowLeft, Loader2, CheckCircle2, AlertCircle,
  Plus, X, Database, CheckCircle, RefreshCw,
  LayoutDashboard, Landmark, Package, ShoppingCart, Users,
  MessageCircle, Bell, Sparkles, Building2, UserCheck,
  TrendingUp, Zap, BarChart3, Copy, Check, Wifi,
} from "lucide-react";
import { FEATURES_CATALOG } from "@/lib/features";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminBadge } from "@/components/admin/AdminBadge";

const ICONE_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, Landmark, Package, ShoppingCart, Users,
  MessageCircle, Bell, Sparkles, Building2, UserCheck,
  TrendingUp, Zap, BarChart3,
};

const INPUT = "adm-field adm-focusable w-full px-3.5 py-2.5 text-sm";
const LABEL = "mb-1.5 block text-xs font-semibold";
const SELECT = "adm-field adm-focusable px-3.5 py-2.5 text-sm";

function SectionNumber({ done, num }: { done: boolean; num: number }) {
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
      style={{
        background: done ? "var(--adm-signal)" : "var(--adm-text)",
        color: done ? "#04120a" : "var(--adm-bg)",
      }}
    >
      {done ? <Check className="h-3 w-3" /> : num}
    </span>
  );
}

function ErrorBanner({ text, small }: { text: string; small?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg ${small ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"}`}
      style={{ background: "var(--adm-alert-soft)", border: "1px solid var(--adm-alert)", color: "var(--adm-alert)" }}
    >
      <AlertCircle className={small ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0"} />
      {text}
    </div>
  );
}

type TunnelStatus = "idle" | "loading" | "created" | "error";
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

  // Tunnel Cloudflare
  const [tunnelNome, setTunnelNome] = useState("");
  const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus>("idle");
  const [tunnelError, setTunnelError] = useState<string | null>(null);
  const [tunnelId, setTunnelId] = useState<string | null>(null);
  const [tunnelToken, setTunnelToken] = useState<string | null>(null);
  const [tunnelBridgeUrl, setTunnelBridgeUrl] = useState<string | null>(null);
  const [installCommand, setInstallCommand] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

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

  const tunnelCriado = tunnelStatus === "created";
  const bridgeConectada = bridgeStatus === "connected" && !editandoBridge;
  const lojasCount = lojas.filter((l) => l.selecionada).length;

  // ── Tunnel ──────────────────────────────────────────────────────────────

  async function handleCriarTunnel() {
    if (!tunnelNome.trim()) {
      setTunnelError("Informe o nome do tunnel.");
      return;
    }
    setTunnelStatus("loading");
    setTunnelError(null);
    try {
      const res = await fetch("/api/admin/criar-tunnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: tunnelNome.trim() }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        tunnelId?: string;
        tunnelToken?: string;
        bridgeUrl?: string;
        installCommand?: string;
      };
      if (!res.ok || !data.success) {
        setTunnelStatus("error");
        setTunnelError(data.error ?? "Erro ao criar tunnel.");
        return;
      }
      setTunnelId(data.tunnelId!);
      setTunnelToken(data.tunnelToken!);
      setTunnelBridgeUrl(data.bridgeUrl!);
      setInstallCommand(data.installCommand!);
      setBridgeUrl(data.bridgeUrl!);
      setTunnelStatus("created");
    } catch {
      setTunnelStatus("error");
      setTunnelError("Erro de rede ao criar tunnel.");
    }
  }

  function handleCopiarComando() {
    if (!installCommand) return;
    navigator.clipboard.writeText(installCommand);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  // ── Bridge ──────────────────────────────────────────────────────────────

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

  // ── Form ────────────────────────────────────────────────────────────────

  function handleEmpresaNome(valor: string) {
    const slug = valor.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
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

    if (!tunnelCriado) {
      setErroGeral("Crie o tunnel Cloudflare antes de continuar.");
      return;
    }
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

    setLoading(true);
    try {
      const res = await fetch("/api/admin/criar-cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant: { name: form.empresaNome, slug: form.empresaSlug, plan: form.empresaPlano },
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
            ? { email: form.usuarioEmail, senha: form.usuarioSenha, nomeCompleto: form.usuarioNome, papel: form.usuarioPapel }
            : null,
          tunnelId,
          tunnelToken,
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
    } catch {
      setErroGeral("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const coreFeatures = FEATURES_CATALOG.filter((f) => f.categoria === "core");
  const premiumFeatures = FEATURES_CATALOG.filter((f) => f.categoria === "premium");

  // ── Tela de sucesso ──────────────────────────────────────────────────────

  if (sucesso) {
    return (
      <div className="adm-rise mx-auto flex min-h-96 max-w-xl flex-col items-center justify-center gap-4 p-6">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: "var(--adm-signal-soft)", border: "1px solid var(--adm-signal)" }}
        >
          <CheckCircle2 className="h-9 w-9" style={{ color: "var(--adm-signal)" }} />
        </div>
        <div className="text-center">
          <p className="text-xl font-bold" style={{ color: "var(--adm-text)" }}>Empresa cadastrada!</p>
          {clientesVinculados > 0 ? (
            <p className="mt-1 text-sm font-medium" style={{ color: "var(--adm-signal)" }}>
              {clientesVinculados} {clientesVinculados === 1 ? "empresa vinculada" : "empresas vinculadas"} automaticamente na base de clientes.
            </p>
          ) : (
            <p className="mt-1 text-sm" style={{ color: "var(--adm-text-faint)" }}>Nenhum cliente encontrado na base para vincular.</p>
          )}
        </div>
        <Link
          href="/admin/empresas"
          className="adm-focusable rounded text-sm font-medium transition-colors"
          style={{ color: "var(--adm-text-dim)" }}
        >
          Voltar para a lista de empresas →
        </Link>
      </div>
    );
  }

  // ── Formulário ───────────────────────────────────────────────────────────

  return (
    <div className="adm-rise mx-auto max-w-3xl space-y-6 p-6">

      <div className="space-y-2">
        <Link
          href="/admin/empresas"
          className="adm-focusable inline-flex items-center gap-1.5 rounded text-xs font-medium transition-colors"
          style={{ color: "var(--adm-text-faint)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Todas as empresas
        </Link>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--adm-text)" }}>Nova Empresa</h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--adm-text-dim)" }}>
            Crie o tunnel Cloudflare, conecte ao banco e configure a empresa.
          </p>
        </div>
      </div>

      {erroGeral && <ErrorBanner text={erroGeral} />}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Seção 1 — Tunnel Cloudflare ──────────────────────────────────── */}
        <AdminCard className="space-y-4 p-5">
          <div>
            <div className="flex items-center gap-2">
              <SectionNumber done={tunnelCriado} num={1} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>Tunnel Cloudflare</h2>
              {tunnelCriado && (
                <AdminBadge variant="success">
                  <Wifi className="h-3 w-3" />
                  Tunnel criado
                </AdminBadge>
              )}
            </div>
            <p className="mt-0.5 pl-7 text-xs" style={{ color: "var(--adm-text-faint)" }}>
              Gera o tunnel e o DNS automaticamente. O técnico roda um comando no PC do cliente.
            </p>
          </div>

          {!tunnelCriado ? (
            <div className="space-y-3">
              {tunnelError && <ErrorBanner text={tunnelError} small />}
              <div>
                <label className={LABEL} style={{ color: "var(--adm-text-dim)" }}>Nome do Tunnel</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tunnelNome}
                    onChange={(e) => setTunnelNome(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCriarTunnel())}
                    className={INPUT + " adm-mono"}
                    placeholder="supermercado-modelo"
                    disabled={tunnelStatus === "loading"}
                  />
                  <AdminButton
                    type="button"
                    onClick={handleCriarTunnel}
                    disabled={tunnelStatus === "loading" || !tunnelNome}
                    className="whitespace-nowrap"
                  >
                    {tunnelStatus === "loading"
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Wifi className="h-4 w-4" />}
                    {tunnelStatus === "loading" ? "Criando..." : "Criar Tunnel"}
                  </AdminButton>
                </div>
                {tunnelNome && (
                  <p className="mt-1.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>
                    URL da bridge: <span className="adm-mono" style={{ color: "var(--adm-text-dim)" }}>{tunnelNome}sql.lcgestor.com.br</span>
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Info do tunnel criado */}
              <div
                className="flex items-center gap-3 rounded-xl p-3"
                style={{ background: "var(--adm-signal-soft)", border: "1px solid var(--adm-signal)" }}
              >
                <CheckCircle className="h-4 w-4 shrink-0" style={{ color: "var(--adm-signal)" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold" style={{ color: "var(--adm-signal)" }}>Tunnel: {tunnelNome}</p>
                  <p className="adm-mono text-xs" style={{ color: "var(--adm-signal)" }}>{tunnelBridgeUrl}</p>
                </div>
              </div>

              {/* Comando de instalação — terminal, propositalmente escuro em ambos os temas */}
              <div className="space-y-3 rounded-xl border border-white/10 bg-[#0a0e17] p-4">
                <p className="text-xs font-semibold text-slate-300">Comando para o técnico</p>
                <p className="text-xs text-slate-400">
                  Rode como <strong className="text-slate-300">Administrador</strong> no CMD do PC do cliente:
                </p>
                <div className="break-all rounded-lg bg-black/40 p-3 font-mono text-xs leading-relaxed text-emerald-400">
                  {installCommand}
                </div>
                <button
                  type="button"
                  onClick={handleCopiarComando}
                  className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {copiado ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiado ? "Copiado!" : "Copiar comando"}
                </button>
              </div>
            </div>
          )}
        </AdminCard>

        {/* ── Seção 2 — Bridge SQL ─────────────────────────────────────────── */}
        <AdminCard className="space-y-4 p-5" style={{ opacity: tunnelCriado ? 1 : 0.4, pointerEvents: tunnelCriado ? "auto" : "none" }}>
          <div>
            <div className="flex items-center gap-2">
              <SectionNumber done={bridgeConectada} num={2} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>Lojas do Cliente</h2>
              {bridgeConectada && (
                <AdminBadge variant="success">
                  <CheckCircle className="h-3 w-3" />
                  Bridge conectada
                </AdminBadge>
              )}
            </div>
            <p className="mt-0.5 pl-7 text-xs" style={{ color: "var(--adm-text-faint)" }}>
              Informe o token da bridge instalada no cliente para importar as lojas.
            </p>
          </div>

          {!bridgeConectada ? (
            <div className="space-y-3 rounded-xl p-4" style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-line)" }}>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" style={{ color: "var(--adm-text-dim)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--adm-text)" }}>Conectar via Bridge SQL</p>
              </div>

              {bridgeError && <ErrorBanner text={bridgeError} small />}

              <div>
                <label className={LABEL} style={{ color: "var(--adm-text-dim)" }}>URL da Bridge</label>
                <input
                  type="url"
                  value={bridgeUrl}
                  onChange={(e) => setBridgeUrl(e.target.value)}
                  className={INPUT + " adm-mono"}
                  placeholder="https://...sql.lcgestor.com.br"
                />
              </div>

              <div>
                <label className={LABEL} style={{ color: "var(--adm-text-dim)" }}>Token da Bridge</label>
                <div className="relative">
                  <input
                    type={verToken ? "text" : "password"}
                    value={bridgeToken}
                    onChange={(e) => setBridgeToken(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleConectarBridge())}
                    className={INPUT + " adm-mono pr-10"}
                    placeholder="Token configurado no Bridge SQL"
                  />
                  <button
                    type="button"
                    onClick={() => setVerToken((v) => !v)}
                    className="adm-focusable absolute right-3 top-1/2 -translate-y-1/2 rounded"
                    style={{ color: "var(--adm-text-faint)" }}
                  >
                    {verToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <AdminButton
                type="button"
                onClick={handleConectarBridge}
                disabled={bridgeStatus === "loading" || !bridgeUrl || !bridgeToken}
              >
                {bridgeStatus === "loading"
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Database className="h-4 w-4" />}
                {bridgeStatus === "loading" ? "Conectando..." : "Conectar e Buscar Lojas"}
              </AdminButton>
            </div>
          ) : (
            <div
              className="flex items-center gap-3 rounded-xl p-3"
              style={{ background: "var(--adm-signal-soft)", border: "1px solid var(--adm-signal)" }}
            >
              <CheckCircle className="h-4 w-4 shrink-0" style={{ color: "var(--adm-signal)" }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium" style={{ color: "var(--adm-signal)" }}>{bridgeUrl}</p>
                <p className="text-xs" style={{ color: "var(--adm-signal)" }}>
                  {lojasCount} {lojasCount === 1 ? "loja selecionada" : "lojas selecionadas"} de{" "}
                  {lojas.filter((l) => l.fromBridge).length} encontradas
                </p>
              </div>
              <button
                type="button"
                onClick={handleReconectar}
                className="adm-focusable flex shrink-0 items-center gap-1 rounded text-xs font-medium transition-colors"
                style={{ color: "var(--adm-signal)" }}
              >
                <RefreshCw className="h-3 w-3" />
                Reconectar
              </button>
            </div>
          )}

          {lojas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium" style={{ color: "var(--adm-text-faint)" }}>
                {bridgeConectada ? "Lojas encontradas — selecione as que deseja cadastrar:" : "Lojas adicionadas:"}
              </p>
              {lojas.map((loja, idx) => (
                <div
                  key={loja.id}
                  className="space-y-3 rounded-xl p-3.5 transition-colors"
                  style={{
                    border: "1px solid var(--adm-line-strong)",
                    background: loja.selecionada ? "var(--adm-surface)" : "var(--adm-surface-2)",
                    opacity: loja.selecionada ? 1 : 0.6,
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    {loja.fromBridge ? (
                      <input
                        type="checkbox"
                        checked={loja.selecionada}
                        onChange={(e) => atualizarLoja(loja.id, "selecionada", e.target.checked)}
                        className="adm-focusable shrink-0 rounded"
                        style={{ accentColor: "var(--adm-accent)" }}
                      />
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <span className="shrink-0">
                      <AdminBadge variant="neutral">
                        {loja.fromBridge ? `EmpId ${loja.empId}` : `Loja manual ${idx + 1}`}
                      </AdminBadge>
                    </span>
                    {loja.fromBridge && (
                      <span className="shrink-0">
                        <AdminBadge variant="success">bridge</AdminBadge>
                      </span>
                    )}
                    <span className="flex-1" />
                    {!loja.fromBridge && (
                      <button
                        type="button"
                        onClick={() => setLojas((prev) => prev.filter((l) => l.id !== loja.id))}
                        className="adm-focusable flex shrink-0 items-center gap-1 rounded text-xs transition-colors"
                        style={{ color: "var(--adm-alert)" }}
                      >
                        <X className="h-3.5 w-3.5" />
                        Remover
                      </button>
                    )}
                  </div>

                  {loja.selecionada && (
                    <div className="grid grid-cols-1 gap-3 pl-6 sm:grid-cols-2">
                      <div>
                        <label className={LABEL} style={{ color: "var(--adm-text-dim)" }}>
                          Nome <span style={{ color: "var(--adm-alert)" }}>*</span>
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
                        <label className={LABEL} style={{ color: "var(--adm-text-dim)" }}>CNPJ</label>
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
                          <label className={LABEL} style={{ color: "var(--adm-text-dim)" }}>
                            EmpId <span style={{ color: "var(--adm-alert)" }}>*</span>
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={loja.empId}
                            onChange={(e) => atualizarLoja(loja.id, "empId", e.target.value)}
                            className={INPUT}
                            placeholder="ID no MaxManager"
                          />
                          <p className="mt-1 text-xs" style={{ color: "var(--adm-text-faint)" }}>cofId da tabela config</p>
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
            className="adm-focusable flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-sm transition-all"
            style={{ borderColor: "var(--adm-line-strong)", color: "var(--adm-text-faint)" }}
          >
            <Plus className="h-4 w-4" />
            Adicionar loja manualmente
          </button>
        </AdminCard>

        {/* ── Seção 3 — Dados da Empresa ──────────────────────────────────── */}
        <AdminCard className="space-y-4 p-5" style={{ opacity: tunnelCriado ? 1 : 0.4, pointerEvents: tunnelCriado ? "auto" : "none" }}>
          <div>
            <div className="flex items-center gap-2">
              <SectionNumber done={false} num={3} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>Dados da Empresa</h2>
            </div>
            <p className="mt-0.5 pl-7 text-xs" style={{ color: "var(--adm-text-faint)" }}>Nome de exibição e identificador único</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL} style={{ color: "var(--adm-text-dim)" }}>
                Nome da Empresa <span style={{ color: "var(--adm-alert)" }}>*</span>
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
              <label className={LABEL} style={{ color: "var(--adm-text-dim)" }}>Slug</label>
              <input
                type="text"
                value={form.empresaSlug}
                onChange={(e) => setForm((prev) => ({ ...prev, empresaSlug: e.target.value }))}
                required
                className={INPUT + " adm-mono"}
                placeholder="supermercado-modelo"
              />
            </div>
          </div>

          <div>
            <label className={LABEL} style={{ color: "var(--adm-text-dim)" }}>Plano inicial</label>
            <select
              value={form.empresaPlano}
              onChange={(e) => setForm((prev) => ({ ...prev, empresaPlano: e.target.value as "free" | "premium" }))}
              className={SELECT}
            >
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
            <p className="mt-1.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>Ajustado automaticamente ao ativar módulos premium.</p>
          </div>
        </AdminCard>

        {/* ── Seção 4 — Módulos ───────────────────────────────────────────── */}
        <AdminCard className="space-y-5 p-5" style={{ opacity: tunnelCriado ? 1 : 0.4, pointerEvents: tunnelCriado ? "auto" : "none" }}>
          <div>
            <div className="flex items-center gap-2">
              <SectionNumber done={false} num={4} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>Módulos Contratados</h2>
            </div>
            <p className="mt-0.5 pl-7 text-xs" style={{ color: "var(--adm-text-faint)" }}>Ative os módulos premium incluídos no contrato</p>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--adm-text-faint)" }}>Core — sempre incluídos</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {coreFeatures.map((f) => {
                const Icone = ICONE_MAP[f.icone] ?? Package;
                return (
                  <div
                    key={f.key}
                    className="flex items-start gap-3 rounded-lg p-3"
                    style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-line)" }}
                  >
                    <Icone className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--adm-text-faint)" }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium" style={{ color: "var(--adm-text)" }}>{f.label}</p>
                      <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>{f.descricao}</p>
                    </div>
                    <div className="mt-0.5 h-4 w-8 shrink-0 rounded-full" style={{ background: "var(--adm-line-strong)", cursor: "not-allowed" }} />
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--adm-text-faint)" }}>Premium — módulos pagos</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {premiumFeatures.map((f) => {
                const Icone = ICONE_MAP[f.icone] ?? Zap;
                const ativo = form.featuresAtivas.includes(f.key);
                return (
                  <div
                    key={f.key}
                    className="flex items-start gap-3 rounded-lg p-3 transition-colors"
                    style={{
                      background: ativo ? "var(--adm-accent-soft)" : "var(--adm-surface)",
                      border: `1px solid ${ativo ? "var(--adm-accent)" : "var(--adm-line-strong)"}`,
                      opacity: f.disponivel ? 1 : 0.6,
                    }}
                  >
                    <Icone className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ativo ? "var(--adm-accent)" : "var(--adm-text-faint)" }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium" style={{ color: "var(--adm-text)" }}>{f.label}</p>
                        {!f.disponivel && <AdminBadge variant="neutral">Em breve</AdminBadge>}
                      </div>
                      <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>{f.descricao}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!f.disponivel}
                      onClick={() => toggleFeature(f.key)}
                      className="adm-focusable relative mt-0.5 h-4 w-8 shrink-0 rounded-full transition-colors"
                      style={{
                        background: !f.disponivel ? "var(--adm-line-strong)" : ativo ? "var(--adm-accent)" : "var(--adm-line-strong)",
                        cursor: f.disponivel ? "pointer" : "not-allowed",
                      }}
                    >
                      <span
                        className="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform"
                        style={{ transform: ativo ? "translateX(1rem)" : "translateX(0.125rem)" }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="pt-3 text-xs" style={{ color: "var(--adm-text-dim)", borderTop: "1px solid var(--adm-line)" }}>
            Plano atual:{" "}
            <strong style={{ color: form.empresaPlano === "premium" ? "var(--adm-warn)" : "var(--adm-text)" }}>
              {form.empresaPlano === "premium" ? "★ Premium" : "Free"}
            </strong>
          </p>
        </AdminCard>

        {/* ── Seção 5 — Acesso do Gestor ──────────────────────────────────── */}
        <AdminCard className="space-y-4 p-5" style={{ opacity: tunnelCriado ? 1 : 0.4, pointerEvents: tunnelCriado ? "auto" : "none" }}>
          <div>
            <div className="flex items-center gap-2">
              <SectionNumber done={false} num={5} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>Acesso do Gestor</h2>
              <AdminBadge variant="neutral">Opcional</AdminBadge>
            </div>
            <p className="mt-0.5 pl-7 text-xs" style={{ color: "var(--adm-text-faint)" }}>
              Deixe em branco para cadastrar usuários depois pela aba Usuários.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL} style={{ color: "var(--adm-text-dim)" }}>Nome Completo</label>
              <input
                type="text"
                value={form.usuarioNome}
                onChange={(e) => setForm((prev) => ({ ...prev, usuarioNome: e.target.value }))}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL} style={{ color: "var(--adm-text-dim)" }}>E-mail</label>
              <input
                type="email"
                value={form.usuarioEmail}
                onChange={(e) => setForm((prev) => ({ ...prev, usuarioEmail: e.target.value }))}
                className={INPUT}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL} style={{ color: "var(--adm-text-dim)" }}>Senha provisória</label>
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
                  className="adm-focusable absolute right-3 top-1/2 -translate-y-1/2 rounded"
                  style={{ color: "var(--adm-text-faint)" }}
                >
                  {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.usuarioSenha.length > 0 && form.usuarioSenha.length < 8 && (
                <p className="mt-1 text-xs" style={{ color: "var(--adm-alert)" }}>Mínimo de 8 caracteres</p>
              )}
            </div>
            <div>
              <label className={LABEL} style={{ color: "var(--adm-text-dim)" }}>Papel</label>
              <select
                value={form.usuarioPapel}
                onChange={(e) => setForm((prev) => ({ ...prev, usuarioPapel: e.target.value as "owner" | "admin" | "viewer" }))}
                className={SELECT + " w-full"}
              >
                <option value="owner">Proprietário (acesso total)</option>
                <option value="admin">Administrador (pode editar)</option>
                <option value="viewer">Visualizador (só leitura)</option>
              </select>
            </div>
          </div>
        </AdminCard>

        {/* Botão submit */}
        <AdminButton
          type="submit"
          disabled={loading || !tunnelCriado}
          className="w-full justify-center py-3"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {!tunnelCriado
            ? "Crie o tunnel antes de continuar"
            : loading
              ? "Cadastrando..."
              : `Cadastrar empresa (${lojasCount} ${lojasCount === 1 ? "loja" : "lojas"})`}
        </AdminButton>
      </form>
    </div>
  );
}
