"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, ServerCog, Database, Gauge, Users2, Radio } from "lucide-react";
import type {
  BridgeStatusEntry,
  MonitoramentoResponse,
} from "@/app/api/admin/monitoramento/route";

const INTERVAL = 30;

// ── Paleta da Sala de Operações ─────────────────────────────────────────────────
// Aponta para os tokens --adm-* do .admin-shell, então o console acompanha o
// toggle de tema (dark/claro) junto com o resto do painel.
const C = {
  bg: "var(--adm-bg)",
  panel: "var(--adm-surface)",
  panelHi: "var(--adm-surface-2)",
  line: "var(--adm-line)",
  lineHi: "var(--adm-line-strong)",
  signal: "var(--adm-signal)",
  alert: "var(--adm-alert)",
  data: "var(--adm-accent)",
  warn: "var(--adm-warn)",
  txt: "var(--adm-text)",
  mut: "var(--adm-text-dim)",
  faint: "var(--adm-text-faint)",
};

/** Mistura uma cor (token/var) com transparência — para tints e glows. */
const tint = (color: string, pct: number) =>
  `color-mix(in srgb, ${color} ${pct}%, transparent)`;

const MONO = "var(--font-numeric, ui-monospace, monospace)";

// ── Hooks utilitários ────────────────────────────────────────────────────────────

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const h = () => setReduced(m.matches);
    m.addEventListener?.("change", h);
    return () => m.removeEventListener?.("change", h);
  }, []);
  return reduced;
}

function useCountUp(target: number, duration = 850) {
  const reduced = usePrefersReducedMotion();
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (reduced) {
      setVal(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduced]);
  return reduced ? target : val;
}

// ── Componente principal ─────────────────────────────────────────────────────────

type LoadStatus = "idle" | "loading" | "done" | "error";

