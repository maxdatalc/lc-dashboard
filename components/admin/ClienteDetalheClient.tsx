"use client";

import { useState } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import type { ClienteBase } from "@/lib/db/clientes-base";

const CAMPOS: { key: keyof ClienteBase; label: string; mono?: boolean }[] = [
  { key: "codigo_externo", label: "Código externo", mono: true },
  { key: "razao_social",   label: "Razão Social" },
  { key: "nome_fantasia",  label: "Nome Fantasia" },
  { key: "cnpj_cpf",      label: "CNPJ / CPF", mono: true },
  { key: "segmento",       label: "Segmento" },
  { key: "cidade",         label: "Cidade" },
  { key: "telefone",       label: "Telefone", mono: true },
];

interface Props {
  cliente: ClienteBase;
  isAdmin: boolean;
}

export function ClienteDetalheClient({ cliente, isAdmin }: Props) {
  const [values, setValues] = useState<Record<string, string>>({
    codigo_externo: cliente.codigo_externo ?? "",
    razao_social:   cliente.razao_social,
    nome_fantasia:  cliente.nome_fantasia ?? "",
    cnpj_cpf:       cliente.cnpj_cpf ?? "",
    segmento:       cliente.segmento ?? "",
    cidade:         cliente.cidade ?? "",
    telefone:       cliente.telefone ?? "",
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [erro, setErro]       = useState<string | null>(null);
  const [saved, setSaved]     = useState(false);

  const startEdit = () => {
    setDraft({ ...values });
    setEditing(true);
    setErro(null);
    setSaved(false);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft({});
    setErro(null);
  };

  const saveEdit = async () => {
    if (!draft.razao_social?.trim()) {
      setErro("Razão Social é obrigatória.");
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/admin/clientes/${cliente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setErro(data.error ?? "Erro ao salvar."); return; }
      setValues({ ...draft });
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setErro("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            {values.nome_fantasia || values.razao_social}
          </h1>
          {values.nome_fantasia && (
            <p className="text-xs text-slate-400 mt-0.5">{values.razao_social}</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <Check className="h-3.5 w-3.5" /> Salvo
              </span>
            )}
            {!editing ? (
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={cancelEdit}
                  disabled={loading}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="h-3.5 w-3.5" /> Cancelar
                </button>
                <button
                  onClick={saveEdit}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Salvar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Campos */}
      <div className="divide-y divide-slate-50">
        {CAMPOS.map(({ key, label, mono }) => (
          <div key={key} className="flex items-center gap-4 px-5 py-3">
            <span className="text-xs font-medium text-slate-400 w-32 shrink-0">{label}</span>
            {isAdmin && editing ? (
              <input
                type="text"
                value={draft[key] ?? ""}
                onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.value }))}
                className={`flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 bg-white ${mono ? "font-mono" : ""}`}
              />
            ) : (
              <span className={`text-sm flex-1 ${mono ? "font-mono text-slate-600" : "text-slate-800"} ${!values[key] ? "text-slate-300 italic" : ""}`}>
                {values[key] || "—"}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Erro */}
      {erro && (
        <div className="mx-5 mb-4 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {erro}
        </div>
      )}

      {/* Metadata */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex gap-6">
        <div>
          <p className="text-xs text-slate-400">Importado em</p>
          <p className="text-xs text-slate-600 mt-0.5 font-medium">
            {new Date(cliente.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit", month: "long", year: "numeric"
            })}
          </p>
        </div>
        {cliente.updated_at !== cliente.created_at && (
          <div>
            <p className="text-xs text-slate-400">Atualizado em</p>
            <p className="text-xs text-slate-600 mt-0.5 font-medium">
              {new Date(cliente.updated_at).toLocaleDateString("pt-BR", {
                day: "2-digit", month: "long", year: "numeric"
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
