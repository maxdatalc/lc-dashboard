// Cliente HTTP para a API REST do ERP MaxManager (MaxData)
// Gerencia autenticação com cache de token no Redis e requisições autenticadas

import { redis } from "@/lib/redis";
import type { MaxDataConfig, MaxDataTokenResponse } from "@/types";

// TTL do cache de token: 50 minutos (a API emite tokens com validade de 1 hora)
const TOKEN_TTL_SECONDS = 3000;

function buildCacheKey(empId: number): string {
  return `maxdata:token:${empId}`;
}

// Retorna um preview seguro do token para logs (nunca expõe o valor completo)
function tokenPreview(token: string): string {
  return `${token.slice(0, 20)}...`;
}

export async function getMaxDataToken(config: MaxDataConfig): Promise<string> {
  const cacheKey = buildCacheKey(config.empId);

  // Verificar cache antes de chamar a API
  const cached = await redis.get<string>(cacheKey);
  if (cached) {
    console.log(`[MaxData] Token recuperado do cache (empId=${config.empId})`);
    return cached;
  }

  // Requisição de autenticação com timeout de 10 segundos
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let data: MaxDataTokenResponse;
  try {
    const response = await fetch(`${config.baseUrl}/v2/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // terminal é tratado como segredo — não aparece em nenhum log
      body: JSON.stringify({ empId: config.empId, terminal: config.terminal }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Falha na autenticação MaxData: HTTP ${response.status}`);
    }

    data = (await response.json()) as MaxDataTokenResponse;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Timeout ao conectar à API MaxData em ${config.baseUrl}`);
    }
    if (err instanceof Error && err.message.startsWith("Falha na autenticação")) {
      throw err;
    }
    throw new Error(`Não foi possível conectar à API MaxData em ${config.baseUrl}`);
  } finally {
    clearTimeout(timeout);
  }

  // Armazenar no Redis com TTL definido
  await redis.set(cacheKey, data.token, { ex: TOKEN_TTL_SECONDS });
  console.log(
    `[MaxData] Novo token obtido e cacheado (empId=${config.empId}, preview=${tokenPreview(data.token)})`
  );

  return data.token;
}

export async function maxdataRequest<T>(
  config: MaxDataConfig,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getMaxDataToken(config);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/v2${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Timeout na requisição MaxData: ${path}`);
    }
    throw new Error(`Não foi possível conectar à API MaxData em ${config.baseUrl}`);
  } finally {
    clearTimeout(timeout);
  }

  // Token inválido ou expirado — limpar cache para forçar nova autenticação
  if (response.status === 401) {
    await redis.del(buildCacheKey(config.empId));
    console.error(`[MaxData] Token rejeitado (401) para empId=${config.empId}, cache invalidado`);
    throw new Error("Token inválido ou expirado");
  }

  if (!response.ok) {
    throw new Error(`Erro na requisição MaxData ${path}: HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}
