"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SyncResult {
  vendas: number;
  produtos: number;
}

export function SyncButtonUnified() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleSync = useCallback(async () => {
    setLoading(true);
    setErro(null);

    try {
      // Disparar sync de vendas+itens+pgtos e produtos em paralelo
      const [syncRes, prodRes] = await Promise.allSettled([
        fetch("/api/sync/now", { method: "POST" }),
        fetch("/api/sync/produtos-rapido", { method: "POST" }),
      ]);

      const syncData = syncRes.status === "fulfilled" ? await syncRes.value.json() : null;
      const prodData = prodRes.status === "fulfilled" ? await prodRes.value.json() : null;

      if (syncRes.status === "fulfilled" && syncRes.value.status === 429) {
        setCooldown(syncData?.segundosRestantes ?? 300);
        return;
      }

      if (syncRes.status === "rejected" && prodRes.status === "rejected") {
        setErro("Erro ao sincronizar");
        return;
      }

      setLastResult({
        vendas: syncData?.vendas ?? 0,
        produtos: prodData?.atualizados ?? 0,
      });
      setCooldown(300);
      router.refresh();
    } catch {
      setErro("Erro ao sincronizar");
    } finally {
      setLoading(false);
    }
  }, [router]);

  if (cooldown > 0) {
    const minutos = Math.floor(cooldown / 60);
    const segundos = (cooldown % 60).toString().padStart(2, "0");
    return (
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-slate-400" />
        <span className="text-xs text-slate-500">
          Próxima em {minutos}:{segundos}
        </span>
        {lastResult && (
          <span className="text-xs text-green-600 ml-2">
            ✓ {lastResult.vendas} vendas · {lastResult.produtos} produtos
          </span>
        )}
      </div>
    );
  }

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
