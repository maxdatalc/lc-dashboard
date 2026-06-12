"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
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

function RoleBadge({ role }: { role: string }) {
  const cfg =
    role === "owner"
      ? { className: "bg-amber-100 text-amber-700", label: "Owner", Icon: Shield }
      : role === "admin"
      ? { className: "bg-violet-100 text-violet-700", label: "Admin", Icon: Shield }
      : { className: "bg-slate-100 text-slate-500", label: "Viewer", Icon: Eye };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider ${cfg.className}`}
    >
      <cfg.Icon className="w-2.5 h-2.5" />
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

  function handleResetarSenha() {
    if (!modalSenha || !novaSenha || novaSenha.length < 6) return;
    startTransition(async () => {
      const result = await resetarSenhaUsuario(modalSenha, novaSenha);
      if (result.error) {
        mostrarFeedback("erro", result.error);
      } else {
        mostrarFeedback("ok", "Senha alterada com sucesso");
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
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-slate-400" />
            Usuários
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {usuarios.length}{" "}
            {usuarios.length === 1
              ? "usuário cadastrado"
              : "usuários cadastrados"}
          </p>
        </div>
      </div>

      {/* Barra de busca */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-white"
        />
      </div>

      {/* Toast de feedback */}
      {feedback && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
            feedback.tipo === "ok"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {feedback.tipo === "ok" ? "✓" : "✕"} {feedback.msg}
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Usuário
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Empresas
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Último acesso
              </th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Criado em
              </th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtrados.map((usuario) => (
              <tr
                key={usuario.id}
                onClick={() => router.push(`/admin/usuarios/${usuario.id}`)}
                className="hover:bg-slate-50/50 transition-colors cursor-pointer"
              >
                {/* Usuário */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-100 to-violet-200 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-violet-700 uppercase">
                        {(usuario.full_name || usuario.email).charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900 text-sm">
                          {usuario.full_name || "—"}
                        </p>
                        {usuario.is_system_admin && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{usuario.email}</p>
                    </div>
                  </div>
                </td>

                {/* Empresas vinculadas */}
                <td className="px-5 py-4">
                  {usuario.empresas.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">
                      Sem empresa
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {usuario.empresas.map((emp) => (
                        <div
                          key={emp.tenant_id}
                          className="flex items-center gap-1 bg-slate-100 rounded-md px-2 py-1 group"
                        >
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="text-xs text-slate-600 font-medium">
                            {emp.tenant_name}
                          </span>
                          <RoleBadge role={emp.role} />
                          <button
                            onClick={() =>
                              handleDesvincular(usuario.id, emp.tenant_id)
                            }
                            disabled={isPending}
                            className="ml-0.5 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="Remover acesso"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </td>

                {/* Último acesso */}
                <td className="px-5 py-4 text-xs text-slate-500">
                  {formatarData(usuario.last_sign_in)}
                </td>

                {/* Criado em */}
                <td className="px-5 py-4 text-xs text-slate-500">
                  {formatarData(usuario.created_at)}
                </td>

                {/* Menu de ações */}
                <td className="px-5 py-4">
                  <div className="relative">
                    <button
                      onClick={() =>
                        setMenuAberto(
                          menuAberto === usuario.id ? null : usuario.id
                        )
                      }
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {menuAberto === usuario.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setMenuAberto(null)}
                        />
                        <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 w-48 text-sm">
                          <button
                            onClick={() => {
                              setModalVincular(usuario.id);
                              setMenuAberto(null);
                            }}
                            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <UserPlus className="w-3.5 h-3.5 text-slate-400" />
                            Vincular empresa
                          </button>
                          <button
                            onClick={() => {
                              setModalSenha(usuario.id);
                              setMenuAberto(null);
                            }}
                            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-slate-400" />
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
                <td
                  colSpan={5}
                  className="px-5 py-12 text-center text-sm text-slate-400"
                >
                  Nenhum usuário encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal — Resetar senha */}
      {modalSenha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">
                  Resetar senha
                </h3>
                <p className="text-xs text-slate-500">
                  {usuarios.find((u) => u.id === modalSenha)?.email}
                </p>
              </div>
            </div>

            <div className="space-y-1.5 mb-5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Nova senha
              </label>
              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                autoFocus
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setModalSenha(null);
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
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">
                  Vincular empresa
                </h3>
                <p className="text-xs text-slate-500">
                  {usuarios.find((u) => u.id === modalVincular)?.email}
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
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
                    <option value="">Selecione...</option>
                    {todasEmpresas
                      .filter((e) => {
                        const u = usuarios.find((u) => u.id === modalVincular);
                        return !u?.empresas.some(
                          (em) => em.tenant_id === e.id
                        );
                      })
                      .map((e) => (
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
                <div className="grid grid-cols-2 gap-2">
                  {(["viewer", "admin"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoleVincular(r)}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                        roleVincular === r
                          ? "border-violet-500 bg-violet-50 text-violet-700"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {r === "admin" ? (
                        <Shield className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      {r === "admin" ? "Admin" : "Viewer"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setModalVincular(null);
                  setEmpresaVincular("");
                }}
                className="flex-1 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleVincular}
                disabled={isPending || !empresaVincular}
                className="flex-1 py-2.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-50 transition-colors"
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
