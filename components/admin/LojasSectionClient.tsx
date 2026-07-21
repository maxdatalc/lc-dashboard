"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Settings, Zap, Pencil, X, RefreshCw, Scale } from "lucide-react";
import { toggleLojaAtiva } from "@/lib/actions/admin-lojas";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminBadge, AdminStatusDot } from "@/components/admin/AdminBadge";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import {
  AdminTable,
  AdminTableHead,
  AdminTh,
  AdminTBody,
  AdminTr,
  AdminTd,
} from "@/components/admin/AdminTable";

type Loja = {
  id: string;
  name: string;
  empId: number;
  isActive: boolean;
  sqlEnabled: boolean;
  cnpj?: string | null;
};

function ToggleLojaButton({
  lojaId,
  isActive,
  onToggled,
}: {
  lojaId: string;
  isActive: boolean;
  onToggled: () => void;
}) {
  const [ativo, setAtivo] = useState(isActive);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    const novoEstado = !ativo;
    setAtivo(novoEstado);
    try {
      await toggleLojaAtiva(lojaId, novoEstado);
      onToggled();
    } catch {
      setAtivo(!novoEstado);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      title={ativo ? "Desativar loja" : "Ativar loja"}
      className="adm-focusable shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        border: "1px solid",
        borderColor: ativo ? "var(--adm-alert-soft)" : "var(--adm-signal-soft)",
        color: ativo ? "var(--adm-alert)" : "var(--adm-signal)",
      }}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : ativo ? "Desativar" : "Ativar"}
    </button>
  );
}

