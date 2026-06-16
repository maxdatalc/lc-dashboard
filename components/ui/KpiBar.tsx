'use client'

interface KpiBarProps {
  faturamento: number
  totalVendas: number
  devolucaoTotal: number
  totalDevolucoes: number
  custo: number
  ticketMedio: number
  lucro: number
  margem: number
  totalClientes: number
  isLoading?: boolean
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(v)

const fmtNum = (v: number) =>
  new Intl.NumberFormat('pt-BR').format(Math.round(v))

const LABEL: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: 'var(--text-muted)',
  marginBottom: '6px',
  fontFamily: 'var(--font-body)',
}

const STRIP_DIVIDER: React.CSSProperties = {
  borderLeft: '1px solid var(--border-subtle)',
  flex: 1,
  padding: '10px 14px',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
}

export function KpiBar({
  faturamento,
  totalVendas,
  devolucaoTotal,
  totalDevolucoes,
  custo,
  ticketMedio,
  lucro,
  margem,
  totalClientes,
  isLoading = false,
}: KpiBarProps) {
  const lucroPositivo = lucro >= 0
  const margemValida = !isNaN(margem) && isFinite(margem)

  if (isLoading) {
    return (
      <div
        className="rounded-xl overflow-hidden mb-3"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex" style={{ minHeight: 68 }}>
          {/* Spotlight skeleton */}
          <div className="p-4" style={{ width: '38%', borderRight: '1px solid var(--border-subtle)' }}>
            <div className="shimmer rounded mb-3" style={{ height: 10, width: 48 }} />
            <div className="shimmer rounded mb-2" style={{ height: 36, width: '80%' }} />
            <div className="shimmer rounded" style={{ height: 12, width: 100 }} />
          </div>
          {/* Strip skeletons */}
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ ...STRIP_DIVIDER }}>
              <div className="shimmer rounded mb-2" style={{ height: 10, width: 48 }} />
              <div className="shimmer rounded" style={{ height: 18, width: 80 }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl overflow-hidden mb-3"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex" style={{ minHeight: 68, alignItems: 'stretch' }}>

        {/* ── SPOTLIGHT: VENDA ─────────────────────────────── */}
        <div
          style={{
            width: '38%',
            flexShrink: 0,
            borderRight: '1px solid var(--border-subtle)',
            padding: '11px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <p style={LABEL}>Venda</p>

          {/* Número principal — grande, DM Mono */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--font-numeric)',
              fontSize: 'clamp(18px, 2.1vw, 30px)',
              fontWeight: 500,
              color: 'var(--accent-cyan)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
            }}>
              {fmt(faturamento)}
            </span>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
            }}>
              {fmtNum(totalVendas)} vendas
            </span>
          </div>

          {/* Devoluções */}
          {devolucaoTotal > 0 && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'var(--font-numeric)',
                fontSize: '13px',
                fontWeight: 500,
                color: '#ef4444',
                fontVariantNumeric: 'tabular-nums',
              }}>
                − {fmt(devolucaoTotal)}
              </span>
              <span style={{ fontSize: '11px', color: '#ef4444', whiteSpace: 'nowrap' }}>
                {fmtNum(totalDevolucoes)} devol.
              </span>
            </div>
          )}
        </div>

        {/* ── STRIP: CUSTO ──────────────────────────────────── */}
        <div style={STRIP_DIVIDER}>
          <p style={LABEL}>Custo Total</p>
          <span style={{
            fontFamily: 'var(--font-numeric)',
            fontSize: 'clamp(13px, 1.4vw, 16px)',
            fontWeight: 500,
            color: custo > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {custo > 0 ? fmt(custo) : '—'}
          </span>
        </div>

        {/* ── STRIP: TICKET MÉDIO ───────────────────────────── */}
        <div style={STRIP_DIVIDER}>
          <p style={LABEL}>Venda Média</p>
          <span style={{
            fontFamily: 'var(--font-numeric)',
            fontSize: 'clamp(13px, 1.4vw, 16px)',
            fontWeight: 500,
            color: 'var(--text-primary)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmt(ticketMedio)}
          </span>
        </div>

        {/* ── STRIP: LUCRO ──────────────────────────────────── */}
        <div
          style={{
            ...STRIP_DIVIDER,
            background: lucroPositivo ? 'transparent' : 'rgba(239,68,68,0.04)',
            outline: lucroPositivo ? 'none' : '1.5px solid rgba(239,68,68,0.3)',
            outlineOffset: '-1px',
          }}
        >
          <p style={LABEL}>Lucro</p>
          <span style={{
            fontFamily: 'var(--font-numeric)',
            fontSize: 'clamp(13px, 1.4vw, 16px)',
            fontWeight: 500,
            color: lucroPositivo ? 'var(--accent-green)' : '#ef4444',
            fontVariantNumeric: 'tabular-nums',
            display: 'block',
            marginBottom: 4,
          }}>
            {fmt(lucro)}
          </span>
          {margemValida && (
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: '4px',
              display: 'inline-block',
              background: lucroPositivo ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              color: lucroPositivo ? '#10b981' : '#ef4444',
            }}>
              {lucroPositivo ? '↑' : '↓'} {margem.toFixed(1).replace('.', ',')}%
            </span>
          )}
        </div>

        {/* ── STRIP: CLIENTES ───────────────────────────────── */}
        <div style={{ ...STRIP_DIVIDER }}>
          <p style={LABEL}>Clientes</p>
          <span style={{
            fontFamily: 'var(--font-numeric)',
            fontSize: 'clamp(13px, 1.4vw, 16px)',
            fontWeight: 500,
            color: 'var(--text-primary)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmtNum(totalClientes)}
          </span>
        </div>

      </div>
    </div>
  )
}
