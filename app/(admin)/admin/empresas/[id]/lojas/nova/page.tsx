"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, Loader2, AlertCircle, Building2, RefreshCw, CheckCircle2, ChevronDown } from "lucide-react";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminButton } from "@/components/admin/AdminButton";

interface EmpresaBridge {
  empId: number;
  razao: string;
  fantasia: string;
}

interface BridgePayload {
  success: boolean;
  empresas?: EmpresaBridge[];
  disponiveis?: EmpresaBridge[];
  bridgeUrl?: string | null;
  lojaOrigem?: string | null;
  error?: string;
}

export default function NovaLojaPage() {
  const router = useRouter();
  const { id: tenantId } = useParams<{ id: string }>();

  const [nome, setNome] = useState("");
  const [empId, setEmpId] = useState("");

  // Bridge SQL
  const [sqlEnabled, setSqlEnabled] = useState(false);
  const [bridgeUrl, setBridgeUrl] = useState("");
  const [bridgeToken, setBridgeToken] = useState("");
  const [verToken, setVerToken] = useState(false);
  const [usarOutraBridge, setUsarOutraBridge] = useState(false);

  // Estado de submissão
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Empresas da bridge
  const [todasEmpresas, setTodasEmpresas] = useState<EmpresaBridge[]>([]);
  const [disponiveisEmpresas, setDisponiveisEmpresas] = useState<EmpresaBridge[]>([]);
  const [bridgeUrlDetectada, setBridgeUrlDetectada] = useState<string | null>(null);
  const [lojaOrigem, setLojaOrigem] = useState<string | null>(null);
  const [buscandoEmpresas, setBuscandoEmpresas] = useState(false);
  const [erroEmpresas, setErroEmpresas] = useState<string | null>(null);
  const [autoDetectado, setAutoDetectado] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-detecção ao abrir: busca bridge já cadastrada no tenant
  useEffect(() => {
    async function detectarBridge() {
      setBuscandoEmpresas(true);
      try {
        const res = await fetch(`/api/admin/listar-empresas-bridge?tenantId=${tenantId}`);
        const data: BridgePayload = await res.json();
        if (data.success && data.empresas?.length) {
          setTodasEmpresas(data.empresas);
          setDisponiveisEmpresas(data.disponiveis ?? data.empresas);
          setBridgeUrlDetectada(data.bridgeUrl ?? null);
          setLojaOrigem(data.lojaOrigem ?? null);
          setAutoDetectado(true);
          setSqlEnabled(true);
          // Auto-seleciona se só houver 1 disponível
          if ((data.disponiveis ?? data.empresas).length === 1) {
            const e = (data.disponiveis ?? data.empresas)[0];
            setEmpId(String(e.empId));
            if (!nome) setNome(e.fantasia || e.razao);
          }
        }
      } catch {
        // silencioso — usuário preenche manualmente
      } finally {
        setBuscandoEmpresas(false);
      }
    }
    detectarBridge();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // Busca manual ao preencher url + token (bridge nova)
  useEffect(() => {
    if (!usarOutraBridge || !sqlEnabled || !bridgeUrl || !bridgeToken) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarEmpresasManual(), 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usarOutraBridge, bridgeUrl, bridgeToken]);

  async function buscarEmpresasManual() {
    if (!bridgeUrl || !bridgeToken) return;
    setBuscandoEmpresas(true);
    setErroEmpresas(null);
    setTodasEmpresas([]);
    setDisponiveisEmpresas([]);
    try {
      const res = await fetch("/api/admin/listar-empresas-bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bridgeUrl, token: bridgeToken }),
      });
      const data: BridgePayload = await res.json();
      if (!data.success) { setErroEmpresas(data.error ?? "Erro ao consultar bridge."); return; }
      setTodasEmpresas(data.empresas ?? []);
      setDisponiveisEmpresas(data.disponiveis ?? data.empresas ?? []);
      if ((data.empresas ?? []).length === 1) {
        const e = data.empresas![0];
        setEmpId(String(e.empId));
        if (!nome) setNome(e.fantasia || e.razao);
      }
    } catch { setErroEmpresas("Erro de rede ao consultar bridge."); }
    finally { setBuscandoEmpresas(false); }
  }

  function selecionarEmpresa(e: EmpresaBridge) {
    setEmpId(String(e.empId));
    if (!nome) setNome(e.fantasia || e.razao);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!nome || !empId) { setErro("Nome e EmpId são obrigatórios."); return; }
    if (sqlEnabled && !autoDetectado && (!bridgeUrl || !bridgeToken)) {
      setErro("Informe URL e token da bridge para habilitar a conexão SQL.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/adicionar-loja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          name: nome,
          empId: Number(empId),
          sqlEnabled,
          sqlBridgeUrl: sqlEnabled ? (usarOutraBridge ? bridgeUrl : bridgeUrlDetectada) ?? bridgeUrl : undefined,
          sqlBridgeToken: sqlEnabled && usarOutraBridge ? bridgeToken : undefined,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) { setErro(data.error ?? "Erro ao adicionar loja."); return; }
      router.push(`/admin/empresas/${tenantId}?aba=lojas`);
    } catch { setErro("Erro de rede. Tente novamente."); }
    finally { setLoading(false); }
  }

  const empresaSelecionada = todasEmpresas.find((e) => String(e.empId) === empId);
  const listaExibida = disponiveisEmpresas.length ? disponiveisEmpresas : todasEmpresas;

  return (
    <div className="adm-rise mx-auto max-w-2xl space-y-6 p-6">
      <div className="space-y-2">
        <Link
          href={`/admin/empresas/${tenantId}?aba=lojas`}
          className="adm-focusable inline-flex items-center gap-1.5 rounded text-xs font-medium transition-colors"
          style={{ color: "var(--adm-text-faint)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para lojas
        </Link>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--adm-text)" }}>Adicionar Loja</h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--adm-text-dim)" }}>
            Configure a nova loja e a conexão com o banco.
          </p>
        </div>
      </div>

      {erro && (
        <div
          className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--adm-alert-soft)", border: "1px solid var(--adm-alert)", color: "var(--adm-alert)" }}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {erro}
        </div>
      )}

      <form onSubmit={handleSubmit}>
      <AdminCard className="space-y-5 p-6">

        {/* ── Banner de auto-detecção ────────────────────────────────── */}
        {buscandoEmpresas && !autoDetectado && (
          <div
            className="flex items-center gap-2 rounded-lg px-4 py-3 text-xs"
            style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-line)", color: "var(--adm-text-dim)" }}
          >
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            Verificando se há uma bridge já configurada nesta empresa...
          </div>
        )}

        {autoDetectado && !usarOutraBridge && (
          <div
            className="space-y-1 rounded-lg px-4 py-3"
            style={{ background: "var(--adm-signal-soft)", border: "1px solid var(--adm-signal)" }}
          >
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--adm-signal)" }}>
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Bridge detectada automaticamente via &quot;{lojaOrigem}&quot;
            </div>
            <p className="adm-mono truncate pl-6 text-xs" style={{ color: "var(--adm-signal)" }}>{bridgeUrlDetectada}</p>
            <div className="flex items-center gap-1 pl-6 pt-0.5">
              <span className="text-xs font-medium" style={{ color: "var(--adm-signal)" }}>
                {todasEmpresas.length} empresa{todasEmpresas.length !== 1 ? "s" : ""} encontrada{todasEmpresas.length !== 1 ? "s" : ""} no banco
              </span>
              {disponiveisEmpresas.length < todasEmpresas.length && (
                <span className="text-xs" style={{ color: "var(--adm-signal)" }}>
                  ({todasEmpresas.length - disponiveisEmpresas.length} já cadastrada{todasEmpresas.length - disponiveisEmpresas.length !== 1 ? "s" : ""})
                </span>
              )}
              <button
                type="button"
                onClick={() => { setUsarOutraBridge(true); setSqlEnabled(true); }}
                className="adm-focusable ml-auto flex items-center gap-1 rounded text-xs transition-colors"
                style={{ color: "var(--adm-text-faint)" }}
              >
                Usar outra bridge
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* ── Bridge manual (nova ou override) ──────────────────────── */}
        {(!autoDetectado || usarOutraBridge) && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="sql-enabled"
                checked={sqlEnabled}
                onChange={(e) => setSqlEnabled(e.target.checked)}
                className="adm-focusable mt-0.5 rounded"
                style={{ accentColor: "var(--adm-accent)" }}
              />
              <label htmlFor="sql-enabled" className="cursor-pointer">
                <p className="text-sm font-medium" style={{ color: "var(--adm-text)" }}>Habilitar Dashboard SQL (lc-sql-bridge)</p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>
                  Conecta ao SQL Server desta loja via bridge instalada na máquina do cliente.
                </p>
              </label>
            </div>

            {sqlEnabled && (
              <div className="space-y-4 border-l-2 pl-6" style={{ borderColor: "var(--adm-line-strong)" }}>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
                    URL da Bridge <span style={{ color: "var(--adm-alert)" }}>*</span>
                  </label>
                  <input
                    type="url"
                    value={bridgeUrl}
                    onChange={(e) => setBridgeUrl(e.target.value)}
                    placeholder="https://sql-cliente.lctecnologias.com.br"
                    className="adm-field adm-focusable w-full px-3.5 py-2.5 text-sm"
                  />
                  <p className="mt-1 text-xs" style={{ color: "var(--adm-text-faint)" }}>
                    Cloudflare Tunnel apontando para porta 3055 da bridge.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
                    Token de segurança <span style={{ color: "var(--adm-alert)" }}>*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={verToken ? "text" : "password"}
                      value={bridgeToken}
                      onChange={(e) => setBridgeToken(e.target.value)}
                      placeholder="Token gerado pelo instalar-bridge.ps1"
                      className="adm-field adm-focusable adm-mono w-full px-3.5 py-2.5 pr-10 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setVerToken((v) => !v)}
                      className="adm-focusable absolute right-2.5 top-1/2 -translate-y-1/2 rounded"
                      style={{ color: "var(--adm-text-faint)" }}
                    >
                      {verToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>Armazenado criptografado (AES-256-GCM).</p>
                </div>

                {buscandoEmpresas && (
                  <div className="flex items-center gap-2 py-1 text-xs" style={{ color: "var(--adm-text-dim)" }}>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Consultando empresas no banco...
                  </div>
                )}

                {erroEmpresas && (
                  <div
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-xs"
                    style={{ background: "var(--adm-warn-soft)", border: "1px solid var(--adm-warn)", color: "var(--adm-warn)" }}
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {erroEmpresas}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Lista de empresas ─────────────────────────────────────── */}
        {listaExibida.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
                <Building2 className="h-3.5 w-3.5" />
                {disponiveisEmpresas.length < todasEmpresas.length
                  ? `Empresas disponíveis (${listaExibida.length} de ${todasEmpresas.length})`
                  : `Empresas encontradas no banco (${listaExibida.length})`}
              </p>
              {usarOutraBridge && (
                <button
                  type="button"
                  onClick={buscarEmpresasManual}
                  className="adm-focusable flex items-center gap-1 rounded text-xs"
                  style={{ color: "var(--adm-text-faint)" }}
                >
                  <RefreshCw className="h-3 w-3" />
                  Atualizar
                </button>
              )}
            </div>
            <div className="overflow-hidden rounded-lg" style={{ border: "1px solid var(--adm-line)" }}>
              {listaExibida.map((emp, i) => {
                const selected = String(emp.empId) === empId;
                return (
                  <button
                    key={emp.empId}
                    type="button"
                    onClick={() => selecionarEmpresa(emp)}
                    className="adm-row flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid var(--adm-line)",
                      borderLeft: selected ? "2px solid var(--adm-accent)" : "2px solid transparent",
                      background: selected ? "var(--adm-accent-soft)" : "transparent",
                    }}
                  >
                    <span
                      className="adm-mono min-w-[28px] rounded px-1 py-0.5 text-center text-xs font-semibold"
                      style={{
                        background: selected ? "var(--adm-accent)" : "var(--adm-surface-2)",
                        color: selected ? "#04121a" : "var(--adm-text-dim)",
                      }}
                    >
                      {emp.empId}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm"
                        style={{ color: "var(--adm-text)", fontWeight: selected ? 600 : 500 }}
                      >
                        {emp.fantasia || emp.razao}
                      </p>
                      {emp.fantasia && emp.razao !== emp.fantasia && (
                        <p className="truncate text-xs" style={{ color: "var(--adm-text-faint)" }}>{emp.razao}</p>
                      )}
                    </div>
                    {selected && (
                      <span className="shrink-0 text-xs font-medium" style={{ color: "var(--adm-accent)" }}>✓ Selecionada</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <hr style={{ borderColor: "var(--adm-line)" }} />

        {/* ── Nome e EmpId ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
              Nome da Loja <span style={{ color: "var(--adm-alert)" }}>*</span>
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              placeholder="Ex: Comercial Aliança — Centro"
              className="adm-field adm-focusable w-full px-3.5 py-2.5 text-sm"
            />
            {empresaSelecionada && (
              <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>Pré-preenchido da empresa selecionada. Edite se quiser.</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>
              EmpId <span style={{ color: "var(--adm-alert)" }}>*</span>
            </label>
            <input
              type="number"
              min={1}
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              required
              placeholder={listaExibida.length ? "Selecione acima ou digite" : "Ex: 2"}
              className="adm-field adm-focusable w-full px-3.5 py-2.5 text-sm"
            />
            <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-faint)" }}>
              {listaExibida.length ? "Preenchido ao selecionar a empresa acima." : "ID da empresa no MaxManager"}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2" style={{ borderTop: "1px solid var(--adm-line)" }}>
          <Link
            href={`/admin/empresas/${tenantId}?aba=lojas`}
            className="adm-focusable rounded px-4 py-2 text-sm transition-colors"
            style={{ color: "var(--adm-text-dim)" }}
          >
            Cancelar
          </Link>
          <AdminButton type="submit" disabled={loading}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading ? "Salvando..." : "Adicionar Loja"}
          </AdminButton>
        </div>
      </AdminCard>
      </form>
    </div>
  );
}
