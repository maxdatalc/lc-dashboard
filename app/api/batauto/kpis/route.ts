import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getLojaDbConfig } from '@/lib/db/tenants'
import { queryBridge, queryDev, BridgeError, type BridgeConfig } from '@/lib/mssql/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveConfig(lojaId: string | null): Promise<BridgeConfig | null> {
  if (process.env.MSSQL_HOST) return null  // dev local: queryDev
  if (!lojaId) return null
  return getLojaDbConfig(lojaId)
}

async function run<T>(
  config: BridgeConfig | null,
  queryStr: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  if (!config) return queryDev<T>(queryStr, params)
  return queryBridge<T>(config, queryStr, params)
}

async function assertLojaAccess(userId: string, lojaId: string): Promise<boolean> {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: profile } = await admin
    .from('profiles').select('is_system_admin').eq('id', userId).maybeSingle()

  if ((profile as { is_system_admin?: boolean } | null)?.is_system_admin) return true

  const { data: loja } = await admin
    .from('lojas').select('tenant_id').eq('id', lojaId).maybeSingle()
  if (!loja) return false

  const { data: access } = await admin
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('tenant_id', (loja as { tenant_id: string }).tenant_id)
    .maybeSingle()

  return !!access
}

function periodoAnterior(start: string, end: string) {
  const startMs = new Date(start).getTime()
  const endMs   = new Date(end).getTime()
  const dur     = endMs - startMs
  const toStr   = (ms: number) => new Date(ms).toISOString().split('T')[0]
  return { start: toStr(startMs - dur - 86400000), end: toStr(startMs - 86400000) }
}

// ── Route ─────────────────────────────────────────────────────────────────────

interface KpiRow    { faturamento: number; totalVendas: number; ticketMedio: number; clientes: number }
interface AbertasRow { osAbertas: number }

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const start  = searchParams.get('start')  ?? new Date().toISOString().split('T')[0]
  const end    = searchParams.get('end')    ?? start
  const lojaId = searchParams.get('lojaId') ?? null
  const prev   = periodoAnterior(start, end)

  if (lojaId && !(await assertLojaAccess(user.id, lojaId))) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  try {
    const config = await resolveConfig(lojaId)

    const [atual, anterior, abertas] = await Promise.all([
      run<KpiRow>(config, `
        SELECT
          ISNULL(SUM(vedTotalNf), 0)                                                   AS faturamento,
          COUNT(*)                                                                      AS totalVendas,
          ISNULL(CASE WHEN COUNT(*) > 0 THEN SUM(vedTotalNf)/COUNT(*) ELSE 0 END, 0)  AS ticketMedio,
          COUNT(DISTINCT NULLIF(vedClienteId, 0))                                      AS clientes
        FROM venda
        WHERE vedStatus IN ('F','C')
          AND vedTipo IN ('OS','VE')
          AND CONVERT(date, vedFechamento) BETWEEN @start AND @end
      `, { start, end }),

      run<KpiRow>(config, `
        SELECT
          ISNULL(SUM(vedTotalNf), 0) AS faturamento,
          COUNT(*)                   AS totalVendas
        FROM venda
        WHERE vedStatus IN ('F','C')
          AND vedTipo IN ('OS','VE')
          AND CONVERT(date, vedFechamento) BETWEEN @start AND @end
      `, { start: prev.start, end: prev.end }),

      run<AbertasRow>(config, `
        SELECT COUNT(*) AS osAbertas
        FROM venda WHERE vedStatus = 'A' AND vedTipo = 'OS'
      `),
    ])

    const cur = atual[0]
    const prv = anterior[0]
    const pct = (a: number, b: number) => b > 0 ? ((a - b) / b) * 100 : null

    return NextResponse.json({
      faturamento:    Number(cur?.faturamento ?? 0),
      totalVendas:    Number(cur?.totalVendas ?? 0),
      ticketMedio:    Number(cur?.ticketMedio ?? 0),
      clientes:       Number(cur?.clientes ?? 0),
      osAbertas:      Number(abertas[0]?.osAbertas ?? 0),
      varFaturamento: pct(Number(cur?.faturamento ?? 0), Number(prv?.faturamento ?? 0)),
      varVendas:      pct(Number(cur?.totalVendas ?? 0), Number(prv?.totalVendas ?? 0)),
    })
  } catch (e) {
    console.error('[batauto/kpis]', e)
    const msg = e instanceof BridgeError ? e.message : 'Erro ao consultar banco'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
