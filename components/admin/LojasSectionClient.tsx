"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Loader2, Settings } from "lucide-react";
import { toggleLojaAtiva } from "@/lib/actions/admin-lojas";

type Loja = {
  id: string;
  name: string;
  empId: number;
  isActive: boolean;
  sqlEnabled: boolean;
};

function ToggleLojaButton({ lojaId, isActive, onToggled }: {
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
      className={`text-xs px-2.5 py-1 rounded border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        ativo
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-green-200 text-green-600 hover:bg-green-50"
      }`}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : ativo ? "Desativar" : "Ativar"}
    </button>
  );
}

interface Props {
  lojas: Loja[];
  tenantId: string;
}

export function LojasSectionClient({ lojas: lojasProp, tenantId }: Props) {
  const router = useRouter();
  const [lojas, setLojas] = useState(lojasProp);
  useEffect(() => { setLojas(lojasProp); }, [lojasProp]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-600">
          {lojas.length} {lojas.length === 1 ? "loja cadastrada" : "lojas cadastradas"}
        </p>
        <Link
          href={`/admin/empresas/${tenantId}/lojas/nova`}
          className="text-sm bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-700 transition-colors"
        >
          + Adicionar Loja
        </Link>
      </div>

      {lojas.length === 0 ? (
        <div className="py-12 text-center rounded-xl border border-slate-200">
          <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">Nenhuma loja cadastrada</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Nome", "EmpId", "Status", "Bridge SQL", "Ações"].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lojas.map((loja) => (
                <tr key={loja.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{loja.name}</td>
                  <td className="px-4 py-3 text-slate-600 font-mono">{loja.empId}</td>
                  <td className="px-4 py-3">
                    {loja.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        Ativa
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                        Inativa
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {loja.sqlEnabled ? (
                      <span className="inline-flex items-center rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-medium text-cyan-700">
                        Conectada
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-600">
                        Não configurada
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ToggleLojaButton
                        lojaId={loja.id}
                        isActive={loja.isActive}
                        onToggled={() => router.refresh()}
                      />
                      <Link
                        href={`/admin/empresas/${tenantId}/lojas/${loja.id}/bridge`}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <Settings className="h-3 w-3" />
                        Bridge
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
