"use client";

// Botão de exclusão permanente de cliente — exibe confirmação antes de agir

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  tenantId: string;
  tenantName: string;
}

export function BotaoExcluirCliente({ tenantId, tenantName }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleExcluir() {
    const confirmado = window.confirm(
      `Excluir ${tenantName}?\n\nIsso removerá permanentemente todas as lojas, dados sincronizados e acessos de usuários. Esta ação não pode ser desfeita.`
    );

    if (!confirmado) return;

    setLoading(true);
    setErro(null);

    try {
      const res = await fetch(`/api/admin/deletar-cliente?tenantId=${tenantId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // router.refresh() invalida o Router Cache antes de navegar para a lista
        router.refresh();
        router.push("/admin/clientes");
        return;
      }

      const data = (await res.json()) as { error?: string };
      setErro(data.error ?? "Erro ao excluir cliente");
    } catch {
      setErro("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExcluir}
        disabled={loading}
        className="adm-focusable h-auto px-1.5 py-1"
        style={{ color: "var(--adm-alert)" }}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>
      {erro && <span className="text-xs" style={{ color: "var(--adm-alert)" }}>{erro}</span>}
    </div>
  );
}
