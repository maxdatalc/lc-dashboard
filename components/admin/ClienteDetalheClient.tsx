"use client";

import { useState } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import type { ClienteBase } from "@/lib/db/clientes-base";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminButton } from "@/components/admin/AdminButton";

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
    <AdminCard className="overflow-hidden p-0">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--adm-line)" }}>
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--adm-text)" }}>
            {values.nome_fantasia || values.razao_social}
          </h1>
          {values.nome_fantasia && (
            <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>{values.razao_social}</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--adm-signal)" }}>
                <Check className="h-3.5 w-3.5" /> Salvo
              </span>
            )}
            {!editing ? (
              <AdminButton variant="secondary" size="sm" onClick={startEdit}>
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </AdminButton>
            ) : (
              <div className="flex gap-2">
                <AdminButton variant="ghost" size="sm" onClick={cancelEdit} disabled={loading}>
                  <X className="h-3.5 w-3.5" /> Cancelar
                </AdminButton>
                <AdminButton size="sm" onClick={saveEdit} disabled={loading}>
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Salvar
                </AdminButton>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Campos */}
      <div>
        {CAMPOS.map(({ key, label, mono }, i) => (
          <div
            key={key}
            className="flex items-center gap-4 px-5 py-3"
            style={{ borderTop: i === 0 ? "none" : "1px solid var(--adm-line)" }}
          >
            <span className="w-32 shrink-0 text-xs font-medium" style={{ color: "var(--adm-text-faint)" }}>{label}</span>
            {isAdmin && editing ? (
              <input
                type="text"
                value={draft[key] ?? ""}
                onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.value }))}
                className={`adm-field adm-focusable flex-1 px-3 py-1.5 text-sm ${mono ? "adm-mono" : ""}`}
              />
            ) : (
              <span
                className={`flex-1 text-sm ${mono ? "adm-mono" : ""}`}
                style={{ color: values[key] ? "var(--adm-text)" : "var(--adm-text-faint)", fontStyle: values[key] ? "normal" : "italic" }}
              >
                {values[key] || "—"}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Erro */}
      {erro && (
        <div
          className="mx-5 mb-4 mt-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--adm-alert-soft)", border: "1px solid var(--adm-alert)", color: "var(--adm-alert)" }}
        >
          {erro}
        </div>
      )}

      {/* Metadata */}
      <div className="flex gap-6 px-5 py-3" style={{ background: "var(--adm-surface-2)", borderTop: "1px solid var(--adm-line)" }}>
        <div>
          <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>Importado em</p>
          <p className="mt-0.5 text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
            {new Date(cliente.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit", month: "long", year: "numeric"
            })}
          </p>
        </div>
        {cliente.updated_at !== cliente.created_at && (
          <div>
            <p className="text-xs" style={{ color: "var(--adm-text-faint)" }}>Atualizado em</p>
            <p className="mt-0.5 text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
              {new Date(cliente.updated_at).toLocaleDateString("pt-BR", {
                day: "2-digit", month: "long", year: "numeric"
              })}
            </p>
          </div>
        )}
      </div>
    </AdminCard>
  );
}
