"use client";

// Modal de sincronização inicial — abre e inicia automaticamente ao montar.
// Processa 13 meses sequencialmente com retry automático 1x por mês.

import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";

const TOTAL_MESES = 13;

// Calcula os últimos N meses a partir do atual (inclusive)
function calcularUltimosMeses(n: number): string[] {
  const hoje = new Date();
  const meses: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return meses;
}

// Formata '2024-04' → 'Abr/2024'
function formatarMes(mes: string): string {
  const [ano, m] = mes.split("-");
  const nomes = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return `${nomes[parseInt(m) - 1]}/${ano}`;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface SyncStatusDB {
  status: "pendente" | "em_andamento" | "concluido" | "erro";
  chunk_atual: number;
  mes_atual: string | null;
  vendas_salvas: number;
}

interface SyncResponse {
  mes_processado?: string;
  vendas_salvas?: number;
  proximo_mes?: string | null;
  concluido?: boolean;
  error?: string;
}

export interface Props {
  lojaId: string;
  nomeLoja: string;
  onConcluido: () => void;
}

export function SyncInicialModal({ lojaId, nomeLoja, onConcluido }: Props) {
  // Refs estáveis para evitar re-runs do useEffect
  const lojaIdRef = useRef(lojaId);
  const onConcluidoRef = useRef(onConcluido);
  onConcluidoRef.current = onConcluido;

  // allMeses é calculado uma vez no mount (não muda durante a sessão)
  const allMeses = useRef(calcularUltimosMeses(TOTAL_MESES)).current;

  const [mesAtual, setMesAtual] = useState<string | null>(null);
  const [mesesConcluidos, setMesesConcluidos] = useState<string[]>([]);
  const [vendasSalvas, setVendasSalvas] = useState(0);
  const [status, setStatus] = useState<"idle" | "rodando" | "concluido" | "erro">("idle");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const lojaId = lojaIdRef.current;

    const iniciarSync = async () => {
      setStatus("rodando");
      setErro(null);

      // 1. Verificar progresso salvo para retomar
      let startIdx = 0;
      let vendasBase = 0;

      try {
        const statusRes = await fetch(
          `/api/admin/sync-inicial?lojaId=${lojaId}`
        );
        const statusAtual = (await statusRes.json()) as SyncStatusDB;

        if (statusAtual?.status === "concluido") {
          // Já estava concluído — mostrar como tal
          setMesesConcluidos(allMeses);
          setVendasSalvas(statusAtual.vendas_salvas ?? 0);
          setStatus("concluido");
          onConcluidoRef.current();
          return;
        }

        if (statusAtual?.mes_atual && statusAtual.status === "em_andamento") {
          const idx = allMeses.indexOf(statusAtual.mes_atual);
          if (idx > 0) {
            startIdx = idx;
            setMesesConcluidos(allMeses.slice(0, idx));
            vendasBase = statusAtual.vendas_salvas ?? 0;
            setVendasSalvas(vendasBase);
          }
        }
      } catch {
        // Status do DB é opcional — começa do início se falhar
      }

      const mesesParaProcessar = allMeses.slice(startIdx);
      let vendaAcumulada = vendasBase;

      // 2. Processar mês a mês sequencialmente
      for (let i = 0; i < mesesParaProcessar.length; i++) {
        const mes = mesesParaProcessar[i];
        setMesAtual(mes);

        let sucesso = false;

        for (let tentativa = 0; tentativa < 2; tentativa++) {
          if (tentativa > 0) {
            setErro(`Erro em ${formatarMes(mes)}. Tentando novamente...`);
            await sleep(2000);
            setErro(null);
          }

          try {
            const chunkAtual = startIdx + i + 1;
            const res = await fetch("/api/admin/sync-inicial", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                lojaId,
                mes,
                chunkAtual,
                totalChunks: TOTAL_MESES,
              }),
            });

            const data = (await res.json()) as SyncResponse;

            if (!res.ok || data.error) {
              throw new Error(data.error ?? "Erro ao processar mês");
            }

            vendaAcumulada += data.vendas_salvas ?? 0;
            setVendasSalvas(vendaAcumulada);
            setMesesConcluidos((prev) => [...prev, mes]);
            sucesso = true;

            if (data.concluido) {
              setMesAtual(null);
              setStatus("concluido");
              onConcluidoRef.current();
              return;
            }
            break; // sai do loop de tentativas
          } catch (err) {
            if (tentativa >= 1) {
              // 2ª tentativa também falhou
              const msg = err instanceof Error ? err.message : "Erro desconhecido";
              setErro(msg);
              setStatus("erro");
              setMesAtual(null);
              return;
            }
          }
        }

        if (!sucesso) return; // não deve acontecer, mas sai por segurança
      }

      setMesAtual(null);
      setStatus("concluido");
      onConcluidoRef.current();
    };

    iniciarSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // roda somente uma vez ao montar

  const pct = mesesConcluidos.length / TOTAL_MESES;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Fundo escuro */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Card */}
      <div
        className="relative rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {/* Cabeçalho */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-center gap-3">
            {status === "concluido" ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            ) : status === "erro" ? (
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            ) : (
              <Loader2
                className="h-5 w-5 animate-spin shrink-0"
                style={{ color: "var(--accent-cyan)" }}
              />
            )}
            <div>
              <h2
                className="font-semibold text-sm"
                style={{ color: "var(--text-primary)" }}
              >
                Sincronização Inicial
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {nomeLoja}
              </p>
            </div>
          </div>

          {/* X visível apenas quando concluído ou com erro */}
          {(status === "concluido" || status === "erro") && (
            <button
              onClick={onConcluidoRef.current}
              className="p-1 rounded transition-colors hover:opacity-70"
              style={{ color: "var(--text-muted)" }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Corpo */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Subtítulo antes de começar */}
          {status === "rodando" && mesesConcluidos.length === 0 && !mesAtual && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Buscando dados dos últimos {TOTAL_MESES} meses do ERP...
            </p>
          )}

          {/* Barra de progresso */}
          <div className="space-y-1.5">
            <div
              className="flex justify-between text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              <span>
                {mesesConcluidos.length}/{TOTAL_MESES} meses processados
              </span>
              <span className="font-medium">{Math.round(pct * 100)}%</span>
            </div>
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{ background: "var(--border-subtle)" }}
            >
              <div
                className="h-2 rounded-full transition-all duration-700"
                style={{
                  width: `${pct * 100}%`,
                  background:
                    "linear-gradient(to right, var(--accent-cyan), var(--accent-cyan))",
                }}
              />
            </div>
          </div>

          {/* Grid de meses — 2 colunas */}
          <div className="grid grid-cols-2 gap-1.5">
            {allMeses.map((mes) => {
              const concluido = mesesConcluidos.includes(mes);
              const atual = mesAtual === mes;
              return (
                <div
                  key={mes}
                  className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                  style={{
                    background: concluido
                      ? "rgba(5,150,105,0.08)"
                      : atual
                      ? "rgba(8,145,178,0.08)"
                      : "transparent",
                    color: concluido
                      ? "var(--accent-green)"
                      : atual
                      ? "var(--accent-cyan)"
                      : "var(--text-muted)",
                  }}
                >
                  {concluido ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent-green)" }} />
                  ) : atual ? (
                    <Loader2
                      className="h-3.5 w-3.5 shrink-0 animate-spin"
                      style={{ color: "var(--accent-cyan)" }}
                    />
                  ) : (
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border flex-shrink-0"
                      style={{ borderColor: "var(--border-subtle)" }}
                    />
                  )}
                  {formatarMes(mes)}
                </div>
              );
            })}
          </div>

          {/* Contador de vendas */}
          {vendasSalvas > 0 && (
            <p
              className="text-sm text-center"
              style={{ color: "var(--text-muted)" }}
            >
              <strong style={{ color: "var(--text-primary)" }}>
                {vendasSalvas.toLocaleString("pt-BR")}
              </strong>{" "}
              vendas salvas até agora
            </p>
          )}

          {/* Aviso de não fechar */}
          {status === "rodando" && (
            <div
              className="flex items-center gap-2 rounded-lg px-4 py-3 text-xs font-medium"
              style={{
                background: "rgba(217,119,6,0.1)",
                color: "var(--accent-yellow)",
              }}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              Não feche esta janela durante o processo
            </div>
          )}

          {/* Erro */}
          {erro && (
            <div
              className="flex items-start gap-2 rounded-lg px-4 py-3 text-xs"
              style={{
                background: "rgba(220,38,38,0.08)",
                color: "var(--accent-red)",
              }}
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          {/* Concluído */}
          {status === "concluido" && (
            <div className="text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
              <p className="font-semibold" style={{ color: "var(--accent-green)" }}>
                Sincronização concluída!
              </p>
            </div>
          )}
        </div>

        {/* Rodapé — botão Fechar só quando terminou */}
        {(status === "concluido" || status === "erro") && (
          <div
            className="px-6 py-4 flex justify-end"
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          >
            <button
              onClick={onConcluidoRef.current}
              className="text-sm bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
