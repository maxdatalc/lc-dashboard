"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, Loader2, CheckCircle } from "lucide-react";

interface Props {
  lojaId: string;
  nomeLoja: string;
  onLimpo?: () => void;
}

type Estado = "fechado" | "confirmando" | "carregando" | "concluido" | "erro";

interface Resultado {
  loja: string;
  executado_em: string;
  registros_deletados: Record<string, number>;
}

export function BotaoLimparDados({ lojaId, nomeLoja, onLimpo }: Props) {
  const [estado, setEstado] = useState<Estado>("fechado");
  const [confirmacao, setConfirmacao] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const fechar = () => {
    setEstado("fechado");
    setConfirmacao("");
    setResultado(null);
    setErro(null);
  };

  const executar = async () => {
    setEstado("carregando");
    setErro(null);
    try {
      const res = await fetch("/api/admin/limpar-dados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lojaId, confirmacao: "LIMPAR DADOS" }),
      });
      const data = (await res.json()) as {
        sucesso?: boolean;
        loja?: string;
        executado_em?: string;
        registros_deletados?: Record<string, number>;
        error?: string;
      };
      if (!res.ok) {
        setErro(data.error ?? "Erro desconhecido");
        setEstado("erro");
        return;
      }
      setResultado(data as Resultado);
      setEstado("concluido");
      onLimpo?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro de rede");
      setEstado("erro");
    }
  };

  const podeContinuar = confirmacao === "LIMPAR DADOS";

  return (
    <>
      <button
        onClick={() => setEstado("confirmando")}
        className="text-xs text-red-600 hover:text-red-800 font-medium transition-colors inline-flex items-center gap-1"
      >
        <Trash2 className="h-3 w-3" />
        Limpar dados
      </button>

      {estado !== "fechado" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          onClick={(e) =>
            e.target === e.currentTarget &&
            estado !== "carregando" &&
            fechar()
          }
        >
          <div
            className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {/* Confirmando / Carregando */}
            {(estado === "confirmando" || estado === "carregando") && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h3
                      className="font-semibold text-base"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Limpar dados sincronizados
                    </h3>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {nomeLoja}
                    </p>
                  </div>
                </div>

                <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                  Esta ação irá apagar{" "}
                  <strong>permanentemente</strong> todas as vendas, clientes e
                  registros de sync desta loja. Não pode ser desfeita.
                </p>

                <div className="mb-5">
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Digite{" "}
                    <code className="bg-red-50 text-red-700 px-1 rounded font-mono">
                      LIMPAR DADOS
                    </code>{" "}
                    para confirmar
                  </label>
                  <input
                    type="text"
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                    disabled={estado === "carregando"}
                    placeholder="LIMPAR DADOS"
                    autoComplete="off"
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-60"
                    style={{
                      borderColor: podeContinuar
                        ? "#ef4444"
                        : "var(--border-subtle)",
                      background: "var(--bg-card)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={fechar}
                    disabled={estado === "carregando"}
                    className="text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={executar}
                    disabled={!podeContinuar || estado === "carregando"}
                    className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {estado === "carregando" && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    {estado === "carregando" ? "Apagando..." : "Apagar tudo"}
                  </button>
                </div>
              </>
            )}

            {/* Concluído */}
            {estado === "concluido" && resultado && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3
                      className="font-semibold text-base"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Dados apagados
                    </h3>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {resultado.loja}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 mb-5">
                  {Object.entries(resultado.registros_deletados).map(
                    ([tabela, count]) => (
                      <div
                        key={tabela}
                        className="flex justify-between text-xs"
                      >
                        <span
                          className="font-mono"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {tabela}
                        </span>
                        <span
                          className="font-mono font-medium"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {count} registros
                        </span>
                      </div>
                    )
                  )}
                </div>

                <button
                  onClick={fechar}
                  className="w-full text-sm px-4 py-2 rounded-lg font-medium bg-slate-900 text-white hover:bg-slate-700 transition-colors"
                >
                  Fechar
                </button>
              </>
            )}

            {/* Erro */}
            {estado === "erro" && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <h3 className="font-semibold text-base text-red-700">
                    Erro ao apagar
                  </h3>
                </div>
                <p
                  className="text-sm mb-5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {erro}
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setEstado("confirmando");
                      setConfirmacao("");
                    }}
                    className="text-sm px-4 py-2 rounded-lg transition-colors"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Tentar novamente
                  </button>
                  <button
                    onClick={fechar}
                    className="text-sm px-4 py-2 rounded-lg font-medium bg-slate-900 text-white hover:bg-slate-700 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
