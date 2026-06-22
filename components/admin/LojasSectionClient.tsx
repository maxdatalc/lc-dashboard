"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Check, Loader2, Settings, Zap, Pencil, X } from "lucide-react";
import { toggleLojaAtiva } from "@/lib/actions/admin-lojas";

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
      className={`shrink-0 text-xs px-2.5 py-1 rounded-md border font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
        ativo
          ? "border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200"
          : "border-emerald-100 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200"
      }`}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : ativo ? "Desativar" : "Ativar"}
    </button>
  );
}

function EditLojaPanel({
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
  const [erro, setErro] = useState<string | null>(null);

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
    <div className="space-y-3 p-1">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Nome</label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoFocus
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 bg-white"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">CNPJ</label>
        <input
          type="text"
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
          placeholder="00.000.000/0000-00"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 bg-white"
        />
      </div>
      {erro && <p className="text-xs text-red-500">{erro}</p>}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          Salvar
        </button>
        <button
          onClick={onClose}
          disabled={loading}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <X className="h-3 w-3" />
          Cancelar
        </button>
      </div>
    </div>
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
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          {lojas.length} {lojas.length === 1 ? "loja cadastrada" : "lojas cadastradas"}
        </p>
        <Link
          href={`/admin/empresas/${tenantId}/lojas/nova`}
          className="text-sm bg-slate-900 text-white px-3.5 py-1.5 rounded-lg font-medium hover:bg-slate-700 hover:shadow-md transition-all hover:-translate-y-px"
        >
          + Adicionar loja
        </Link>
      </div>

      {lojas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-14 text-center">
          <Building2 className="h-9 w-9 text-slate-200 mx-auto mb-3" />
          <p className="font-medium text-slate-600 text-sm">Nenhuma loja cadastrada</p>
          <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto">
            Adicione a primeira loja para liberar o dashboard do cliente.
          </p>
          <Link
            href={`/admin/empresas/${tenantId}/lojas/nova`}
            className="inline-block mt-4 text-xs font-medium text-slate-700 border border-slate-200 px-3.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
          >
            + Adicionar loja
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {lojas.map((loja, i) => (
            <div
              key={loja.id}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 hover:shadow-sm transition-all duration-200"
              style={{ animation: "fadeInUp 0.3s ease-out both", animationDelay: `${i * 70}ms` }}
            >
              {editingId === loja.id ? (
                <EditLojaPanel
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
              ) : (
                <>
                  {/* Card header: nome + toggle */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${loja.isActive ? "bg-emerald-400" : "bg-slate-300"}`} />
                        <h3 className="font-semibold text-slate-900 text-sm leading-tight truncate">
                          {loja.name}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5 pl-4">EmpId {loja.empId}</p>
                      {loja.cnpj && (
                        <p className="text-xs text-slate-400 mt-0.5 pl-4">CNPJ: {loja.cnpj}</p>
                      )}
                    </div>
                    <ToggleLojaButton
                      lojaId={loja.id}
                      isActive={loja.isActive}
                      onToggled={() => router.refresh()}
                    />
                  </div>

                  {/* Status de integração */}
                  <div className="border-t border-slate-50 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 flex items-center gap-1.5">
                        <Settings className="h-3 w-3" />
                        Bridge SQL
                      </span>
                      {loja.sqlEnabled ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <Check className="h-3.5 w-3.5" />
                          Conectada
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Não configurada</span>
                      )}
                    </div>
                  </div>

                  {/* Links de configuração */}
                  <div className="border-t border-slate-50 pt-3 flex gap-2">
                    <Link
                      href={`/admin/empresas/${tenantId}/lojas/${loja.id}/bridge`}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Bridge
                    </Link>
                    <Link
                      href={`/admin/empresas/${tenantId}/lojas/${loja.id}/maxapi`}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      MaxAPI
                    </Link>
                    <button
                      onClick={() => setEditingId(loja.id)}
                      className="flex items-center justify-center gap-1 text-xs font-medium py-1.5 px-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
                      title="Editar nome e CNPJ"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
