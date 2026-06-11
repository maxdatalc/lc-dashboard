import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getLojaDbConfig } from '@/lib/db/tenants'
import { queryBridge, queryDev, BridgeError, type BridgeConfig } from '@/lib/mssql/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveConfig(lojaId: string | null): Promise<BridgeConfig | null> {
  if (process.env.MSSQL_HOST) return null
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

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const start  = searchParams.get('start')  ?? new Date().toISOString().split('T')[0]
  const end    = searchParams.get('end')    ?? start
  const type   = searchParams.get('type')
  const lojaId = searchParams.get('lojaId') ?? null

  if (lojaId && !(await assertLojaAccess(user.id, lojaId))) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  try {
    const config = await resolveConfig(lojaId)

    switch (type) {
      case 'faturamento-mensal': {
        const rows = await run<{ mes: string; total: number; qtd: number }>(config, `
          SELECT
            FORMAT(vedFechamento, 'yyyy-MM')             AS mes,
            ISNULL(SUM(vedTotalNf), 0)                   AS total,
            COUNT(*)                                     AS qtd
          FROM venda
          WHERE vedStatus IN ('F','C')
            AND vedTipo IN ('OS','VE')
            AND vedFechamento >= DATEADD(month, -11, DATEFROMPARTS(YEAR(@start), MONTH(@start), 1))
            AND CONVERT(date, vedFechamento) <= @end
          GROUP BY FORMAT(vedFechamento, 'yyyy-MM')
          ORDER BY mes
        `, { start, end })

        return NextResponse.json(rows.map(r => ({
          mes: r.mes.slice(5),
          mesCompleto: r.mes,
          vendas: Number(r.total),
          devolucoes: 0,
          vendaLiquidaDevolucao: Number(r.total),
        })))
      }

      case 'top-servicos': {
        const rows = await run<{ nome: string; valor: number; quantidade: number }>(config, `
          SELECT TOP 10
            vi.vdiProNome                              AS nome,
            ISNULL(SUM(vi.vdiQtde * vi.vdiValor), 0) AS valor,
            ISNULL(SUM(vi.vdiQtde), 0)               AS quantidade
          FROM vendaItem vi
          JOIN venda v ON vi.vdiVedId = v.vedId
          WHERE v.vedStatus IN ('F','C')
            AND v.vedTipo IN ('OS','VE')
            AND vi.vdiCancel = 0
            AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
          GROUP BY vi.vdiProNome
          ORDER BY valor DESC
        `, { start, end })

        return NextResponse.json(rows.map(r => ({
          nome: r.nome,
          valor: Number(r.valor),
          quantidade: Number(r.quantidade),
        })))
      }

      case 'top-clientes': {
        const rows = await run<{ nome: string; total: number; compras: number; ultimaCompra: string }>(config, `
          SELECT TOP 10
            c.cliNome                           AS nome,
            ISNULL(SUM(v.vedTotalNf), 0)       AS total,
            COUNT(*)                            AS compras,
            MAX(v.vedFechamento)                AS ultimaCompra
          FROM venda v
          JOIN cliente c ON v.vedClienteId = c.cliId
          WHERE v.vedStatus IN ('F','C')
            AND v.vedTipo IN ('OS','VE')
            AND c.cliTipoCad = 0
            AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
          GROUP BY c.cliNome
          ORDER BY total DESC
        `, { start, end })

        return NextResponse.json(rows.map(r => ({
          nome: r.nome,
          total: Number(r.total),
          compras: Number(r.compras),
          ticketMedio: Number(r.compras) > 0 ? Number(r.total) / Number(r.compras) : 0,
          ultimaCompra: r.ultimaCompra ? new Date(r.ultimaCompra).toISOString().split('T')[0] : '',
          tipoPessoa: 'PF' as const,
        })))
      }

      case 'top-tecnicos': {
        const rows = await run<{ vendedorId: number; nome: string; valor: number; quantidade: number }>(config, `
          SELECT TOP 10
            c.cliId                             AS vendedorId,
            c.cliNome                           AS nome,
            ISNULL(SUM(v.vedTotalNf), 0)       AS valor,
            COUNT(*)                            AS quantidade
          FROM venda v
          JOIN cliente c ON v.vedAtendente = c.cliId
          WHERE v.vedStatus IN ('F','C')
            AND v.vedTipo IN ('OS','VE')
            AND CONVERT(date, v.vedFechamento) BETWEEN @start AND @end
          GROUP BY c.cliId, c.cliNome
          ORDER BY valor DESC
        `, { start, end })

        return NextResponse.json(rows.map(r => ({
          vendedorId: Number(r.vendedorId),
          nome: r.nome,
          valor: Number(r.valor),
          quantidade: Number(r.quantidade),
          ticketMedio: Number(r.quantidade) > 0 ? Number(r.valor) / Number(r.quantidade) : 0,
        })))
      }

      case 'status-os': {
        const rows = await run<{ status: string; qtd: number; total: number }>(config, `
          SELECT
            ISNULL(t.tatDesc, CONCAT('Tipo ', v.vedTipoAtend)) AS status,
            COUNT(*)                                            AS qtd,
            ISNULL(SUM(v.vedTotalNf), 0)                      AS total
          FROM venda v
          LEFT JOIN tipoAtend t ON v.vedTipoAtend = t.tatId
          WHERE v.vedTipo = 'OS'
            AND v.vedStatus NOT IN ('Z')
            AND CONVERT(date, v.vedAbertura) BETWEEN @start AND @end
          GROUP BY v.vedTipoAtend, t.tatDesc
          ORDER BY qtd DESC
        `, { start, end })

        return NextResponse.json(rows.map(r => ({
          status: r.status,
          qtd: Number(r.qtd),
          total: Number(r.total),
        })))
      }

      default:
        return NextResponse.json({ error: 'type inválido' }, { status: 400 })
    }
  } catch (e) {
    console.error('[batauto/charts]', e)
    const msg = e instanceof BridgeError ? e.message : 'Erro ao consultar banco'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
