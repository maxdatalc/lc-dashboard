/**
 * SIEG API Client — server-side only.
 *
 * Autenticação em dois níveis:
 *   Nível 1 (sistema integrador): clientId + secretKey → JWT válido 24h, cacheado no Redis
 *   Nível 2 (por empresa/CNPJ):   X-OAuth-Token → encriptado no Supabase por empId
 *
 * Endpoints:
 *   POST https://api.sieg.com/api/v1/create-jwt   → gera JWT do integrador
 *   POST https://api.sieg.com/api/v1/send-xml      → envia XML fiscal
 */

import { redis } from "@/lib/redis";

const SIEG_BASE = "https://api.sieg.com/api/v1";
const JWT_CACHE_KEY = "sieg:jwt:v1";
const JWT_TTL_SECONDS = 23 * 60 * 60; // 23h — renueva 1h antes do vencimento de 24h

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface SiegEnvioResult {
  ok: boolean;
  status: number;
  body: unknown;
  erro?: string;
}

// ─── JWT: geração e cache ─────────────────────────────────────────────────────

async function gerarJWT(): Promise<string> {
  const clientId  = process.env.SIEG_CLIENT_ID;
  const secretKey = process.env.SIEG_SECRET_KEY;

  if (!clientId || !secretKey) {
    throw new Error("SIEG_CLIENT_ID e SIEG_SECRET_KEY são obrigatórios");
  }

  const res = await fetch(`${SIEG_BASE}/create-jwt`, {
    method: "POST",
    headers: {
      "clientId":   clientId,
      "secretKey":  secretKey,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SIEG create-jwt HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { token?: string; jwt?: string; accessToken?: string };
  const token = data.token ?? data.jwt ?? data.accessToken;

  if (!token) {
    throw new Error(`SIEG create-jwt: resposta inesperada — ${JSON.stringify(data).slice(0, 200)}`);
  }

  return token;
}

/**
 * Retorna um JWT válido do sistema integrador.
 * Busca do Redis se existir; gera e armazena caso contrário.
 */
export async function getSiegJWT(): Promise<string> {
  const cached = await redis.get<string>(JWT_CACHE_KEY);
  if (cached) return cached;

  const token = await gerarJWT();
  await redis.set(JWT_CACHE_KEY, token, { ex: JWT_TTL_SECONDS });
  return token;
}

/**
 * Força renovação do JWT (chamado quando SIEG retorna 401).
 */
export async function renovarSiegJWT(): Promise<string> {
  await redis.del(JWT_CACHE_KEY);
  return getSiegJWT();
}

// ─── Envio de XML ─────────────────────────────────────────────────────────────

/**
 * Envia um XML fiscal para a plataforma SIEG.
 *
 * @param oauthToken  X-OAuth-Token da empresa (já decriptado)
 * @param xmlContent  Conteúdo XML UTF-8 decodificado (não o Base64)
 * @param tentativa   Número da tentativa — se > 1 e JWT expirou, renova automaticamente
 */
export async function siegEnviarXml(
  oauthToken: string,
  xmlContent: string,
  tentativa = 1,
): Promise<SiegEnvioResult> {
  const jwt = await getSiegJWT();

  let res: Response;
  try {
    res = await fetch(`${SIEG_BASE}/send-xml`, {
      method: "POST",
      headers: {
        "Authorization":   `Bearer ${jwt}`,
        "X-OAuth-Token":   oauthToken,
        "Content-Type":    "text/xml; charset=utf-8",
      },
      body: xmlContent,
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: null,
      erro: `Falha de rede ao chamar SIEG: ${(err as Error).message}`,
    };
  }

  // JWT expirado — renova e tenta uma vez mais
  if (res.status === 401 && tentativa === 1) {
    await renovarSiegJWT();
    return siegEnviarXml(oauthToken, xmlContent, 2);
  }

  // Rate limit — sinaliza para o caller implementar back-off
  if (res.status === 429) {
    return {
      ok: false,
      status: 429,
      body: null,
      erro: "Rate limit SIEG (429). Aguarde antes de tentar novamente.",
    };
  }

  let body: unknown;
  const ct = res.headers.get("content-type") ?? "";
  try {
    body = ct.includes("json") ? await res.json() : await res.text();
  } catch {
    body = null;
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      body,
      erro: `SIEG HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`,
    };
  }

  return { ok: true, status: res.status, body };
}

// ─── Teste de conexão ─────────────────────────────────────────────────────────

/**
 * Valida as credenciais do sistema integrador (env vars) gerando um JWT.
 * Não faz envio de XML — só testa autenticação nível 1.
 */
export async function siegTestarConexaoJWT(): Promise<{ ok: boolean; erro?: string }> {
  try {
    await renovarSiegJWT(); // força nova geração para testar agora
    return { ok: true };
  } catch (err) {
    return { ok: false, erro: (err as Error).message };
  }
}