export function MonitoramentoClient() {
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [data, setData] = useState<MonitoramentoResponse | null>(null);
  const [countdown, setCountdown] = useState(INTERVAL);
  const [sweepKey, setSweepKey] = useState(0);
  const countdownRef = useRef(INTERVAL);
  const mounted = useRef(true);

  const doFetch = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/admin/monitoramento", { cache: "no-store" });
      if (!mounted.current) return;
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const json = (await res.json()) as MonitoramentoResponse;
      setData(json);
      setStatus("done");
      setSweepKey((k) => k + 1);
      countdownRef.current = INTERVAL;
      setCountdown(INTERVAL);
    } catch {
      if (mounted.current) setStatus("error");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    doFetch();
    const tick = setInterval(() => {
      if (!mounted.current) return;
      countdownRef.current -= 1;
      setCountdown(countdownRef.current);
      if (countdownRef.current <= 0) {
        countdownRef.current = INTERVAL;
        doFetch();
      }
    }, 1000);
    return () => {
      mounted.current = false;
      clearInterval(tick);
    };
  }, [doFetch]);

  const isFirstLoad = status !== "done" && !data;
  const bs = data?.bridgeSummary;
  const as = data?.accessSummary;
  const verdictOk = (bs?.offline ?? 0) === 0;

  return (
    <div
      style={{ background: C.bg, color: C.txt, minHeight: "100vh" }}
      className="px-5 py-5 sm:px-7 sm:py-7"
    >
      <div className="mx-auto max-w-[1400px] space-y-5">
        <CommandBar
          verdictOk={verdictOk}
          online={bs?.online ?? 0}
          offline={bs?.offline ?? 0}
          ativos={as?.ativos24h ?? 0}
          checkedAt={data?.checkedAt ?? null}
          countdown={countdown}
          loading={status === "loading"}
          firstLoad={isFirstLoad}
          onRefresh={() => {
            countdownRef.current = INTERVAL;
            setCountdown(INTERVAL);
            doFetch();
          }}
          sweepKey={sweepKey}
        />

        {/* ── Telemetria ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile
            label="Bridges online"
            value={bs?.online ?? 0}
            color={C.signal}
            icon={<Radio className="h-4 w-4" />}
            loading={isFirstLoad}
            sub={`de ${(bs?.online ?? 0) + (bs?.offline ?? 0)} ativas`}
          />
          <Tile
            label="Bridges offline"
            value={bs?.offline ?? 0}
            color={bs?.offline ? C.alert : C.faint}
            icon={<ServerCog className="h-4 w-4" />}
            loading={isFirstLoad}
            sub={bs?.offline ? "requer atenção" : "tudo no ar"}
          />
          <Tile
            label="Clientes ativos hoje"
            value={as?.ativos24h ?? 0}
            color={C.data}
            icon={<Users2 className="h-4 w-4" />}
            loading={isFirstLoad}
            sub={`${as?.total ?? 0} no total`}
          />
          <Tile
            label="Latência média"
            value={bs?.avgLatencyMs ?? 0}
            suffix="ms"
            color={
              bs?.avgLatencyMs == null
                ? C.faint
                : bs.avgLatencyMs < 300
                ? C.signal
                : bs.avgLatencyMs < 900
                ? C.warn
                : C.alert
            }
            icon={<Gauge className="h-4 w-4" />}
            loading={isFirstLoad}
            sub="ida e volta /health"
          />
        </div>

        {/* ── Frota de bridges ────────────────────────────────── */}
        <Section
          title="Frota de bridges"
          count={data?.bridges.length}
          hint="status SQL em tempo real · agrupado por bridge"
        >
          {isFirstLoad ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <NodeSkeleton key={i} />
              ))}
            </div>
          ) : status === "error" ? (
            <ErrorState />
          ) : data && data.bridges.length === 0 ? (
            <EmptyState text="Nenhuma bridge configurada." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data!.bridges.map((b, i) => (
                <NodeCard key={b.bridgeUrl} bridge={b} index={i} />
              ))}
            </div>
          )}
          {data && data.bridgeSummary.unconfigured > 0 && (
            <p className="mt-3 text-xs" style={{ color: C.faint }}>
              {data.bridgeSummary.unconfigured} loja
              {data.bridgeSummary.unconfigured > 1 ? "s" : ""} sem bridge configurada.
            </p>
          )}
        </Section>

        {/* ── Atividade dos clientes ──────────────────────────── */}
        <Section
          title="Atividade dos clientes"
          count={data?.access.length}
          hint="último acesso ao dashboard"
        >
          {isFirstLoad ? (
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <RowSkeleton key={i} />
              ))}
            </div>
          ) : data && data.access.length > 0 ? (
            <ActivityTable rows={data.access} />
          ) : (
            <EmptyState text="Nenhum acesso registrado ainda." />
          )}
        </Section>
      </div>
    </div>
  );
}

// ── Command bar ────────────────────────────────────────────────────────────────

