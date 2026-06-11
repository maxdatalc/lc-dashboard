/**
 * Cliente HTTP para a lc-sql-bridge.
 * O Next.js nunca conecta diretamente ao SQL Server do cliente —
 * toda query passa pela bridge rodando na máquina do cliente.
 */

export interface BridgeConfig {
  bridgeUrl: string  // ex: https://sql-sempretemdetudo.lctecnologias.com.br
  token: string      // bearer token descriptografado
}

export class BridgeError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message)
    this.name = 'BridgeError'
  }
}

/**
 * Executa uma query SELECT na bridge do cliente e retorna os registros.
 * Lança BridgeError em caso de falha de autenticação, query bloqueada ou erro SQL.
 */
export async function queryBridge<T = Record<string, unknown>>(
  config: BridgeConfig,
  queryStr: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const res = await fetch(`${config.bridgeUrl}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.token}`,
    },
    body: JSON.stringify({ sql: queryStr, params }),
    // next.js fetch cache: sem cache por padrão — cada chamada busca dados frescos
    cache: 'no-store',
  })

  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json() as { error?: string }).error ?? '' } catch (_) {}
    throw new BridgeError(
      detail || `Bridge retornou HTTP ${res.status}`,
      res.status
    )
  }

  const body = await res.json() as { rows: T[] }
  return body.rows
}

// ── Desenvolvimento local ─────────────────────────────────────────────────────
// Quando MSSQL_HOST estiver definido no .env.local, conecta diretamente ao SQL
// Server local sem passar pela bridge (útil para testes locais com BATAUTO).
// Em produção, MSSQL_HOST não deve estar definido — usa-se apenas a bridge.

let _devPool: import('mssql').ConnectionPool | null = null

export async function queryDev<T = Record<string, unknown>>(
  queryStr: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  if (!process.env.MSSQL_HOST) {
    throw new Error('queryDev: MSSQL_HOST não definido — use queryBridge em produção')
  }

  const sql = await import('mssql')

  if (!_devPool || !_devPool.connected) {
    _devPool = await sql.connect({
      server:   process.env.MSSQL_HOST,
      port:     Number(process.env.MSSQL_PORT ?? 1433),
      database: process.env.MSSQL_DATABASE,
      user:     process.env.MSSQL_USER,
      password: process.env.MSSQL_PASSWORD,
      options:  { trustServerCertificate: true, enableArithAbort: true },
      pool:     { max: 10, min: 0, idleTimeoutMillis: 30000 },
    })
  }

  const request = _devPool.request()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value)
    }
  }
  const result = await request.query(queryStr)
  return result.recordset as T[]
}
