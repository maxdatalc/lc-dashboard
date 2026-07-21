"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Shield,
  Eye,
  KeyRound,
  UserPlus,
  Trash2,
  ChevronDown,
  Calendar,
  Clock,
  Mail,
  Crown,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  resetarSenhaUsuario,
  vincularEmpresaUsuario,
  desvincularEmpresaUsuario,
  alterarRoleUsuario,
  excluirUsuario,
} from "@/app/actions/admin-usuarios";
import { salvarAcessoUsuario } from "@/lib/actions/admin-lojas";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type UserRole = "owner" | "admin" | "viewer";

interface LojaSimples {
  id: string;
  name: string;
}

interface EmpresaVinculada {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  tenant_plan: string;
  tenant_ativo: boolean;
  tenant_features: string[];
  lojas: LojaSimples[];
  settings: {
    modulos: Record<string, boolean>;
    lojaIds: string[];
  };
  role: UserRole;
}

interface EmpresaOption {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

interface Usuario {
  id: string;
  email: string;
  full_name: string;
  is_system_admin: boolean;
  last_sign_in: string | null;
  created_at: string;
  phone: string | null;
}

interface Props {
  usuario: Usuario;
  empresasVinculadas: EmpresaVinculada[];
  todasEmpresas: EmpresaOption[];
}

function formatarData(iso: string | null): string {
  if (!iso) return "Nunca";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const ROLE_CONFIG: Record<UserRole, { label: string; variant: "warning" | "accent" | "neutral"; icon: React.ElementType }> = {
  owner: { label: "Proprietário", variant: "warning", icon: Crown },
  admin: { label: "Admin",        variant: "accent",  icon: Shield },
  viewer:{ label: "Viewer",       variant: "neutral", icon: Eye   },
};

function RoleBadge({ role, onClick }: { role: UserRole; onClick?: () => void }) {
  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className="adm-focusable rounded-full"
      style={{ cursor: onClick ? "pointer" : "default" }}
      title={onClick ? "Clique para alternar permissão" : undefined}
    >
      <AdminBadge variant={cfg.variant}>
        <Icon className="h-3 w-3" />
        {cfg.label}
      </AdminBadge>
    </button>
  );
}

function ModalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)" }}
      >
        {children}
      </div>
    </div>
  );
}

