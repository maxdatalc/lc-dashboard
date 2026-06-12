"use client";

// Seção de usuários do painel admin — lista usuários do tenant e permite adicionar novos.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, AlertCircle } from "lucide-react";
import { adicionarUsuarioTenant } from "@/lib/actions/admin-lojas";

type UserRole = "owner" | "admin" | "viewer";

interface Usuario {
  id: string;
  userId: string;
  role: UserRole;
  fullName: string;
  email: string;
}

interface Props {
  tenantId: string;
  usuarios: Usuario[];
}

export function UsuariosSectionClient({ tenantId, usuarios }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    nomeCompleto: "",
    senha: "",
    papel: "viewer" as UserRole,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro(null);

    const result = await adicionarUsuarioTenant(tenantId, form);
    if (result.error) {
      setErro(result.error);
      setLoading(false);
      return;
    }

    setShowForm(false);
    setForm({ email: "", nomeCompleto: "", senha: "", papel: "viewer" as UserRole });
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-600">
          {usuarios.length}{" "}
          {usuarios.length === 1 ? "usuário vinculado" : "usuários vinculados"}
        </p>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setErro(null);
          }}
          className="inline-flex items-center gap-1.5 text-sm bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-700 transition-colors"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Adicionar Usuário
        </button>
      </div>

      {/* Tabela de usuários */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {usuarios.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Nenhum usuário vinculado a este tenant.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Nome", "Email", "Papel"].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {u.fullName || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{u.email || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.role === "owner"
                          ? "bg-amber-100 text-amber-700"
                          : u.role === "admin"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {u.role === "owner" ? "Proprietário" : u.role === "admin" ? "Admin" : "Viewer"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Formulário de adicionar usuário */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-slate-800">Novo Usuário</h3>

          {erro && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {erro}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nome completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.nomeCompleto}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nomeCompleto: e.target.value }))
                }
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Senha provisória <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={form.senha}
                onChange={(e) =>
                  setForm((f) => ({ ...f, senha: e.target.value }))
                }
                placeholder="Mínimo 8 caracteres"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Papel
              </label>
              <select
                value={form.papel}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    papel: e.target.value as UserRole,
                  }))
                }
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="viewer">Visualizador</option>
                <option value="admin">Administrador</option>
                <option value="owner">Proprietário</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setErro(null);
              }}
              className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {loading ? "Criando..." : "Criar Usuário"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
