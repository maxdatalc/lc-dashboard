// Cliente HTTP para a API REST MaxManager — versão Deno (sem Node.js)
// Fetch nativo disponível globalmente, AbortSignal.timeout() nativo do Deno

export interface MaxDataConfig {
  baseUrl: string;
  empId: number;
  terminal: string; // segredo — não logar
}

interface PaginatedResponse<T> {
  docs: T[];
  pages: number;
  total: number;
}

export async function getMaxDataToken(config: MaxDataConfig): Promise<string> {
  const response = await fetch(`${config.baseUrl}/v2/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ empId: config.empId, terminal: config.terminal }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Falha na autenticação MaxData: HTTP ${response.status}`);
  }

  const data = await response.json() as { token: string };
  return data.token;
}

export async function maxdataGet<T>(
  token: string,
  baseUrl: string,
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${baseUrl}/v2${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status === 401) throw new Error("Token expirado");
  if (!response.ok) {
    throw new Error(`Erro MaxData ${path}: HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Limite de 80 páginas por invocação (máx ~96s no free tier)
// Sync incremental de 25min raramente ultrapassa 10 páginas
export async function fetchAllPages<T>(
  token: string,
  baseUrl: string,
  path: string,
  params: Record<string, string> = {},
  maxPages = 80
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;

  while (true) {
    const data = await maxdataGet<PaginatedResponse<T>>(token, baseUrl, path, {
      ...params,
      page: String(page),
      limit: "50",
    });

    if (!data.docs || data.docs.length === 0) break;

    results.push(...data.docs);

    if (page >= (data.pages ?? 1)) break;

    page++;

    // Parar se atingir o limite de páginas por invocação
    if (page > maxPages) break;

    // Pausa entre páginas para não sobrecarregar a API local da loja
    await new Promise((r) => setTimeout(r, 80));
  }

  return results;
}