function CommandBar({
  verdictOk,
  online,
  offline,
  ativos,
  checkedAt,
  countdown,
  loading,
  firstLoad,
  onRefresh,
  sweepKey,
}: {
  verdictOk: boolean;
  online: number;
  offline: number;
  ativos: number;
  checkedAt: string | null;
  countdown: number;
  loading: boolean;
  firstLoad: boolean;
  onRefresh: () => void;
  sweepKey: number;
}) {
  const accent = firstLoad ? C.data : verdictOk ? C.signal : C.warn;
  const verdict = firstLoad ? "Inicializando" : verdictOk ? "Operacional" : "Atenção";

  return (
    <div
      className="relative overflow-hidden rounded-2xl px-5 py-5 sm:px-7 sm:py-6 ops-rise"
      style={{
        background: `radial-gradient(120% 140% at 0% 0%, ${C.panelHi} 0%, ${C.panel} 55%, ${C.bg} 100%)`,
        border: `1px solid ${C.lineHi}`,
        backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
        backgroundSize: "44px 44px",
      }}
    >
      {/* Scanline em cada atualização */}
      {!firstLoad && (
        <div
          key={sweepKey}
          className="ops-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3"
          style={{
            background: `linear-gradient(90deg, transparent, ${tint(accent, 18)} 45%, ${tint(accent, 28)} 50%, transparent)`,
          }}
        />
      )}

      <div className="relative flex flex-wrap items-center justify-between gap-5">
        {/* Verdito */}
        <div className="flex items-center gap-4">
          <div className="relative flex h-12 w-12 items-center justify-center">
            <span
              className="ops-ping absolute inline-flex h-4 w-4 rounded-full"
              style={{ background: accent }}
            />
            <span
              className="relative inline-flex h-3.5 w-3.5 rounded-full"
              style={{ background: accent, boxShadow: `0 0 16px ${accent}` }}
            />
          </div>
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: C.faint }}
            >
              Sala de operações · LC Gestor
            </p>
            <h1
              className="text-2xl sm:text-3xl font-bold leading-tight"
              style={{ color: C.txt, letterSpacing: "-0.02em" }}
            >
              {verdict}
            </h1>
            <p className="mt-0.5 text-xs" style={{ color: C.mut }}>
              <span style={{ color: C.signal }}>{online} no ar</span>
              {offline > 0 && (
                <>
                  {" · "}
                  <span style={{ color: C.alert }}>{offline} fora</span>
                </>
              )}
              {" · "}
              <span style={{ color: C.data }}>{ativos} clientes ativos hoje</span>
            </p>
          </div>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span
                className="ops-breathe inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: C.signal }}
              />
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: C.faint }}
              >
                Ao vivo
              </span>
            </div>
            <p className="mt-1 text-xs tabular-nums" style={{ color: C.mut, fontFamily: MONO }}>
              {checkedAt
                ? new Date(checkedAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    timeZone: "America/Sao_Paulo",
                  })
                : "--:--:--"}
            </p>
          </div>

          <CountdownRing seconds={countdown} accent={accent} />

          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
            style={{ background: C.panelHi, border: `1px solid ${C.lineHi}`, color: C.txt }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>
    </div>
  );
}

function CountdownRing({ seconds, accent }: { seconds: number; accent: string }) {
  const r = 15;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, seconds / INTERVAL));
  return (
    <div className="relative h-10 w-10" title={`Próxima atualização em ${seconds}s`}>
      <svg className="h-10 w-10 -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" stroke={C.line} strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums"
        style={{ color: C.mut, fontFamily: MONO }}
      >
        {seconds}
      </span>
    </div>
  );
}

// ── Tile de telemetria ───────────────────────────────────────────────────────────

function Tile({
  label,
  value,
  suffix,
  color,
  icon,
  sub,
  loading,
}: {
  label: string;
  value: number;
  suffix?: string;
  color: string;
  icon: React.ReactNode;
  sub: string;
  loading: boolean;
}) {
  const shown = useCountUp(value);
  return (
    <div
      className="ops-rise rounded-xl px-4 py-3.5"
      style={{ background: C.panel, border: `1px solid ${C.line}` }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: C.faint }}
        >
          {label}
        </span>
        <span style={{ color }}>{icon}</span>
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-16 rounded shimmer" />
      ) : (
        <p
          className="mt-1.5 text-3xl font-bold leading-none tabular-nums"
          style={{ color, fontFamily: MONO }}
        >
          {shown}
          {suffix && <span className="text-lg" style={{ color: C.mut }}>{suffix}</span>}
        </p>
      )}
      <p className="mt-1.5 text-[11px]" style={{ color: C.mut }}>
        {sub}
      </p>
    </div>
  );
}

// ── Seção ──────────────────────────────────────────────────────────────────────

function Section({
  title,
  count,
  hint,
  children,
}: {
  title: string;
  count?: number;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ops-rise">
      <div className="mb-3 flex items-baseline gap-2.5">
        <h2 className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: C.txt }}>
          {title}
        </h2>
        {count != null && (
          <span
            className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
            style={{ background: C.panelHi, color: C.mut, fontFamily: MONO }}
          >
            {count}
          </span>
        )}
        <span className="ml-auto text-[11px]" style={{ color: C.faint }}>
          {hint}
        </span>
      </div>
      {children}
    </section>
  );
}

