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

const ROLE_CONFIG: Record<UserRole, { label: string; className: string; icon: React.ElementType }> = {
  owner: { label: "Proprietário", className: "bg-amber-100 text-amber-700 hover:bg-amber-200", icon: Crown },
  admin: { label: "Admin",        className: "bg-violet-100 text-violet-700 hover:bg-violet-200", icon: Shield },
  viewer:{ label: "Viewer",       className: "bg-slate-100 text-slate-500 hover:bg-slate-200",   icon: Eye   },
};

function RoleBadge({ role, onClick }: { role: UserRole; onClick?: () => void }) {
  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md transition-colors ${cfg.className} ${onClick ? "cursor-pointer" : "cursor-default"}`}
      title={onClick ? "Clique para alternar permissão" : undefined}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </button>
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
    <div className="p-6 space-y-5">
      {/* Toast de feedback */}
      {feedback && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
            feedback.tipo === "ok"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {feedback.tipo === "ok" ? <Check className="w-4 h-4" /> : "✕"}{" "}
          {feedback.msg}
        </div>
      )}

      {/* Breadcrumb */}
      <Link
        href="/admin/usuarios"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Todos os usuários
      </Link>

      {/* Header */}
      <div
        className="flex items-start justify-between gap-4 flex-wrap"
        style={{ animation: "fadeInUp 0.3s ease-out both" }}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-violet-200 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-violet-700">{iniciais}</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900">
                {usuario.full_name || "Sem nome"}
              </h1>
              {usuario.is_system_admin && (
                <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md">
                  <Crown className="w-3 h-3" />
                  System Admin
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              {usuario.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalSenha(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <KeyRound className="w-4 h-4" />
            Resetar senha
          </button>
          {!usuario.is_system_admin && (
            <button
              onClick={() => setModalExcluir(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Excluir usuário
            </button>
          )}
        </div>
      </div>

      {/* Cards de info */}
      <div
        className="grid grid-cols-2 gap-4"
        style={{ animation: "fadeInUp 0.35s ease-out both", animationDelay: "50ms" }}
      >
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
              Último acesso
            </p>
            <p className="text-sm font-semibold text-slate-700 mt-0.5">
              {formatarData(usuario.last_sign_in)}
            </p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
              Cadastrado em
            </p>
            <p className="text-sm font-semibold text-slate-700 mt-0.5">
              {formatarData(usuario.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Seção empresas */}
      <div
        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
        style={{ animation: "fadeInUp 0.4s ease-out both", animationDelay: "80ms" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              Empresas vinculadas
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {empresas.length === 0
                ? "Nenhuma empresa vinculada"
                : `${empresas.length} ${empresas.length === 1 ? "empresa" : "empresas"}`}
            </p>
          </div>
          {empresasDisponiveis.length > 0 && (
            <button
              onClick={() => setModalVincular(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-700 hover:shadow-md transition-all hover:-translate-y-px"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Vincular empresa
            </button>
          )}
        </div>

        {empresas.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
              <Building2 className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-sm text-slate-400">
              Este usuário não tem acesso a nenhuma empresa
            </p>
            {empresasDisponiveis.length > 0 && (
              <button
                onClick={() => setModalVincular(true)}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 border border-slate-200 px-3.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Vincular empresa
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {empresas.map((empresa, i) => (
              <div key={empresa.tenant_id}>
                <div
                  className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors group cursor-pointer"
                  style={{
                    animation: "fadeInUp 0.3s ease-out both",
                    animationDelay: `${i * 40}ms`,
                  }}
                  onClick={() =>
                    setExpandedTenantId(
                      expandedTenantId === empresa.tenant_id ? null : empresa.tenant_id
                    )
                  }
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-white uppercase">
                      {empresa.tenant_name.charAt(0)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {empresa.tenant_name}
                      </p>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          empresa.tenant_ativo
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {empresa.tenant_ativo ? "Ativa" : "Inativa"}
                      </span>
                      <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium capitalize">
                        {empresa.tenant_plan}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
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
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Remover acesso"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                      expandedTenantId === empresa.tenant_id ? "rotate-180" : ""
                    }`}
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
      </div>

      {/* Modal — Resetar senha */}
      {modalSenha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Resetar senha</h3>
                <p className="text-xs text-slate-400">{usuario.email}</p>
              </div>
            </div>

            <div className="space-y-1.5 mb-5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Nova senha
              </label>
              <div className="relative">
                <input
                  type={senhaVisivel ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  autoFocus
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                />
                <button
                  type="button"
                  onClick={() => setSenhaVisivel((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
              {novaSenha.length > 0 && novaSenha.length < 6 && (
                <p className="text-xs text-red-500">
                  Mínimo 6 caracteres ({novaSenha.length}/6)
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setModalSenha(false);
                  setNovaSenha("");
                }}
                className="flex-1 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleResetarSenha}
                disabled={isPending || novaSenha.length < 6}
                className="flex-1 py-2.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Vincular empresa */}
      {modalVincular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">
                  Vincular empresa
                </h3>
                <p className="text-xs text-slate-400">{usuario.email}</p>
              </div>
            </div>

            <div className="space-y-4 mb-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Empresa
                </label>
                <div className="relative">
                  <select
                    value={empresaVincular}
                    onChange={(e) => setEmpresaVincular(e.target.value)}
                    className="w-full appearance-none border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-white pr-8"
                  >
                    <option value="">Selecione uma empresa...</option>
                    {empresasDisponiveis.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Permissão
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["owner", "admin", "viewer"] as const).map((r) => {
                    const cfg = ROLE_CONFIG[r];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRoleVincular(r)}
                        className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium border transition-all ${
                          roleVincular === r
                            ? "border-violet-500 bg-violet-50 text-violet-700"
                            : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400">
                  {roleVincular === "owner"
                    ? "Proprietário: acesso total, pode gerenciar usuários"
                    : roleVincular === "admin"
                    ? "Admin: pode editar configurações e ver dados"
                    : "Viewer: somente leitura do dashboard"}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setModalVincular(false);
                  setEmpresaVincular("");
                  setRoleVincular("viewer");
                }}
                className="flex-1 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleVincular}
                disabled={isPending || !empresaVincular}
                className="flex-1 py-2.5 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Vinculando..." : "Vincular"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Excluir usuário */}
      {modalExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Excluir usuário</h3>
                <p className="text-xs text-slate-400">Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-lg px-3.5 py-3 mb-5 mt-4">
              <p className="text-sm text-red-700">
                O usuário{" "}
                <span className="font-semibold">
                  {usuario.full_name || usuario.email}
                </span>{" "}
                será removido permanentemente do sistema, incluindo todos os
                acessos às empresas vinculadas.
              </p>
            </div>

            <div className="space-y-1.5 mb-5">
              <label className="text-xs font-medium text-slate-500">
                Digite{" "}
                <span className="font-semibold text-slate-700">
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
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setModalExcluir(false);
                  setConfirmacaoNome("");
                }}
                className="flex-1 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleExcluir}
                disabled={isPending || confirmacaoNome !== usuario.email}
                className="flex-1 py-2.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? "Excluindo..." : "Excluir permanentemente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Painel de acesso por empresa ──────────────────────────────────────────────

const MODULES_LABEL: Record<string, string> = {
  dashboard_visao_geral: "Vendas",
  modulo_financeiro:     "Financeiro",
  modulo_produtos:       "Produtos",
  modulo_clientes:       "Clientes",
  modulo_os:             "O.S",
  modulo_relatorios:     "Comissão por Recebimento",
};

const MODULE_GROUPS: { label: string; keys: string[] }[] = [
  { label: "Dashboard",  keys: ["dashboard_visao_geral", "modulo_financeiro", "modulo_produtos", "modulo_clientes"] },
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
    <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-4">
      {erro && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {erro}
        </div>
      )}

      {/* Módulos agrupados */}
      {configurableModules.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Módulos
          </p>
          {MODULE_GROUPS.map((group) => {
            const groupMods = group.keys.filter((k) => configurableModules.includes(k));
            if (groupMods.length === 0) return null;
            return (
              <div key={group.label}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-3">
                  {groupMods.map((k) => (
                    <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modulos[k] ?? false}
                        onChange={() => setModulos((prev) => ({ ...prev, [k]: !prev[k] }))}
                        className="rounded border-slate-300 text-slate-800"
                      />
                      <span className="text-sm text-slate-700">{MODULES_LABEL[k] ?? k}</span>
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
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Lojas visíveis{" "}
            <span className="font-normal normal-case tracking-normal text-slate-400">
              (vazio = todas)
            </span>
          </p>
          <div className="flex flex-wrap gap-3">
            {lojas.map((l) => (
              <label key={l.id} className="flex items-center gap-1.5 cursor-pointer">
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
                  className="rounded border-slate-300 text-slate-800"
                />
                <span className="text-sm text-slate-700">{l.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {configurableModules.length === 0 && lojas.length <= 1 && (
        <p className="text-xs text-slate-400">
          Sem módulos ou múltiplas lojas para configurar nesta empresa.
        </p>
      )}

      <div className="flex justify-end pt-2 border-t border-slate-200">
        <button
          onClick={handleSave}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-700 disabled:opacity-60 transition-colors"
        >
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {loading ? "Salvando..." : "Salvar acesso para essa empresa"}
        </button>
      </div>
    </div>
  );
}
