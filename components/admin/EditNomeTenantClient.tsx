"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Loader2 } from "lucide-react";

interface Props {
  tenantId: string;
  currentName: string;
}

export function EditNomeTenantClient({ tenantId, currentName }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nome, setNome] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function handleCancel() {
    setNome(currentName);
    setErro(null);
    setEditing(false);
  }

  async function handleSave() {
    if (!nome.trim() || nome.trim() === currentName) {
      setEditing(false);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nome.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErro(data.error ?? "Erro ao salvar");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setErro("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  if (!editing) {
    return (
      <div className="group flex items-center gap-2">
        <h1 className="text-2xl font-bold leading-tight tracking-tight" style={{ color: "var(--adm-text)" }}>
          {currentName}
        </h1>
        <button
          onClick={() => setEditing(true)}
          className="adm-focusable rounded p-1 opacity-100 transition-all md:opacity-0 md:group-hover:opacity-100"
          style={{ color: "var(--adm-text-faint)" }}
          title="Editar nome"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") handleCancel();
        }}
        autoFocus
        className="adm-focusable min-w-[200px] border-b-2 bg-transparent pb-0.5 text-2xl font-bold leading-tight"
        style={{ color: "var(--adm-text)", borderColor: "var(--adm-line-strong)" }}
      />
      <div className="flex items-center gap-1">
        <button
          onClick={handleSave}
          disabled={loading}
          className="adm-focusable rounded-lg p-1.5 transition-colors disabled:opacity-50"
          style={{ background: "var(--adm-accent)", color: "#04121a" }}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="adm-focusable rounded-lg p-1.5 transition-colors"
          style={{ border: "1px solid var(--adm-line-strong)", color: "var(--adm-text-dim)" }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {erro && (
        <p className="w-full text-xs" style={{ color: "var(--adm-alert)" }}>
          {erro}
        </p>
      )}
    </div>
  );
}
