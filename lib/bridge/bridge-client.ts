/**
 * Bridge SQL client — server-side only.
 *
 * Protocol: POST {url}/query
 *   Body:     { "sql": "SELECT...", "params": { "key": value } }
 *   Response: { "rows": [...] }
 *   Auth:     Authorization: Bearer {token}
 *
 * SQL parameters use SQL Server named-param syntax: @name
 */

export interface BridgeConfig {
  url: string;
  token: string;
}

function bridgeBase(url: string): string {
  return url.replace(/\/+$/, "").replace(/\/query$/, "");
}

interface BridgeResponse<T> {
  rows: T[];
  error?: string;
}

export async function queryBridge<T = Record<string, unknown>>(
  config: BridgeConfig,
  sql: string,
  params: Record<string, unknown> = {},
  timeoutMs = 30_000,
): Promise<T[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${bridgeBase(config.url)}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({ sql, params }),
      signal: ctrl.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error).name === "AbortError") {
      throw new Error(`Bridge SQL: timeout após ${timeoutMs / 1000}s`);
    }
    throw new Error(`Bridge SQL: falha de rede — ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Bridge SQL HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as BridgeResponse<T>;
  if (data.error) {
    throw new Error(`Bridge SQL erro: ${data.error}`);
  }
  if (!Array.isArray(data?.rows)) {
    throw new Error('Bridge SQL: resposta inesperada — campo "rows" ausente');
  }
  return data.rows;
}

export async function pingBridge(
  config: BridgeConfig,
): Promise<{ ok: boolean; db: string; ms: number; error?: string }> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(`${bridgeBase(config.url)}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({ sql: "SELECT 1 AS ping", params: {} }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const ms = Date.now() - t0;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, db: "", ms, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const json = (await res.json()) as { rows?: unknown[]; error?: string; db?: string };
    if (json.error) return { ok: false, db: "", ms, error: json.error };
    return { ok: true, db: json.db ?? "BATAUTO", ms };
  } catch (err) {
    clearTimeout(timer);
    const ms = Date.now() - t0;
    const msg = (err as Error).name === "AbortError" ? "timeout após 8s" : (err as Error).message;
    return { ok: false, db: "", ms, error: msg };
  }
}
