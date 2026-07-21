"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  MoreHorizontal,
  Building2,
  Shield,
  Eye,
  KeyRound,
  UserPlus,
  Trash2,
  ChevronDown,
} from "lucide-react";
import {
  resetarSenhaUsuario,
  vincularEmpresaUsuario,
  desvincularEmpresaUsuario,
  criarUsuario,
} from "@/app/actions/admin-usuarios";

interface Empresa {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  role: string;
}

interface Usuario {
  id: string;
  email: string;
  full_name: string;
  is_system_admin: boolean;
  last_sign_in: string | null;
  created_at: string;
  empresas: Empresa[];
}

interface EmpresaOption {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  usuarios: Usuario[];
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

const modalCard: CSSProperties = {
  background: "var(--adm-surface)",
  border: "1px solid var(--adm-line-strong)",
  boxShadow: "var(--adm-shadow)",
};
const fieldLabel: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--adm-text-faint)",
};
const btnPrimary: CSSProperties = { background: "var(--adm-accent)", color: "#04121a" };
const btnSecondary: CSSProperties = {
  background: "var(--adm-surface-2)",
  color: "var(--adm-text-dim)",
  border: "1px solid var(--adm-line-strong)",
};

function RoleBadge({ role }: { role: string }) {
  const cfg =
    role === "owner"
      ? { bg: "var(--adm-warn-soft)", color: "var(--adm-warn)", label: "Owner", Icon: Shield }
      : role === "admin"
      ? { bg: "var(--adm-accent-soft)", color: "var(--adm-accent)", label: "Admin", Icon: Shield }
      : { bg: "var(--adm-surface-3)", color: "var(--adm-text-dim)", label: "Viewer", Icon: Eye };
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <cfg.Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  );
}

