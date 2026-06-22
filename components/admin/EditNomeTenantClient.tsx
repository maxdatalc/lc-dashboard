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
      <div className="flex items-center gap-2 group">
        <h1 className="text-2xl font-bold text-slate-900 leading-tight">{currentName}</h1>
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          title="Editar nome"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") handleCancel();
        }}
        autoFocus
        className="text-2xl font-bold text-slate-900 border-b-2 border-slate-400 bg-transparent focus:outline-none focus:border-slate-900 leading-tight pb-0.5 min-w-[200px]"
      />
      <div className="flex items-center gap-1">
        <button
          onClick={handleSave}
          disabled={loading}
          className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {erro && <p className="text-xs text-red-500 w-full">{erro}</p>}
    </div>
  );
}