export function UsuarioDetalheClient({
  usuario,
  empresasVinculadas: initialEmpresas,
  todasEmpresas,
}: Props) {
  const router = useRouter();
  const [empresas, setEmpresas] = useState(initialEmpresas);
  const [modalSenha, setModalSenha] = useState(false);
  const [modalVincular, setModalVincular] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [empresaVincular, setEmpresaVincular] = useState("");
  const [roleVincular, setRoleVincular] = useState<UserRole>("viewer");
  const [feedback, setFeedback] = useState<{
    tipo: "ok" | "erro";
    msg: string;
  } | null>(null);
  const [modalExcluir, setModalExcluir] = useState(false);
  const [confirmacaoNome, setConfirmacaoNome] = useState("");
  const [isPending, startTransition] = useTransition();
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);

  const empresasDisponiveis = todasEmpresas.filter(
    (e) => !empresas.some((ev) => ev.tenant_id === e.id)
  );

  function mostrarFeedback(tipo: "ok" | "erro", msg: string) {
    setFeedback({ tipo, msg });
    setTimeout(() => setFeedback(null), 3500);
  }

  function handleResetarSenha() {
    if (!novaSenha || novaSenha.length < 6) return;
    startTransition(async () => {
      const result = await resetarSenhaUsuario(usuario.id, novaSenha);
      if (result.error) {
        mostrarFeedback("erro", result.error);
      } else {
        mostrarFeedback("ok", "Senha alterada com sucesso");
        setModalSenha(false);
        setNovaSenha("");
      }
    });
  }

  function handleVincular() {
    if (!empresaVincular) return;
    startTransition(async () => {
      const result = await vincularEmpresaUsuario(
        usuario.id,
        empresaVincular,
        roleVincular
      );
      if (result.error) {
        mostrarFeedback("erro", result.error);
      } else {
        const empresa = todasEmpresas.find((e) => e.id === empresaVincular);
        if (empresa) {
          setEmpresas((prev) => [
            ...prev,
            {
              tenant_id: empresa.id,
              tenant_name: empresa.name,
              tenant_slug: empresa.slug,
              tenant_plan: empresa.plan,
              tenant_ativo: true,
              tenant_features: [],
              lojas: [],
              settings: { modulos: {}, lojaIds: [] },
              role: roleVincular,
            },
          ]);
        }
        mostrarFeedback("ok", "Empresa vinculada com sucesso");
        setModalVincular(false);
        setEmpresaVincular("");
        setRoleVincular("viewer" as UserRole);
      }
    });
  }

  function handleDesvincular(tenantId: string, tenantName: string) {
    if (
      !confirm(
        `Remover acesso de ${usuario.full_name || usuario.email} à empresa ${tenantName}?`
      )
    )
      return;
    startTransition(async () => {
      const result = await desvincularEmpresaUsuario(usuario.id, tenantId);
      if (result.error) {
        mostrarFeedback("erro", result.error);
      } else {
        setEmpresas((prev) => prev.filter((e) => e.tenant_id !== tenantId));
        mostrarFeedback("ok", "Acesso removido");
      }
    });
  }

  function handleAlterarRole(tenantId: string, roleAtual: UserRole) {
    // Ciclo: owner → admin → viewer → owner
    const ciclo: UserRole[] = ["owner", "admin", "viewer"];
    const novaRole = ciclo[(ciclo.indexOf(roleAtual) + 1) % ciclo.length];
    startTransition(async () => {
      const result = await alterarRoleUsuario(usuario.id, tenantId, novaRole);
      if (result.error) {
        mostrarFeedback("erro", result.error);
      } else {
        setEmpresas((prev) =>
          prev.map((e) =>
            e.tenant_id === tenantId ? { ...e, role: novaRole } : e
          )
        );
        mostrarFeedback("ok", `Permissão alterada para ${novaRole}`);
      }
    });
  }

  function handleExcluir() {
    startTransition(async () => {
      const result = await excluirUsuario(usuario.id);
      if (result.error) {
        mostrarFeedback("erro", result.error);
        setModalExcluir(false);
        setConfirmacaoNome("");
      } else {
        router.push("/admin/usuarios");
      }
    });
  }

  const iniciais = (usuario.full_name || usuario.email)
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-5 p-6">
      {/* Toast de feedback */}
      {feedback && (
        <div
          className="fixed right-6 top-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
          style={{
            background: feedback.tipo === "ok" ? "var(--adm-signal-soft)" : "var(--adm-alert-soft)",
            border: `1px solid ${feedback.tipo === "ok" ? "var(--adm-signal)" : "var(--adm-alert)"}`,
            color: feedback.tipo === "ok" ? "var(--adm-signal)" : "var(--adm-alert)",
          }}
        >
          {feedback.tipo === "ok" ? <Check className="h-4 w-4" /> : "✕"}{" "}
          {feedback.msg}
        </div>
      )}

      {/* Breadcrumb */}
      <Link
        href="/admin/usuarios"
        className="adm-focusable inline-flex items-center gap-1.5 rounded text-xs font-medium transition-colors"
        style={{ color: "var(--adm-text-faint)" }}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Todos os usuários
      </Link>

      {/* Header */}
      <div className="adm-rise flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "var(--adm-accent-soft)" }}
          >
            <span className="text-lg font-bold" style={{ color: "var(--adm-accent)" }}>{iniciais}</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold" style={{ color: "var(--adm-text)" }}>
                {usuario.full_name || "Sem nome"}
              </h1>
              {usuario.is_system_admin && (
                <AdminBadge variant="warning">
                  <Crown className="h-3 w-3" />
                  System Admin
                </AdminBadge>
              )}
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm" style={{ color: "var(--adm-text-dim)" }}>
              <Mail className="h-3.5 w-3.5" />
              {usuario.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AdminButton variant="secondary" onClick={() => setModalSenha(true)}>
            <KeyRound className="h-4 w-4" />
            Resetar senha
          </AdminButton>
          {!usuario.is_system_admin && (
            <AdminButton variant="danger" onClick={() => setModalExcluir(true)}>
              <Trash2 className="h-4 w-4" />
              Excluir usuário
            </AdminButton>
          )}
        </div>
      </div>

      {/* Cards de info */}
      <div className="adm-rise grid grid-cols-2 gap-4" style={{ animationDelay: "50ms" }}>
        <AdminCard className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--adm-surface-2)" }}>
            <Clock className="h-4 w-4" style={{ color: "var(--adm-text-faint)" }} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--adm-text-faint)" }}>
              Último acesso
            </p>
            <p className="mt-0.5 text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
              {formatarData(usuario.last_sign_in)}
            </p>
          </div>
        </AdminCard>
        <AdminCard className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--adm-surface-2)" }}>
            <Calendar className="h-4 w-4" style={{ color: "var(--adm-text-faint)" }} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--adm-text-faint)" }}>
              Cadastrado em
            </p>
            <p className="mt-0.5 text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
              {formatarData(usuario.created_at)}
            </p>
          </div>
        </AdminCard>
      </div>

      {/* Seção empresas */}
      <AdminCard className="adm-rise overflow-hidden p-0" style={{ animationDelay: "80ms" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--adm-line)" }}>
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
              <Building2 className="h-4 w-4" style={{ color: "var(--adm-text-faint)" }} />
              Empresas vinculadas
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>
              {empresas.length === 0
                ? "Nenhuma empresa vinculada"
                : `${empresas.length} ${empresas.length === 1 ? "empresa" : "empresas"}`}
            </p>
          </div>
          {empresasDisponiveis.length > 0 && (
            <AdminButton size="sm" onClick={() => setModalVincular(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              Vincular empresa
            </AdminButton>
          )}
        </div>

        {empresas.length === 0 ? (
          <AdminEmptyState
            icon={Building2}
            title="Este usuário não tem acesso a nenhuma empresa"
            action={
              empresasDisponiveis.length > 0 ? (
                <AdminButton variant="secondary" size="sm" onClick={() => setModalVincular(true)}>
                  <UserPlus className="h-3.5 w-3.5" />
                  Vincular empresa
                </AdminButton>
              ) : undefined
            }
          />
        ) : (
          <div>
            {empresas.map((empresa, i) => (
              <div key={empresa.tenant_id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--adm-line)" }}>
                <div
                  className="adm-row group flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors"
                  onClick={() =>
                    setExpandedTenantId(
                      expandedTenantId === empresa.tenant_id ? null : empresa.tenant_id
                    )
                  }
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "var(--adm-accent)" }}
                  >
                    <span className="text-sm font-bold uppercase" style={{ color: "#04121a" }}>
                      {empresa.tenant_name.charAt(0)}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
                        {empresa.tenant_name}
                      </p>
                      <AdminBadge variant={empresa.tenant_ativo ? "success" : "neutral"}>
                        {empresa.tenant_ativo ? "Ativa" : "Inativa"}
                      </AdminBadge>
                      <span className="capitalize">
                        <AdminBadge variant="neutral">{empresa.tenant_plan}</AdminBadge>
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>
                      {empresa.tenant_slug}
                    </p>
                  </div>

                  <RoleBadge
                    role={empresa.role}
                    onClick={() => handleAlterarRole(empresa.tenant_id, empresa.role)}
                  />

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDesvincular(empresa.tenant_id, empresa.tenant_name);
                    }}
                    disabled={isPending}
                    className="adm-focusable rounded-lg p-1.5 opacity-0 transition-all group-hover:opacity-100"
                    style={{ color: "var(--adm-text-faint)" }}
                    title="Remover acesso"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <ChevronDown
                    className="h-4 w-4 shrink-0 transition-transform duration-200"
                    style={{
                      color: "var(--adm-text-faint)",
                      transform: expandedTenantId === empresa.tenant_id ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                </div>

                {expandedTenantId === empresa.tenant_id && (
                  <EmpresaAcessoPanel
                    tenantId={empresa.tenant_id}
                    userId={usuario.id}
                    features={empresa.tenant_features}
                    lojas={empresa.lojas}
                    settings={empresa.settings}
                    onSaved={() => {
                      mostrarFeedback("ok", "Acesso salvo para essa empresa");
                      setExpandedTenantId(null);
                      router.refresh();
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      {/* Modal — Resetar senha */}
      {modalSenha && (
        <ModalShell>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--adm-accent-soft)" }}>
              <KeyRound className="h-5 w-5" style={{ color: "var(--adm-accent)" }} />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: "var(--adm-text)" }}>Resetar senha</h3>
              <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>{usuario.email}</p>
            </div>
          </div>

          <div className="mb-5 space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--adm-text-faint)" }}>
              Nova senha
            </label>
            <div className="relative">
              <input
                type={senhaVisivel ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                autoFocus
                className="adm-field adm-focusable w-full py-2.5 pl-3.5 pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setSenhaVisivel((v) => !v)}
                className="adm-focusable absolute right-3 top-1/2 -translate-y-1/2 rounded"
                style={{ color: "var(--adm-text-faint)" }}
              >
                <Eye className="h-4 w-4" />
              </button>
            </div>
            {novaSenha.length > 0 && novaSenha.length < 6 && (
              <p className="text-xs" style={{ color: "var(--adm-alert)" }}>
                Mínimo 6 caracteres ({novaSenha.length}/6)
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <AdminButton
              variant="secondary"
              className="flex-1 justify-center"
              onClick={() => { setModalSenha(false); setNovaSenha(""); }}
            >
              Cancelar
            </AdminButton>
            <AdminButton
              className="flex-1 justify-center"
              onClick={handleResetarSenha}
              disabled={isPending || novaSenha.length < 6}
            >
              {isPending ? "Salvando..." : "Confirmar"}
            </AdminButton>
          </div>
        </ModalShell>
      )}

      {/* Modal — Vincular empresa */}
      {modalVincular && (
        <ModalShell>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--adm-accent-soft)" }}>
              <Building2 className="h-5 w-5" style={{ color: "var(--adm-accent)" }} />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: "var(--adm-text)" }}>Vincular empresa</h3>
              <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>{usuario.email}</p>
            </div>
          </div>

          <div className="mb-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--adm-text-faint)" }}>
                Empresa
              </label>
              <select
                value={empresaVincular}
                onChange={(e) => setEmpresaVincular(e.target.value)}
                className="adm-field adm-focusable w-full px-3.5 py-2.5 text-sm"
              >
                <option value="">Selecione uma empresa...</option>
                {empresasDisponiveis.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--adm-text-faint)" }}>
                Permissão
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["owner", "admin", "viewer"] as const).map((r) => {
                  const cfg = ROLE_CONFIG[r];
                  const Icon = cfg.icon;
                  const active = roleVincular === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoleVincular(r)}
                      className="adm-focusable flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-medium transition-all"
                      style={{
                        border: "1px solid",
                        borderColor: active ? "var(--adm-accent)" : "var(--adm-line-strong)",
                        background: active ? "var(--adm-accent-soft)" : "transparent",
                        color: active ? "var(--adm-accent)" : "var(--adm-text-dim)",
                      }}
                    >
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>
                {roleVincular === "owner"
                  ? "Proprietário: acesso total, pode gerenciar usuários"
                  : roleVincular === "admin"
                  ? "Admin: pode editar configurações e ver dados"
                  : "Viewer: somente leitura do dashboard"}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <AdminButton
              variant="secondary"
              className="flex-1 justify-center"
              onClick={() => { setModalVincular(false); setEmpresaVincular(""); setRoleVincular("viewer"); }}
            >
              Cancelar
            </AdminButton>
            <AdminButton
              className="flex-1 justify-center"
              onClick={handleVincular}
              disabled={isPending || !empresaVincular}
            >
              {isPending ? "Vinculando..." : "Vincular"}
            </AdminButton>
          </div>
        </ModalShell>
      )}

      {/* Modal — Excluir usuário */}
      {modalExcluir && (
        <ModalShell>
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--adm-alert-soft)" }}>
              <Trash2 className="h-5 w-5" style={{ color: "var(--adm-alert)" }} />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: "var(--adm-text)" }}>Excluir usuário</h3>
              <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>Esta ação não pode ser desfeita</p>
            </div>
          </div>

          <div className="mb-5 mt-4 rounded-lg px-3.5 py-3" style={{ background: "var(--adm-alert-soft)", border: "1px solid var(--adm-alert)" }}>
            <p className="text-sm" style={{ color: "var(--adm-alert)" }}>
              O usuário{" "}
              <span className="font-semibold">
                {usuario.full_name || usuario.email}
              </span>{" "}
              será removido permanentemente do sistema, incluindo todos os
              acessos às empresas vinculadas.
            </p>
          </div>

          <div className="mb-5 space-y-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
              Digite{" "}
              <span className="font-semibold" style={{ color: "var(--adm-text)" }}>
                {usuario.email}
              </span>{" "}
              para confirmar
            </label>
            <input
              type="text"
              placeholder={usuario.email}
              value={confirmacaoNome}
              onChange={(e) => setConfirmacaoNome(e.target.value)}
              autoFocus
              className="adm-field adm-focusable w-full px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <AdminButton
              variant="secondary"
              className="flex-1 justify-center"
              onClick={() => { setModalExcluir(false); setConfirmacaoNome(""); }}
            >
              Cancelar
            </AdminButton>
            <AdminButton
              variant="danger"
              className="flex-1 justify-center"
              onClick={handleExcluir}
              disabled={isPending || confirmacaoNome !== usuario.email}
            >
              {isPending ? "Excluindo..." : "Excluir permanentemente"}
            </AdminButton>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

// ── Painel de acesso por empresa ──────────────────────────────────────────────

const MODULES_LABEL: Record<string, string> = {
  dashboard_visao_geral: "Visão Geral",
  modulo_vendas:         "Dashboard Vendas",
  modulo_financeiro:     "Financeiro",
  modulo_produtos:       "Produtos",
  modulo_clientes:       "Clientes",
  modulo_os:             "O.S",
  modulo_relatorios:     "Comissão por Recebimento",
};

const MODULE_GROUPS: { label: string; keys: string[] }[] = [
  { label: "Dashboard",  keys: ["dashboard_visao_geral", "modulo_vendas", "modulo_financeiro", "modulo_produtos", "modulo_clientes"] },
  { label: "Módulos",    keys: ["modulo_os"] },
  { label: "Relatórios", keys: ["modulo_relatorios"] },
];

function EmpresaAcessoPanel({
  tenantId,
  userId,
  features,
  lojas,
  settings,
  onSaved,
}: {
  tenantId: string;
  userId: string;
  features: string[];
  lojas: LojaSimples[];
  settings: { modulos: Record<string, boolean>; lojaIds: string[] };
  onSaved: () => void;
}) {
  const configurableModules = features.filter((k) => k in MODULES_LABEL);

  const [modulos, setModulos] = useState<Record<string, boolean>>(
    Object.fromEntries(
      configurableModules.map((k) => [k, settings.modulos[k] ?? false])
    )
  );
  const [lojaIds, setLojaIds] = useState<string[]>(settings.lojaIds);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSave = async () => {
    setLoading(true);
    setErro(null);
    const result = await salvarAcessoUsuario(tenantId, userId, { lojaIds, modulos });
    setLoading(false);
    if (result.error) { setErro(result.error); return; }
    onSaved();
  };

  return (
    <div className="space-y-4 px-5 py-4" style={{ borderTop: "1px solid var(--adm-line)", background: "var(--adm-surface-2)" }}>
      {erro && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--adm-alert-soft)", border: "1px solid var(--adm-alert)", color: "var(--adm-alert)" }}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {erro}
        </div>
      )}

      {/* Módulos agrupados */}
      {configurableModules.length > 0 && (
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-faint)" }}>
            <Shield className="h-3.5 w-3.5" /> Módulos
          </p>
          {MODULE_GROUPS.map((group) => {
            const groupMods = group.keys.filter((k) => configurableModules.includes(k));
            if (groupMods.length === 0) return null;
            return (
              <div key={group.label}>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--adm-text-faint)" }}>
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-3">
                  {groupMods.map((k) => (
                    <label key={k} className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={modulos[k] ?? false}
                        onChange={() => setModulos((prev) => ({ ...prev, [k]: !prev[k] }))}
                        className="adm-focusable rounded"
                        style={{ accentColor: "var(--adm-accent)" }}
                      />
                      <span className="text-sm" style={{ color: "var(--adm-text)" }}>{MODULES_LABEL[k] ?? k}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lojas */}
      {lojas.length > 1 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-faint)" }}>
            <Building2 className="h-3.5 w-3.5" /> Lojas visíveis{" "}
            <span className="font-normal normal-case tracking-normal" style={{ color: "var(--adm-text-faint)" }}>
              (vazio = todas)
            </span>
          </p>
          <div className="flex flex-wrap gap-3">
            {lojas.map((l) => (
              <label key={l.id} className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={lojaIds.includes(l.id)}
                  onChange={() =>
                    setLojaIds((prev) =>
                      prev.includes(l.id)
                        ? prev.filter((x) => x !== l.id)
                        : [...prev, l.id]
                    )
                  }
                  className="adm-focusable rounded"
                  style={{ accentColor: "var(--adm-accent)" }}
                />
                <span className="text-sm" style={{ color: "var(--adm-text)" }}>{l.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {configurableModules.length === 0 && lojas.length <= 1 && (
        <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>
          Sem módulos ou múltiplas lojas para configurar nesta empresa.
        </p>
      )}

      <div className="flex justify-end pt-2" style={{ borderTop: "1px solid var(--adm-line)" }}>
        <AdminButton size="sm" onClick={handleSave} disabled={loading}>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {loading ? "Salvando..." : "Salvar acesso para essa empresa"}
        </AdminButton>
      </div>
    </div>
  );
}
