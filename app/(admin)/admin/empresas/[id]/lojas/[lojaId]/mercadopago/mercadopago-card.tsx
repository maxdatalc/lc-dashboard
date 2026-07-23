"use client";

import { CheckCircle2, Plug, XCircle } from "lucide-react";

import { AdminCard } from "@/components/admin/AdminCard";

interface DadosConexao {
  mpUserId: string | null;
  liveMode: boolean;
  conectadoEm: string | null;
}

interface Props {
  lojaId: string;
  tenantId: string;
  conectado: boolean;
  comErro: boolean;
  dados: DadosConexao | null;
  action: () => Promise<void>;
}

/** Mascara o mp_user_id, mostrando só os últimos 4 dígitos. */
function mascarar(valor: string | null): string {
  if (!valor) return "—";
  if (valor.length <= 4) return valor;
  return `${"•".repeat(valor.length - 4)}${valor.slice(-4)}`;
}

export default function MercadoPagoCard({ lojaId, tenantId, conectado, comErro, dados, action }: Props) {
  if (!conectado) {
    return (
      <AdminCard className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5" style={{ color: "var(--adm-text-faint)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
            {comErro ? "Reconexão necessária" : "Nenhuma conta conectada"}
          </p>
        </div>
        <p className="text-sm" style={{ color: "var(--adm-text-dim)" }}>
          {comErro
            ? "A renovação automática do token falhou (provavelmente a conta foi desconectada ou o acesso foi revogado no painel do Mercado Pago). Conecte novamente para retomar os pagamentos desta loja."
            : "Conecte a conta Mercado Pago do vendedor desta loja para habilitar pagamentos no storefront."}
        </p>
        <a
          href={`/api/admin/mercadopago/conectar?lojaId=${lojaId}&tenantId=${tenantId}`}
          className="adm-focusable inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150"
          style={{ background: "var(--adm-accent)", color: "#04121a", border: "1px solid transparent" }}
        >
          <Plug className="h-3.5 w-3.5" />
          Conectar com Mercado Pago
        </a>
      </AdminCard>
    );
  }

  return (
    <AdminCard className="space-y-4 p-6">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5" style={{ color: "var(--adm-signal)" }} />
        <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
          Conta conectada
        </p>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={
            dados?.liveMode
              ? { background: "var(--adm-signal-soft)", color: "var(--adm-signal)" }
              : { background: "var(--adm-warn-soft)", color: "var(--adm-warn)" }
          }
        >
          {dados?.liveMode ? "Produção" : "Sandbox"}
        </span>
      </div>

      <div className="space-y-1 rounded-lg px-4 py-3" style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-line)" }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-faint)" }}>
          ID da conta Mercado Pago
        </p>
        <p className="adm-mono text-sm" style={{ color: "var(--adm-text)" }}>
          {mascarar(dados?.mpUserId ?? null)}
        </p>
        {dados?.conectadoEm && (
          <p className="mt-1 text-xs" style={{ color: "var(--adm-text-faint)" }}>
            Conectado em {new Date(dados.conectadoEm).toLocaleString("pt-BR")}
          </p>
        )}
      </div>

      <form
        action={action}
        onSubmit={(e) => {
          if (!window.confirm("Desconectar a conta Mercado Pago desta loja? Pagamentos ficarão indisponíveis até reconectar.")) {
            e.preventDefault();
          }
        }}
        className="flex justify-end pt-2"
        style={{ borderTop: "1px solid var(--adm-line)" }}
      >
        <button
          type="submit"
          className="adm-focusable inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm transition-all"
          style={{ background: "var(--adm-alert-soft)", color: "var(--adm-alert)", border: "1px solid transparent" }}
        >
          <XCircle className="h-3.5 w-3.5" />
          Desconectar
        </button>
      </form>
    </AdminCard>
  );
}
