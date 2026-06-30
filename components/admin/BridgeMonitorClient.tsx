"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, HelpCircle, RefreshCw } from "lucide-react";
import type {
  BridgeStatusEntry,
  BridgeStatusResponse,
} from "@/app/api/admin/bridges/status/route";

const INTERVAL = 30;

type LoadStatus = "idle" | "loading" | "done" | "error";

export function BridgeMonitorClient() {
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("idle");
  const [data, setData] = useState<BridgeStatusResponse | null>(null);
  const [countdown, setCountdown] = useState(INTERVAL);
  const countdownRef = useRef(INTERVAL);
  const isMounted = useRef(true);

  const doFetch = useCallback(async () => {
    setLoadStatus("loading");
    try {
      const res = await fetch("/api/admin/bridges/status", { cache: "no-store" });
      if (!isMounted.current) return;
      if (!res.ok) {
        setLoadStatus("error");
        return;
      }
      const json = (await res.json()) as BridgeStatusResponse;
      setData(json);
      setLoadStatus("done");
      countdownRef.current = INTERVAL;
      setCountdown(INTERVAL);
    } catch {
      if (isMounted.current) setLoadStatus("error");
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    doFetch();

    const tick = setInterval(() => {
      if (!isMounted.current) return;
      countdownRef.current -= 1;
      setCountdown(countdownRef.current);
      if (countdownRef.current <= 0) {
        countdownRef.current = INTERVAL;
        doFetch();
      }
    }, 1000);

    return () => {
      isMounted.current = false;
      clearInterval(tick);
    };
  }, [doFetch]);

  const online = data?.bridges.filter((b) => b.connected).length ?? 0;
  const offline = data?.bridges.filter((b) => !b.connected).length ?? 0;
  const unconfigured = data?.totalUnconfigured ?? 0;
  const isFirstLoad = loadStatus !== "done" && !data;

  return (
    <div className="space-y-5">
      {/* KPI chips + controles */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-3">
          <KpiChip value={online} label="Online" color="emerald" />
          <KpiChip value={offline} label="Offline" color="red" />
          {(isFirstLoad || unconfigured > 0) && (
            <KpiChip value={unconfigured} label="Sem bridge" color="slate" />
          )}
        </div>

        <div className="flex items-center gap-3">
          {data && (
            <span className="text-xs text-slate-400">
              {new Date(data.checkedAt).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                timeZone: "America/Sao_Paulo",
              })}
              {loadStatus === "done" && (
                <span className="text-slate-300"> · auto em {countdown}s</span>
              )}
            </span>
          )}
          <button
            onClick={() => {
              countdownRef.current = INTERVAL;
              doFetch();
            }}
            disabled={loadStatus === "loading"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loadStatus === "loading" ? "animate-spin" : ""}`}
            />
            Atualizar
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Bridge", "Status", "Banco de Dados", "Latência", "Clientes"].map((col) => (
                <th
                  key={col}
                  className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isFirstLoad ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {[70, 50, 40, 30, 80].map((w, j) => (
                    <td key={j} className="px-5 py-4">
                      <div
                        className="h-4 bg-slate-100 rounded animate-pulse"
                        style={{ width: `${w}%` }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : loadStatus === "error" ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Erro ao carregar status das bridges.
                </td>
              </tr>
            ) : data?.bridges.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                  <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Nenhuma bridge configurada.
                </td>
              </tr>
            ) : (
              data!.bridges.map((bridge) => (
                <BridgeRow key={bridge.bridgeUrl} bridge={bridge} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && unconfigured > 0 && (
        <p className="text-xs text-slate-400 text-right">
          {unconfigured} loja{unconfigured > 1 ? "s" : ""} sem bridge configurada não{" "}
          {unconfigured > 1 ? "exibidas" : "exibida"}.
        </p>
      )}
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function KpiChip({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: "emerald" | "red" | "slate";
}) {
  const cls = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    red: "bg-red-50 border-red-200 text-red-700",
    slate: "bg-slate-100 border-slate-200 text-slate-600",
  }[color];

  return (
    <div className={`border rounded-lg px-4 py-2.5 text-center min-w-[90px] ${cls}`}>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}

function BridgeRow({ bridge }: { bridge: BridgeStatusEntry }) {
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      {/* Bridge host */}
      <td className="px-5 py-3.5">
        <div className="font-mono text-sm text-slate-800 font-medium">{bridge.bridgeHost}</div>
        <div
          className="text-xs text-slate-400 truncate max-w-[220px]"
          title={bridge.bridgeUrl}
        >
          {bridge.bridgeUrl}
        </div>
      </td>

      {/* Status */}
      <td className="px-5 py-3.5">
        {bridge.connected ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Online
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            Offline
          </span>
        )}
      </td>

      {/* DB */}
      <td className="px-5 py-3.5">
        {bridge.dbName ? (
          <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">
            {bridge.dbName}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>

      {/* Latência */}
      <td className="px-5 py-3.5">
        {bridge.latencyMs != null ? (
          <span
            className={`text-sm font-semibold tabular-nums ${
              bridge.latencyMs < 300
                ? "text-emerald-700"
                : bridge.latencyMs < 900
                ? "text-amber-600"
                : "text-red-600"
            }`}
          >
            {bridge.latencyMs}ms
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>

      {/* Clientes */}
      <td className="px-5 py-3.5">
        <div className="flex flex-wrap gap-1.5">
          {bridge.lojas.map((l) => (
            <span
              key={l.lojaId}
              className="inline-flex flex-col text-xs bg-slate-100 px-2 py-1 rounded-md leading-tight"
            >
              <span className="font-medium text-slate-700">{l.tenantName}</span>
              {l.lojaName !== l.tenantName && (
                <span className="text-slate-400">{l.lojaName}</span>
              )}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}
