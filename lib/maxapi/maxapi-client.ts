/**
 * MaxAPI client — server-side only.
 *
 * Authentication: POST /v2/auth with { empid, terminal } → JWT Bearer token.
 * Token TTL: 3600s. Cache TTL: 3000s (50 min safety margin).
 * Token NEVER reaches the browser and NEVER appears in logs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TokenDto,
  ServiceOrder,
  ServiceOrderBody,
  ServiceOrderItem,
  MaxApiError,
  MaxApiPaginated,
  MaxApiProduct,
} from "./maxapi-types";

export interface MaxApiConfig {
  baseUrl: string;
  empId: number;
  terminal: string;
}

const CACHE_TTL_SECONDS = 3000;

async function fetchNewToken(config: MaxApiConfig): Promise<TokenDto> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(`${config.baseUrl}/v2/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empid: config.empId, terminal: config.terminal }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`MaxAPI auth HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as TokenDto;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error("MaxAPI auth: timeout após 15s");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any>;

export async function getOrRefreshToken(
  config: MaxApiConfig,
  supabaseAdmin: AnySupabaseClient,
  lojaId: string,
): Promise<string> {
  const { data: rows } = await supabaseAdmin
    .from("integration_configs")
    .select("maxapi_token_cache, maxapi_token_expires_at")
    .eq("loja_id", lojaId)
    .order("updated_at", { ascending: false })
    .limit(1);

  const row = ((rows as Record<string, unknown>[] | null)?.[0]) ?? null;
  const cached: string | null = row?.maxapi_token_cache as string ?? null;
  const expiresAt: string | null = row?.maxapi_token_expires_at as string ?? null;

  if (cached && expiresAt && new Date(expiresAt).getTime() > Date.now()) {
    return cached;
  }

  const dto = await fetchNewToken(config);
  const cacheExpiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString();

  await supabaseAdmin
    .from("integration_configs")
    .update({
      maxapi_token_cache: dto.token,
      maxapi_token_expires_at: cacheExpiresAt,
    })
    .eq("loja_id", lojaId);

  return dto.token;
}

async function maxApiRequest<T>(
  config: MaxApiConfig,
  supabaseAdmin: AnySupabaseClient,
  lojaId: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  timeoutMs = 15_000,
): Promise<T> {
  let token = await getOrRefreshToken(config, supabaseAdmin, lojaId);

  const doRequest = async (bearerToken: string): Promise<Response> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(`${config.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === "AbortError") {
        throw new Error(`MaxAPI ${method} ${path}: timeout após ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  let res = await doRequest(token);

  if (res.status === 401) {
    await supabaseAdmin
      .from("integration_configs")
      .update({ maxapi_token_cache: null, maxapi_token_expires_at: null })
      .eq("loja_id", lojaId);
    token = await getOrRefreshToken(config, supabaseAdmin, lojaId);
    res = await doRequest(token);
  }

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => ({}))) as MaxApiError;
    const msg = errorBody.message ?? (await res.text().catch(() => ""));
    throw new Error(`MaxAPI ${method} ${path} HTTP ${res.status}: ${msg}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function listServiceOrdersMaxApi(
  config: MaxApiConfig,
  supabaseAdmin: AnySupabaseClient,
  lojaId: string,
  params: { nomeCliente?: string; veiculoPlaca?: string; status?: string } = {},
): Promise<ServiceOrder[]> {
  const qs = new URLSearchParams();
  if (params.nomeCliente) qs.set("nomeCliente", params.nomeCliente);
  if (params.veiculoPlaca) qs.set("veiculoPlaca", params.veiculoPlaca);
  if (params.status) qs.set("status", params.status);

  const path = `/v2/serviceorder${qs.toString() ? `?${qs}` : ""}`;
  const result = await maxApiRequest<MaxApiPaginated<ServiceOrder>>(
    config, supabaseAdmin, lojaId, "GET", path,
  );
  return result.docs ?? [];
}

export async function getServiceOrderMaxApi(
  config: MaxApiConfig,
  supabaseAdmin: AnySupabaseClient,
  lojaId: string,
  osId: number,
): Promise<ServiceOrder> {
  return maxApiRequest<ServiceOrder>(
    config, supabaseAdmin, lojaId, "GET", `/v2/serviceorder/${osId}`,
  );
}

export async function searchProductsMaxApi(
  config: MaxApiConfig,
  supabaseAdmin: AnySupabaseClient,
  lojaId: string,
  descricao: string,
): Promise<MaxApiProduct[]> {
  const qs = new URLSearchParams({ descricao });
  const result = await maxApiRequest<MaxApiPaginated<MaxApiProduct>>(
    config, supabaseAdmin, lojaId, "GET", `/v2/product?${qs}`,
  );
  return result.docs ?? [];
}

export async function getProductMaxApi(
  config: MaxApiConfig,
  supabaseAdmin: AnySupabaseClient,
  lojaId: string,
  productId: number,
): Promise<MaxApiProduct> {
  return maxApiRequest<MaxApiProduct>(
    config, supabaseAdmin, lojaId, "GET", `/v2/product/${productId}`,
  );
}

export async function createServiceOrder(
  config: MaxApiConfig,
  supabaseAdmin: AnySupabaseClient,
  lojaId: string,
  body: ServiceOrderBody,
): Promise<{ id: number }> {
  return maxApiRequest<{ id: number }>(
    config, supabaseAdmin, lojaId, "POST", "/v2/serviceorder", body,
  );
}

export async function addItemToServiceOrderMaxApi(
  config: MaxApiConfig,
  supabaseAdmin: AnySupabaseClient,
  lojaId: string,
  item: ServiceOrderItem,
): Promise<{ id: number }> {
  return maxApiRequest<{ id: number }>(
    config, supabaseAdmin, lojaId, "POST", "/v2/serviceorder/items", item,
  );
}

export async function cancelServiceOrderItem(
  config: MaxApiConfig,
  supabaseAdmin: AnySupabaseClient,
  lojaId: string,
  itemId: number,
): Promise<void> {
  await maxApiRequest<void>(
    config, supabaseAdmin, lojaId, "DELETE", `/v2/serviceorder/items/${itemId}`,
  );
}

export interface LojaMaxApiRow {
  emp_id_maxdata: string;
  terminal_maxdata: string;
}

export interface IntegrationConfigRow {
  maxapi_url: string | null;
}

export function buildMaxApiConfig(loja: LojaMaxApiRow, cfg: IntegrationConfigRow): MaxApiConfig {
  if (!cfg.maxapi_url) throw new Error("MaxAPI não configurada: falta maxapi_url");
  if (!loja.emp_id_maxdata) throw new Error("Loja sem emp_id_maxdata configurado");
  if (!loja.terminal_maxdata) throw new Error("Loja sem terminal_maxdata configurado");

  return {
    baseUrl: cfg.maxapi_url.replace(/\/$/, ""),
    empId: parseInt(loja.emp_id_maxdata, 10),
    terminal: loja.terminal_maxdata,
  };
}
