/**
 * Resolução do terminal MaxData — server-side only.
 *
 * `terminal_maxdata` existe em duas tabelas por razões históricas:
 *   - integration_configs.terminal_maxdata  ← FONTE CANÔNICA
 *   - lojas.terminal_maxdata                ← shadow (deprecated, só fallback)
 *
 * Ver supabase/migrations/20260721_consolidate_terminal_maxdata.sql.
 *
 * Regra deliberada: NÃO existe default "1". Um terminal ausente devolve null e
 * o erro estoura em buildMaxApiConfig — falhar visivelmente é melhor que
 * autenticar na MaxAPI com um terminal errado (o bug que isto corrige).
 */

import { createAdminClient } from "@/lib/supabase/server";

type TerminalRow = { terminal_maxdata?: unknown } | null | undefined;

function normalize(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Resolve o terminal a partir das duas origens, priorizando a canônica.
 * Mesmo padrão que lib/api/service-orders.functions.ts já usava inline.
 */
export function resolveTerminal(cfgRow: TerminalRow, lojaRow?: TerminalRow): string | null {
  return normalize(cfgRow?.terminal_maxdata) ?? normalize(lojaRow?.terminal_maxdata);
}

/**
 * Busca em lote o terminal canônico de várias lojas.
 * Retorna um Map lojaId → terminal (ausente/vazio vira null).
 */
export async function getTerminaisByLojaIds(
  lojaIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (lojaIds.length === 0) return map;

  const supabaseAdmin = createAdminClient();
  const { data } = await supabaseAdmin
    .from("integration_configs")
    .select("loja_id, terminal_maxdata")
    .in("loja_id", lojaIds);

  for (const row of (data ?? []) as Array<{ loja_id: string; terminal_maxdata: unknown }>) {
    map.set(row.loja_id, normalize(row.terminal_maxdata));
  }
  return map;
}
