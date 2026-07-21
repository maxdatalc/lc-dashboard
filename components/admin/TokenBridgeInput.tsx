"use client";

import { useState } from "react";
import { Check, Loader2, Key, Copy } from "lucide-react";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminBadge } from "@/components/admin/AdminBadge";

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
    <div className="rounded-xl p-4" style={{ border: "1px solid var(--adm-accent)", background: "var(--adm-accent-soft)" }}>
      <div className="mb-1 flex items-center gap-2">
        <Key className="h-4 w-4 shrink-0" style={{ color: "var(--adm-accent)" }} />
        <p className="text-sm font-semibold" style={{ color: "var(--adm-accent)" }}>Token Bridge SQL</p>
        {token && (
          <span className="ml-auto">
            <AdminBadge variant="success">Preenchido</AdminBadge>
          </span>
        )}
      </div>

      <p className="mb-3 text-xs" style={{ color: "var(--adm-accent)" }}>
        {isAdmin
          ? "Token informado pelo suporte técnico para configurar a integração Bridge SQL."
          : "Informe o token de integração Bridge SQL para este cliente. O administrador usará este token ao criar o grupo."}
      </p>

      {isAdmin ? (
        /* Admin: leitura com botão copiar */
        token ? (
          <div className="flex items-center gap-2">
            <code
              className="adm-mono flex-1 truncate rounded-lg px-3 py-2 text-xs"
              style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line-strong)", color: "var(--adm-text)" }}
            >
              {token}
            </code>
            <AdminButton variant="secondary" size="sm" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado!" : "Copiar"}
            </AdminButton>
          </div>
        ) : (
          <p className="text-xs italic" style={{ color: "var(--adm-accent)" }}>Nenhum token informado pelo suporte.</p>
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
              className="adm-field adm-focusable adm-mono flex-1 px-3 py-2 text-xs"
            />
            <AdminButton size="sm" onClick={handleSave} disabled={loading} className="shrink-0">
              {loading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : saved
                  ? <Check className="h-3.5 w-3.5" />
                  : null}
              {saved ? "Salvo!" : "Salvar token"}
            </AdminButton>
          </div>
          {erro && (
            <p className="text-xs" style={{ color: "var(--adm-alert)" }}>{erro}</p>
          )}
        </div>
      )}
    </div>
  );
}
