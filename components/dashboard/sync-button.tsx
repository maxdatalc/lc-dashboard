"use client";

// Botão de sincronização manual com throttle visual de 5 minutos
// Após sync bem-sucedido exibe resumo de registros processados

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SyncResult {
  vendas: number;
  contasProcessadas: number;
}

export function SyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Decrementar cooldown a cada segundo enquanto ativo
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleSync = useCallback(async () => {
    setLoading(true);
    setErro(null);

    try {
      const res = await fetch("/api/sync/now", { method: "POST" });
      const data = await res.json();

      if (res.status === 429) {
        // Já houve sync recente — iniciar cooldown com tempo restante retornado
        setCooldown(data.segundosRestantes ?? 300);
        return;
      }

      if (!res.ok) {
        setErro(data.error ?? "Erro ao sincronizar");
        return;
      }

      // Sync bem-sucedido — guardar resultado e iniciar cooldown de 5 min
      setLastResult({ vendas: data.vendas, contasProcessadas: data.contasProcessadas });
      setCooldown(300);
      router.refresh();
    } catch {
      setErro("Erro ao sincronizar");
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Estado de cooldown ativo — mostrar contador regressivo
  if (cooldown > 0) {
    const minutos = Math.floor(cooldown / 60);
    const segundos = (cooldown % 60).toString().padStart(2, "0");

    return (
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-slate-400" />
        <span className="text-xs text-slate-500">
          Próxima sincronização em {minutos}:{segundos}
        </span>
        {lastResult && (
          <span className="text-xs text-green-600 ml-2">
            ✓ {lastResult.vendas} vendas · {lastResult.contasProcessadas} clientes
          </span>
        )}
      </div>
    );
  }

  // Estado disponível — mostrar botão
  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleSync}
        disabled={loading}
        variant="outline"
        size="sm"
        className="gap-2 text-slate-600 hover:text-slate-900"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Sincronizando..." : "Sincronizar agora"}
      </Button>
      {erro && <span className="text-xs text-red-500">{erro}</span>}
    </div>
  );
}
