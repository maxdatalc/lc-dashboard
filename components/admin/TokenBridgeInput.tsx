"use client";

import { useState } from "react";
import { Check, Loader2, Key, Copy } from "lucide-react";

interface Props {
  clienteId: string;
  initialToken: string | null;
  isAdmin: boolean;
}

export function TokenBridgeInput({ clienteId, initialToken, isAdmin }: Props) {
  const [token, setToken]   = useState(initialToken ?? "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [erro, setErro]     = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/admin/clientes/${clienteId}/token`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql_bridge_token: token.trim() || null }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setErro(data.error ?? "Erro ao salvar token."); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setErro("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Key className="h-4 w-4 text-sky-600 shrink-0" />
        <p className="text-sm font-semibold text-sky-900">Token Bridge SQL</p>
        {token && (
          <span className="ml-auto text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            Preenchido
          </span>
        )}
      </div>

      <p className="text-xs text-sky-700 mb-3">
        {isAdmin
          ? "Token informado pelo suporte técnico para configurar a integração Bridge SQL."
          : "Informe o token de integração Bridge SQL para este cliente. O administrador usará este token ao criar o grupo."}
      </p>

      {isAdmin ? (
        /* Admin: leitura com botão copiar */
        token ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-sky-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 truncate">
              {token}
            </code>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 border border-sky-200 bg-white px-3 py-2 rounded-lg hover:bg-sky-50 transition-colors shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-sky-500 italic">Nenhum token informado pelo suporte.</p>
        )
      ) : (
        /* Suporte: editável */
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={token}
              onChange={(e) => { setToken(e.target.value); setSaved(false); }}
              placeholder="Cole o token Bridge SQL aqui..."
              className="flex-1 bg-white border border-sky-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/30 focus:border-sky-400 placeholder:text-slate-300"
            />
            <button
              onClick={handleSave}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-sky-600 text-white px-3.5 py-2 rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 shrink-0"
            >
              {loading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : saved
                  ? <Check className="h-3.5 w-3.5" />
                  : null}
              {saved ? "Salvo!" : "Salvar token"}
            </button>
          </div>
          {erro && (
            <p className="text-xs text-red-600">{erro}</p>
          )}
        </div>
      )}
    </div>
  );
}