// ── Node card (bridge) ───────────────────────────────────────────────────────────

function NodeCard({ bridge, index }: { bridge: BridgeStatusEntry; index: number }) {
  const [hover, setHover] = useState(false);
  const reduced = usePrefersReducedMotion();
  const ok = bridge.connected;
  const accent = ok ? C.signal : C.alert;

  const latColor =
    bridge.latencyMs == null
      ? C.faint
      : bridge.latencyMs < 300
      ? C.signal
      : bridge.latencyMs < 900
      ? C.warn
      : C.alert;
  const latPct = bridge.latencyMs == null ? 0 : Math.min(100, (bridge.latencyMs / 1200) * 100);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="ops-rise relative overflow-hidden rounded-xl px-4 py-3.5"
      style={{
        background: ok ? C.panel : tint(C.alert, 6),
        border: `1px solid ${hover ? C.lineHi : ok ? C.line : tint(C.alert, 35)}`,
        boxShadow: hover ? `0 8px 30px -12px ${tint(accent, 40)}` : "none",
        transition: "border-color 0.2s ease, box-shadow 0.25s ease, transform 0.2s ease",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        animationDelay: reduced ? undefined : `${Math.min(index * 45, 400)}ms`,
      }}
    >
      {/* Borda de sinal à esquerda */}
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: accent, opacity: ok ? 0.7 : 0.9 }}
      />

      {/* Topo: status + host + latência */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {ok && (
              <span
                className="ops-ping absolute inline-flex h-full w-full rounded-full"
                style={{ background: accent }}
              />
            )}
            <span
              className="relative inline-flex h-2.5 w-2.5 rounded-full"
              style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
            />
          </span>
          <span
            className="truncate text-[13px] font-semibold"
            style={{ color: C.txt, fontFamily: MONO }}
            title={bridge.bridgeUrl}
          >
            {bridge.bridgeHost}
          </span>
        </div>
        {ok ? (
          <span
            className="shrink-0 text-[13px] font-bold tabular-nums"
            style={{ color: latColor, fontFamily: MONO }}
          >
            {bridge.latencyMs}ms
          </span>
        ) : (
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: tint(C.alert, 14), color: C.alert }}
          >
            Offline
          </span>
        )}
      </div>

      {/* Barra de latência */}
      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full" style={{ background: C.line }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${latPct}%`,
            background: latColor,
            transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </div>

      {/* DB + nº de lojas */}
      <div className="mt-3 flex items-center gap-2">
        <Database className="h-3.5 w-3.5 shrink-0" style={{ color: C.faint }} />
        {bridge.dbName ? (
          <span
            className="rounded px-1.5 py-0.5 text-[11px] font-semibold"
            style={{ background: C.panelHi, color: C.data, fontFamily: MONO }}
          >
            {bridge.dbName}
          </span>
        ) : (
          <span className="text-[11px]" style={{ color: C.faint }}>
            sem leitura
          </span>
        )}
        <span className="ml-auto text-[11px] tabular-nums" style={{ color: C.faint }}>
          {bridge.lojaCount} loja{bridge.lojaCount > 1 ? "s" : ""}
        </span>
      </div>

      {/* Clientes (agrupados por tenant) */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {bridge.clients.map((cli) => (
          <span
            key={cli.tenantName}
            title={cli.lojaNames.join(" · ")}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
            style={{ background: C.panelHi, color: C.mut, border: `1px solid ${C.line}` }}
          >
            <span className="font-medium" style={{ color: C.txt }}>
              {cli.tenantName}
            </span>
            {cli.lojaNames.length > 1 && (
              <span
                className="rounded px-1 text-[10px] font-bold tabular-nums"
                style={{ background: C.line, color: C.mut }}
              >
                {cli.lojaNames.length}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Tabela de atividade ──────────────────────────────────────────────────────────

function tempoRelativo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "Agora mesmo";
  if (m < 60) return `Há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Ontem";
  if (d < 7) return `Há ${d} dias`;
  if (d < 30) return `Há ${Math.floor(d / 7)} sem.`;
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function statusDot(dateStr: string | null): { color: string; label: string } {
  if (!dateStr) return { color: C.faint, label: "Nunca" };
  const h = (Date.now() - new Date(dateStr).getTime()) / 3_600_000;
  if (h < 24) return { color: C.signal, label: "Hoje" };
  if (h < 168) return { color: C.warn, label: "Esta semana" };
  return { color: C.faint, label: "Inativo" };
}

function ActivityTable({
  rows,
}: {
  rows: import("@/app/api/admin/monitoramento/route").AccessRow[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${C.line}` }}>
      <table className="w-full text-sm" style={{ minWidth: 640 }}>
        <thead>
          <tr style={{ background: C.panel }}>
            {["Cliente", "Status", "Último acesso", "Requisições", "Último usuário"].map((col) => (
              <th
                key={col}
                className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: C.faint }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const st = statusDot(r.lastSeenAt);
            return (
              <tr
                key={r.id}
                style={{ borderTop: `1px solid ${C.line}` }}
                className="adm-row"
              >
                <td className="px-4 py-3">
                  <div className="font-medium" style={{ color: C.txt }}>
                    {r.name}
                  </div>
                  <div className="text-[11px]" style={{ color: C.faint, fontFamily: MONO }}>
                    {r.slug}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-medium"
                    style={{ color: st.color }}
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: st.color }}
                    />
                    {st.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {r.lastSeenAt ? (
                    <div>
                      <div style={{ color: C.txt }}>{tempoRelativo(r.lastSeenAt)}</div>
                      <div className="text-[11px]" style={{ color: C.faint, fontFamily: MONO }}>
                        {new Date(r.lastSeenAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "America/Sao_Paulo",
                        })}
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: C.faint }}>—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.totalAccesses != null ? (
                    <span
                      className="font-semibold tabular-nums"
                      style={{ color: C.txt, fontFamily: MONO }}
                    >
                      {r.totalAccesses.toLocaleString("pt-BR")}
                    </span>
                  ) : (
                    <span style={{ color: C.faint }}>—</span>
                  )}
                </td>
                <td className="px-4 py-3" style={{ color: C.mut }}>
                  {r.lastUserName ?? <span style={{ color: C.faint }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Estados auxiliares ───────────────────────────────────────────────────────────

function NodeSkeleton() {
  return (
    <div className="rounded-xl px-4 py-3.5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-32 rounded shimmer" />
        <div className="h-3.5 w-12 rounded shimmer" />
      </div>
      <div className="mt-3 h-1 w-full rounded-full shimmer" />
      <div className="mt-3 h-5 w-24 rounded shimmer" />
      <div className="mt-3 flex gap-1.5">
        <div className="h-6 w-20 rounded-md shimmer" />
        <div className="h-6 w-16 rounded-md shimmer" />
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5" style={{ borderBottom: `1px solid ${C.line}` }}>
      <div className="h-4 w-40 rounded shimmer" />
      <div className="h-4 w-20 rounded shimmer" />
      <div className="ml-auto h-4 w-24 rounded shimmer" />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl py-12 text-sm"
      style={{ border: `1px dashed ${C.lineHi}`, color: C.faint }}
    >
      <Radio className="mb-2 h-7 w-7 opacity-30" />
      {text}
    </div>
  );
}

function ErrorState() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl py-12 text-sm"
      style={{ border: `1px solid ${tint(C.alert, 35)}`, color: C.alert }}
    >
      <ServerCog className="mb-2 h-7 w-7 opacity-50" />
      Não foi possível carregar o monitoramento.
    </div>
  );
}