function EditLojaRow({
  loja,
  onClose,
  onSaved,
}: {
  loja: Loja;
  onClose: () => void;
  onSaved: (nome: string, cnpj: string) => void;
}) {
  const [nome, setNome] = useState(loja.name);
  const [cnpj, setCnpj] = useState(loja.cnpj ?? "");
  const [loading, setLoading] = useState(false);
  const [loadingBridge, setLoadingBridge] = useState(false);
  const [loadingNomeBridge, setLoadingNomeBridge] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleBuscarNome() {
    setLoadingNomeBridge(true);
    setErro(null);
    try {
      const res = await fetch(`/api/admin/lojas/${loja.id}/nome-bridge`);
      const data = (await res.json()) as { nome?: string; error?: string };
      if (!res.ok) { setErro(data.error ?? "Erro ao buscar nome"); return; }
      if (data.nome) setNome(data.nome);
    } catch {
      setErro("Erro de rede ao buscar nome");
    } finally {
      setLoadingNomeBridge(false);
    }
  }

  async function handleBuscarCnpj() {
    setLoadingBridge(true);
    setErro(null);
    try {
      const res = await fetch(`/api/admin/lojas/${loja.id}/cnpj-bridge`);
      const data = (await res.json()) as { cnpj?: string; error?: string };
      if (!res.ok) { setErro(data.error ?? "Erro ao buscar CNPJ"); return; }
      if (data.cnpj) setCnpj(data.cnpj);
    } catch {
      setErro("Erro de rede ao buscar CNPJ");
    } finally {
      setLoadingBridge(false);
    }
  }

  async function handleSave() {
    if (!nome.trim()) { setErro("Nome é obrigatório"); return; }
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/admin/lojas/${loja.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nome.trim(), cnpj: cnpj.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setErro(data.error ?? "Erro ao salvar"); return; }
      onSaved(nome.trim(), cnpj.trim());
    } catch {
      setErro("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  return (
    <td colSpan={5} className="px-5 py-3" style={{ background: "var(--adm-surface-2)" }}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-36 flex-1">
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>Nome</label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoFocus
              className="adm-field adm-focusable flex-1 px-3 py-1.5 text-sm"
            />
            {loja.sqlEnabled && (
              <AdminButton type="button" variant="secondary" size="sm" onClick={handleBuscarNome} disabled={loadingNomeBridge} title="Buscar nome via Bridge SQL (MaxManager)">
                {loadingNomeBridge ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                {loadingNomeBridge ? "Buscando..." : "Bridge"}
              </AdminButton>
            )}
          </div>
        </div>
        <div className="min-w-36 flex-1">
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-dim)" }}>CNPJ</label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
              className="adm-field adm-focusable flex-1 px-3 py-1.5 text-sm"
            />
            {loja.sqlEnabled && (
              <AdminButton type="button" variant="secondary" size="sm" onClick={handleBuscarCnpj} disabled={loadingBridge} title="Buscar CNPJ via Bridge SQL">
                {loadingBridge ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                {loadingBridge ? "Buscando..." : "Bridge"}
              </AdminButton>
            )}
          </div>
        </div>
        <div className="flex gap-2 pb-0.5">
          {erro && <p className="self-center text-xs" style={{ color: "var(--adm-alert)" }}>{erro}</p>}
          <AdminButton onClick={handleSave} disabled={loading} size="sm">
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            Salvar
          </AdminButton>
          <AdminButton variant="subtle" size="sm" onClick={onClose} disabled={loading}>
            <X className="h-3 w-3" />
            Cancelar
          </AdminButton>
        </div>
      </div>
    </td>
  );
}

interface Props {
  lojas: Loja[];
  tenantId: string;
}

export function LojasSectionClient({ lojas: lojasProp, tenantId }: Props) {
  const router = useRouter();
  const [lojas, setLojas] = useState(lojasProp);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setLojas(lojasProp);
  }, [lojasProp]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--adm-text-dim)" }}>
          {lojas.length} {lojas.length === 1 ? "loja cadastrada" : "lojas cadastradas"}
        </p>
        <AdminButton href={`/admin/empresas/${tenantId}/lojas/nova`} size="sm">
          + Adicionar loja
        </AdminButton>
      </div>

      {lojas.length === 0 ? (
        <AdminCard>
          <AdminEmptyState
            icon={Building2}
            title="Nenhuma loja cadastrada"
            description="Adicione a primeira loja para liberar o dashboard do cliente."
            action={
              <AdminButton href={`/admin/empresas/${tenantId}/lojas/nova`} variant="secondary" size="sm">
                + Adicionar loja
              </AdminButton>
            }
          />
        </AdminCard>
      ) : (
        <AdminTable>
          <AdminTableHead>
            <AdminTh>Loja</AdminTh>
            <AdminTh>CNPJ</AdminTh>
            <AdminTh>EmpId</AdminTh>
            <AdminTh>Bridge</AdminTh>
            <AdminTh />
          </AdminTableHead>
          <AdminTBody>
            {lojas.map((loja, i) =>
              editingId === loja.id ? (
                <tr key={loja.id} style={{ animation: "fadeInUp 0.2s ease-out both" }}>
                  <EditLojaRow
                    loja={loja}
                    onClose={() => setEditingId(null)}
                    onSaved={(nome, cnpj) => {
                      setLojas((prev) =>
                        prev.map((l) => l.id === loja.id ? { ...l, name: nome, cnpj } : l)
                      );
                      setEditingId(null);
                      router.refresh();
                    }}
                  />
                </tr>
              ) : (
                <AdminTr key={loja.id} noBorder={i === 0}>
                  {/* Loja */}
                  <AdminTd>
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold">{loja.name}</span>
                    </div>
                    <div className="mt-0.5">
                      <AdminStatusDot active={loja.isActive} />
                    </div>
                  </AdminTd>

                  {/* CNPJ */}
                  <AdminTd className="adm-mono text-xs" style={{ color: "var(--adm-text-dim)" }}>
                    {loja.cnpj || <span style={{ color: "var(--adm-text-faint)" }}>—</span>}
                  </AdminTd>

                  {/* EmpId */}
                  <AdminTd className="text-xs" style={{ color: "var(--adm-text-faint)" }}>
                    {loja.empId}
                  </AdminTd>

                  {/* Bridge */}
                  <AdminTd>
                    {loja.sqlEnabled ? (
                      <AdminBadge variant="success" dot>Conectada</AdminBadge>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--adm-text-faint)" }}>Não config.</span>
                    )}
                  </AdminTd>

                  {/* Ações */}
                  <AdminTd align="right">
                    <div className="flex items-center justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <AdminButton href={`/admin/empresas/${tenantId}/lojas/${loja.id}/bridge`} variant="subtle" size="sm">
                        <Settings className="h-3 w-3" />
                        Bridge
                      </AdminButton>
                      <AdminButton href={`/admin/empresas/${tenantId}/lojas/${loja.id}/maxapi`} variant="subtle" size="sm">
                        <Zap className="h-3 w-3" />
                        MaxAPI
                      </AdminButton>
                      <AdminButton href={`/admin/empresas/${tenantId}/lojas/${loja.id}/sieg`} variant="subtle" size="sm">
                        <Scale className="h-3 w-3" />
                        SIEG
                      </AdminButton>
                      <AdminButton variant="subtle" size="sm" onClick={() => setEditingId(loja.id)} title="Editar nome e CNPJ">
                        <Pencil className="h-3.5 w-3.5" />
                      </AdminButton>
                      <ToggleLojaButton
                        lojaId={loja.id}
                        isActive={loja.isActive}
                        onToggled={() => router.refresh()}
                      />
                    </div>
                  </AdminTd>
                </AdminTr>
              )
            )}
          </AdminTBody>
        </AdminTable>
      )}
    </div>
  );
}