export function UsuariosClient({ usuarios: initialUsuarios, todasEmpresas }: Props) {
  const router = useRouter();
  const [usuarios] = useState(initialUsuarios);
  const [busca, setBusca] = useState("");
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [modalVincular, setModalVincular] = useState<string | null>(null);
  const [modalSenha, setModalSenha] = useState<string | null>(null);
  const [modalCriar, setModalCriar] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [novaSenhaTemp, setNovaSenhaTemp] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [empresaVincular, setEmpresaVincular] = useState("");
  const [roleVincular, setRoleVincular] = useState<"owner" | "admin" | "viewer">("viewer");
  const [feedback, setFeedback] = useState<{
    tipo: "ok" | "erro";
    msg: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtrados = usuarios.filter(
    (u) =>
      u.email.toLowerCase().includes(busca.toLowerCase()) ||
      u.full_name.toLowerCase().includes(busca.toLowerCase())
  );

  function mostrarFeedback(tipo: "ok" | "erro", msg: string) {
    setFeedback({ tipo, msg });
    setTimeout(() => setFeedback(null), 3500);
  }

  function handleCriarUsuario() {
    if (!novoEmail || !novaSenhaTemp || novaSenhaTemp.length < 6) return;
    startTransition(async () => {
      const result = await criarUsuario({
        email: novoEmail,
        senha: novaSenhaTemp,
        nome: novoNome,
      });
      if (result.error) {
        mostrarFeedback("erro", result.error);
      } else {
        mostrarFeedback("ok", "Usuário criado — ele deverá definir uma senha permanente no primeiro acesso");
        setModalCriar(false);
        setNovoNome("");
        setNovoEmail("");
        setNovaSenhaTemp("");
        router.refresh();
      }
    });
  }

  function handleResetarSenha() {
    if (!modalSenha || !novaSenha || novaSenha.length < 6) return;
    startTransition(async () => {
      const result = await resetarSenhaUsuario(modalSenha, novaSenha);
      if (result.error) {
        mostrarFeedback("erro", result.error);
      } else {
        mostrarFeedback("ok", "Senha resetada — o usuário deverá criar uma nova senha no próximo acesso");
        setModalSenha(null);
        setNovaSenha("");
      }
    });
  }

  function handleVincular() {
    if (!modalVincular || !empresaVincular) return;
    startTransition(async () => {
      const result = await vincularEmpresaUsuario(
        modalVincular,
        empresaVincular,
        roleVincular
      );
      if (result.error) {
        mostrarFeedback("erro", result.error);
      } else {
        mostrarFeedback("ok", "Empresa vinculada com sucesso");
        setModalVincular(null);
        setEmpresaVincular("");
      }
    });
  }

  function handleDesvincular(userId: string, tenantId: string) {
    startTransition(async () => {
      const result = await desvincularEmpresaUsuario(userId, tenantId);
      if (result.error) {
        mostrarFeedback("erro", result.error);
      } else {
        mostrarFeedback("ok", "Acesso removido");
      }
    });
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="adm-rise flex items-center justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--adm-accent)" }}>
            Sistema
          </p>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--adm-text)" }}>Usuários</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--adm-text-dim)" }}>
            {usuarios.length}{" "}
            {usuarios.length === 1 ? "usuário cadastrado" : "usuários cadastrados"}
          </p>
        </div>
        <button
          onClick={() => setModalCriar(true)}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all"
          style={{ background: "var(--adm-accent)", color: "#04121a" }}
        >
          <UserPlus className="h-4 w-4" />
          Novo usuário
        </button>
      </div>

      {/* Barra de busca */}
      <div className="adm-rise relative" style={{ animationDelay: "50ms" }}>
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: "var(--adm-text-faint)" }}
        />
        <input
          type="text"
          placeholder="Buscar por nome ou e-mail…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="adm-field w-full py-2.5 pl-10 pr-4 text-sm"
        />
      </div>

      {/* Toast de feedback */}
      {feedback && (
        <div
          className="fixed right-6 top-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium"
          style={{
            background: feedback.tipo === "ok" ? "var(--adm-signal-soft)" : "var(--adm-alert-soft)",
            color: feedback.tipo === "ok" ? "var(--adm-signal)" : "var(--adm-alert)",
            border: `1px solid ${feedback.tipo === "ok" ? "var(--adm-signal)" : "var(--adm-alert)"}`,
            boxShadow: "var(--adm-shadow)",
          }}
        >
          {feedback.tipo === "ok" ? "✓" : "✕"} {feedback.msg}
        </div>
      )}

      {/* Tabela */}
      <div
        className="adm-rise overflow-x-auto rounded-xl"
        style={{ animationDelay: "80ms", background: "var(--adm-surface)", border: "1px solid var(--adm-line)", boxShadow: "var(--adm-shadow-sm)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--adm-line)", background: "var(--adm-surface-2)" }}>
              {["Usuário", "Empresas", "Último acesso", "Criado em"].map((col) => (
                <th
                  key={col}
                  className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--adm-text-faint)" }}
                >
                  {col}
                </th>
              ))}
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtrados.map((usuario, i) => (
              <tr
                key={usuario.id}
                onClick={() => router.push(`/admin/usuarios/${usuario.id}`)}
                className="adm-rise adm-row cursor-pointer"
                style={{
                  borderTop: i === 0 ? "none" : "1px solid var(--adm-line)",
                  animationDelay: `${i * 28}ms`,
                }}
              >
                {/* Usuário */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{ background: "var(--adm-accent-soft)", border: "1px solid var(--adm-line-strong)" }}
                    >
                      <span className="text-xs font-semibold uppercase" style={{ color: "var(--adm-accent)" }}>
                        {(usuario.full_name || usuario.email).charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium" style={{ color: "var(--adm-text)" }}>
                          {usuario.full_name || "—"}
                        </p>
                        {usuario.is_system_admin && (
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                            style={{ background: "var(--adm-warn-soft)", color: "var(--adm-warn)" }}
                          >
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>{usuario.email}</p>
                    </div>
                  </div>
                </td>

                {/* Empresas vinculadas */}
                <td className="px-5 py-4">
                  {usuario.empresas.length === 0 ? (
                    <span className="text-xs italic" style={{ color: "var(--adm-text-faint)" }}>
                      Sem empresa
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {usuario.empresas.map((emp) => (
                        <div
                          key={emp.tenant_id}
                          className="group flex items-center gap-1 rounded-md px-2 py-1"
                          style={{ background: "var(--adm-surface-2)" }}
                        >
                          <Building2 className="h-3 w-3 shrink-0" style={{ color: "var(--adm-text-faint)" }} />
                          <span className="text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
                            {emp.tenant_name}
                          </span>
                          <RoleBadge role={emp.role} />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDesvincular(usuario.id, emp.tenant_id);
                            }}
                            disabled={isPending}
                            className="ml-0.5 opacity-100 transition-colors md:opacity-0 md:group-hover:opacity-100"
                            style={{ color: "var(--adm-text-faint)" }}
                            title="Remover acesso"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </td>

                {/* Último acesso */}
                <td className="adm-mono px-5 py-4 text-xs" style={{ color: "var(--adm-text-dim)" }}>
                  {formatarData(usuario.last_sign_in)}
                </td>

                {/* Criado em */}
                <td className="adm-mono px-5 py-4 text-xs" style={{ color: "var(--adm-text-dim)" }}>
                  {formatarData(usuario.created_at)}
                </td>

                {/* Menu de ações */}
                <td className="px-5 py-4">
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuAberto(menuAberto === usuario.id ? null : usuario.id);
                      }}
                      className="rounded-md p-1.5 transition-colors"
                      style={{ color: "var(--adm-text-dim)" }}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>

                    {menuAberto === usuario.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuAberto(null);
                          }}
                        />
                        <div
                          className="absolute right-0 top-8 z-20 w-48 rounded-xl py-1 text-sm"
                          style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line-strong)", boxShadow: "var(--adm-shadow)" }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalVincular(usuario.id);
                              setMenuAberto(null);
                            }}
                            className="adm-row flex w-full items-center gap-2.5 px-3.5 py-2"
                            style={{ color: "var(--adm-text-dim)" }}
                          >
                            <UserPlus className="h-3.5 w-3.5" style={{ color: "var(--adm-text-faint)" }} />
                            Vincular empresa
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalSenha(usuario.id);
                              setMenuAberto(null);
                            }}
                            className="adm-row flex w-full items-center gap-2.5 px-3.5 py-2"
                            style={{ color: "var(--adm-text-dim)" }}
                          >
                            <KeyRound className="h-3.5 w-3.5" style={{ color: "var(--adm-text-faint)" }} />
                            Resetar senha
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm" style={{ color: "var(--adm-text-faint)" }}>
                  Nenhum usuário encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal — Criar usuário */}
      {modalCriar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="adm-rise w-full max-w-sm rounded-2xl p-6" style={modalCard}>
            <div className="mb-5 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--adm-accent-soft)" }}>
                <UserPlus className="h-4 w-4" style={{ color: "var(--adm-accent)" }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>Novo usuário</h3>
                <p className="text-xs" style={{ color: "var(--adm-text-dim)" }}>
                  A senha definida aqui é temporária — o usuário deverá alterá-la no primeiro acesso.
                </p>
              </div>
            </div>

            <div className="mb-5 space-y-3">
              <div className="space-y-1.5">
                <label style={fieldLabel}>Nome completo</label>
                <input
                  type="text"
                  placeholder="Ex: João Silva"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="adm-field w-full px-3.5 py-2.5 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label style={fieldLabel}>E-mail</label>
                <input
                  type="email"
                  placeholder="usuario@empresa.com"
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                  autoFocus
                  className="adm-field w-full px-3.5 py-2.5 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label style={fieldLabel}>Senha temporária</label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={novaSenhaTemp}
                  onChange={(e) => setNovaSenhaTemp(e.target.value)}
                  className="adm-field w-full px-3.5 py-2.5 text-sm"
                />
              </div>
              <div
                className="flex items-start gap-2 rounded-lg px-3.5 py-2.5"
                style={{ background: "var(--adm-warn-soft)", border: "1px solid var(--adm-warn)" }}
              >
                <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--adm-warn)" }} />
                <p className="text-xs leading-relaxed" style={{ color: "var(--adm-warn)" }}>
                  O usuário será obrigado a criar uma nova senha no primeiro login.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setModalCriar(false);
                  setNovoNome("");
                  setNovoEmail("");
                  setNovaSenhaTemp("");
                }}
                className="flex-1 rounded-lg py-2.5 text-sm transition-colors"
                style={btnSecondary}
              >
                Cancelar
              </button>
              <button
                onClick={handleCriarUsuario}
                disabled={isPending || !novoEmail || novaSenhaTemp.length < 6}
                className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                style={btnPrimary}
              >
                {isPending ? "Criando..." : "Criar usuário"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Resetar senha */}
      {modalSenha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="adm-rise w-full max-w-sm rounded-2xl p-6" style={modalCard}>
            <div className="mb-5 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--adm-accent-soft)" }}>
                <KeyRound className="h-4 w-4" style={{ color: "var(--adm-accent)" }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>Resetar senha</h3>
                <p className="adm-mono text-xs" style={{ color: "var(--adm-text-dim)" }}>
                  {usuarios.find((u) => u.id === modalSenha)?.email}
                </p>
              </div>
            </div>

            <div className="mb-5 space-y-3">
              <div className="space-y-1.5">
                <label style={fieldLabel}>Senha temporária</label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  autoFocus
                  className="adm-field w-full px-3.5 py-2.5 text-sm"
                />
              </div>
              <div
                className="flex items-start gap-2 rounded-lg px-3.5 py-2.5"
                style={{ background: "var(--adm-warn-soft)", border: "1px solid var(--adm-warn)" }}
              >
                <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--adm-warn)" }} />
                <p className="text-xs leading-relaxed" style={{ color: "var(--adm-warn)" }}>
                  O usuário deverá criar uma nova senha no próximo login.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setModalSenha(null);
                  setNovaSenha("");
                }}
                className="flex-1 rounded-lg py-2.5 text-sm transition-colors"
                style={btnSecondary}
              >
                Cancelar
              </button>
              <button
                onClick={handleResetarSenha}
                disabled={isPending || novaSenha.length < 6}
                className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                style={btnPrimary}
              >
                {isPending ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Vincular empresa */}
      {modalVincular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="adm-rise w-full max-w-sm rounded-2xl p-6" style={modalCard}>
            <div className="mb-5 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--adm-accent-soft)" }}>
                <Building2 className="h-4 w-4" style={{ color: "var(--adm-accent)" }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>Vincular empresa</h3>
                <p className="adm-mono text-xs" style={{ color: "var(--adm-text-dim)" }}>
                  {usuarios.find((u) => u.id === modalVincular)?.email}
                </p>
              </div>
            </div>

            <div className="mb-5 space-y-3">
              <div className="space-y-1.5">
                <label style={fieldLabel}>Empresa</label>
                <div className="relative">
                  <select
                    value={empresaVincular}
                    onChange={(e) => setEmpresaVincular(e.target.value)}
                    className="adm-field w-full appearance-none px-3.5 py-2.5 pr-8 text-sm"
                  >
                    <option value="">Selecione...</option>
                    {todasEmpresas
                      .filter((e) => {
                        const u = usuarios.find((u) => u.id === modalVincular);
                        return !u?.empresas.some((em) => em.tenant_id === e.id);
                      })
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--adm-text-faint)" }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label style={fieldLabel}>Permissão</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["viewer", "admin"] as const).map((r) => {
                    const active = roleVincular === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRoleVincular(r)}
                        className="flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium transition-all"
                        style={{
                          border: `1px solid ${active ? "var(--adm-accent)" : "var(--adm-line-strong)"}`,
                          background: active ? "var(--adm-accent-soft)" : "transparent",
                          color: active ? "var(--adm-accent)" : "var(--adm-text-dim)",
                        }}
                      >
                        {r === "admin" ? <Shield className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        {r === "admin" ? "Admin" : "Viewer"}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setModalVincular(null);
                  setEmpresaVincular("");
                }}
                className="flex-1 rounded-lg py-2.5 text-sm transition-colors"
                style={btnSecondary}
              >
                Cancelar
              </button>
              <button
                onClick={handleVincular}
                disabled={isPending || !empresaVincular}
                className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                style={btnPrimary}
              >
                {isPending ? "Vinculando..." : "Vincular"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
