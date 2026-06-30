"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  AlertTriangle,
  SendHorizonal,
  Building2,
} from "lucide-react";

interface EmpresaResumo {
  empId: number;
  cnpj: string;
  razaoSocial: string;
  ativo: boolean;
  total: number;
  enviados: number;
  pendentes: number;
  erros: number;
  ultimoEnvio: string | null;
}

interface Props {
  lojaId: string;
  empresas: EmpresaResumo[];
}

interface SyncResult {
  ok: boolean;
  totalEnviados: number;
  totalErros: number;
  totalIgnorados: number;
  empresas: number;
  detalhes?: Array<{ cnpj: string; enviados: number; erros: number; detalhes: string[] }>;
  erro?: string;
}

function formatarCnpj(cnpj: string) {
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function formatarData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function SiegPortalClient({ lojaId, empresas: empresasIniciais }: Props) {
  const [empresas]       = useState<EmpresaResumo[]>(empresasIniciais);
  const [sincronizando, setSincronizando] = useState<number | "all" | null>(null);
  const [resultado, setResultado]         = useState<SyncResult | null>(null);

  async function disparar(empId?: number) {
    setSincronizando(empId ?? "all");
    setResultado(null);
    try {
      const res = await fetch("/api/sieg/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lojaId, empId }),
      });
      const data = (await res.json()) as SyncResult;
      setResultado(data);
    } catch {
      setResultado({ ok: false, totalEnviados: 0, totalErros: 1, totalIgnorados: 0, empresas: 0, erro: "Erro de rede" });
    } finally {
      setSincronizando(null);
    }
  }

  const totalPendentes = empresas.reduce((s, e) => s + e.pendentes, 0);
  const totalErros     = empresas.reduce((s, e) => s + e.erros, 0);
  const totalEnviados  = empresas.reduce((s, e) => s + e.enviados, 0);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Transmissão de XMLs
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Envio automático de NF-e para a plataforma SIEG
          </p>
        </div>
        <button
          onClick={() => disparar()}
          disabled={sincronizando !== null || empresas.every(e => !e.ativo)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "var(--accent-cyan)",
            color: "#000",
          }}
        >
          {sincronizando === "all"
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <SendHorizonal className="h-4 w-4" />
          }
          {sincronizando === "all" ? "Sincronizando..." : "Sincronizar tudo"}
        </button>
      </div>

      {/* KPIs globais */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Enviados",  valor: totalEnviados,  cor: "var(--accent-green, #22c55e)", icon: CheckCircle2 },
          { label: "Pendentes", valor: totalPendentes, cor: "var(--accent-yellow, #f59e0b)", icon: Clock },
          { label: "Com erro",  valor: totalErros,     cor: "var(--accent-red, #ef4444)",   icon: XCircle },
        ].map(({ label, valor, cor, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl p-4 flex items-center gap-3"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
          >
            <Icon style={{ width: 20, height: 20, color: cor, flexShrink: 0 }} />
            <div>
              <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{valor}</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Resultado da última sync */}
      {resultado && (
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: resultado.ok ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
            border: `1px solid ${resultado.ok ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
          }}
        >
          {resultado.ok ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Sincronização concluída
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {resultado.totalEnviados} enviados · {resultado.totalErros} erros · {resultado.totalIgnorados} ignorados
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Erro na sincronização</p>
                <p className="text-xs mt-0.5 text-red-600 font-mono">{resultado.erro}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cards por empresa */}
      {empresas.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
        >
          <Building2 className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            Nenhuma empresa configurada para transmissão SIEG.
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Peça ao administrador para configurar as credenciais em Admin → Lojas → SIEG.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {empresas.map((emp) => (
            <div
              key={emp.empId}
              className="rounded-xl p-5"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                opacity: emp.ativo ? 1 : 0.6,
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {emp.razaoSocial}
                    </p>
                    {!emp.ativo && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }}
                      >
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--text-muted)" }}>
                    {formatarCnpj(emp.cnpj)} · empId {emp.empId}
                  </p>
                </div>
                <button
                  onClick={() => disparar(emp.empId)}
                  disabled={sincronizando !== null || !emp.ativo}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-secondary)",
                    backgroundColor: "transparent",
                  }}
                >
                  {sincronizando === emp.empId
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <RefreshCw className="h-3 w-3" />
                  }
                  {sincronizando === emp.empId ? "Sincronizando..." : "Sincronizar"}
                </button>
              </div>

              {/* Métricas da empresa */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Total",     valor: emp.total,     cor: "var(--text-secondary)" },
                  { label: "Enviados",  valor: emp.enviados,  cor: "var(--accent-green, #22c55e)" },
                  { label: "Pendentes", valor: emp.pendentes, cor: "var(--accent-yellow, #f59e0b)" },
                  { label: "Erros",     valor: emp.erros,     cor: "var(--accent-red, #ef4444)" },
                ].map(({ label, valor, cor }) => (
                  <div
                    key={label}
                    className="rounded-lg p-3 text-center"
                    style={{ backgroundColor: "var(--bg-page, var(--bg-card))", border: "1px solid var(--border-subtle)" }}
                  >
                    <p className="text-lg font-bold" style={{ color: cor }}>{valor}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
                  </div>
                ))}
              </div>

              {emp.ultimoEnvio && (
                <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                  Último envio: {formatarData(emp.ultimoEnvio)}
                </p>
              )}

              {emp.erros > 0 && (
                <div
                  className="mt-3 rounded-lg px-3 py-2 flex items-center gap-2"
                  style={{ backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
                >
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#ef4444" }} />
                  <p className="text-xs" style={{ color: "#ef4444" }}>
                    {emp.erros} {emp.erros === 1 ? "nota com erro" : "notas com erro"} aguardando retentativa.
                    O sistema tentará novamente automaticamente.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
