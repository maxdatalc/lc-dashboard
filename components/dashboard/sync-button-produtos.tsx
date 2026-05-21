"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  lojaId?: string;
}

export function SyncButtonProdutos({ lojaId: _lojaId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setResultado(null);
    setErro(null);

    try {
      const res = await fetch("/api/sync/produtos-rapido", { method: "POST" });
      const data = await res.json() as {
        success?: boolean;
        atualizados?: number;
        error?: string;
      };

      if (!res.ok || !data.success) {
        setErro(data.error ?? "Erro ao atualizar produtos");
        return;
      }

      setResultado(`${data.atualizados?.toLocaleString("pt-BR") ?? 0} produtos atualizados`);
      setTimeout(() => router.refresh(), 3000);
    } catch {
      setErro("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  if (resultado) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {resultado}
      </div>
    );
  }

  if (erro) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 max-w-xs truncate">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {erro}
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 transition-colors"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          Atualizando...
        </>
      ) : (
        <>
          <Package className="h-4 w-4 shrink-0" />
          Atualizar produtos
        </>
      )}
    </button>
  );
}
