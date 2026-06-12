"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Copy, Check } from "lucide-react";

interface Props {
  action: (formData: FormData) => Promise<void>;
  loja: { sqlEnabled: boolean; bridgeUrl: string; bridgeToken: string };
  tenantId: string;
}

export default function BridgeForm({ action, loja, tenantId }: Props) {
  const [verToken, setVerToken] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function copiarToken() {
    const input = document.getElementById("bridge-token") as HTMLInputElement | null;
    if (!input) return;
    await navigator.clipboard.writeText(input.value);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <form action={action} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
        <input
          type="checkbox"
          id="enabled"
          name="enabled"
          defaultChecked={loja.sqlEnabled}
          className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
        />
        <label htmlFor="enabled" className="cursor-pointer">
          <p className="text-sm font-medium text-slate-700">Bridge SQL habilitada</p>
          <p className="text-xs text-slate-400">Desmarque para pausar sem perder as credenciais.</p>
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          URL da Bridge
        </label>
        <input
          type="url"
          name="bridgeUrl"
          defaultValue={loja.bridgeUrl}
          placeholder="https://sql-cliente.lctecnologias.com.br"
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <p className="text-xs text-slate-400 mt-0.5">
          Cloudflare Tunnel apontando para porta 3055 da bridge.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Token de segurança
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              id="bridge-token"
              type={verToken ? "text" : "password"}
              name="token"
              defaultValue={loja.bridgeToken}
              placeholder={loja.bridgeToken ? "••••••••••••••••" : "Token gerado pelo instalar-bridge.ps1"}
              className="w-full border border-slate-300 rounded-md px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <button
              type="button"
              onClick={() => setVerToken((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              {verToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {loja.bridgeToken && (
            <button
              type="button"
              onClick={copiarToken}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-md text-xs text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
            >
              {copiado ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copiado ? "Copiado" : "Copiar"}
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          Deixe em branco para manter o token atual. Armazenado criptografado (AES-256-GCM).
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
        <Link
          href={`/admin/empresas/${tenantId}?aba=lojas`}
          className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          Salvar configuração
        </button>
      </div>
    </form>
  );
}
