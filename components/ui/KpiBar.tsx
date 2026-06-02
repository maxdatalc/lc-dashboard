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
        className="rounded-xl overflow-hidden mb-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex-1 p-4"
              style={{ borderRight: i < 5 ? '1px solid var(--border-subtle)' : 'none' }}
            >
              <div className="shimmer rounded mb-2" style={{ height: 11, width: 60 }} />
              <div className="shimmer rounded mb-1" style={{ height: 22, width: 130 }} />
              <div className="shimmer rounded" style={{ height: 14, width: 80 }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl overflow-hidden mb-4"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        fontFamily: 'var(--font-inter, Inter, sans-serif)',
      }}
    >
      <div className="flex">

        {/* ── VENDA ─────────────────────────────────── */}
        <div
          className="flex-1 px-5 py-4"
          style={{ borderRight: '1px solid var(--border-subtle)', minWidth: 0 }}
        >
          <p style={{
            fontSize: '11px', fontWeight: 500,
            color: 'var(--text-secondary)', textTransform: 'uppercase',
            letterSpacing: '0.06em', marginBottom: '6px',
          }}>
            Venda
          </p>

          {/* Valor principal + quantidade de vendas */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span style={{
              fontSize: 'clamp(14px, 1.8vw, 20px)', fontWeight: 700,
              color: 'var(--accent-cyan)', fontVariantNumeric: 'tabular-nums',
            }}>
              {fmt(faturamento)}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {fmtNum(totalVendas)} vendas
            </span>
          </div>

          {/* Devoluções em vermelho */}
          {devolucaoTotal > 0 && (
            <div className="flex items-baseline gap-2 flex-wrap mt-1">
              <span style={{
                fontSize: '13px', fontWeight: 600,
                color: '#ef4444', fontVariantNumeric: 'tabular-nums',
              }}>
                {fmt(devolucaoTotal)}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#ef4444', whiteSpace: 'nowrap' }}>
                {fmtNum(totalDevolucoes)} devoluções
              </span>
            </div>
          )}
        </div>

        {/* ── CUSTO ─────────────────────────────────── */}
        <div
          className="flex-1 px-5 py-4"
          style={{ borderRight: '1px solid var(--border-subtle)', minWidth: 0 }}
        >
          <p style={{
            fontSize: '11px', fontWeight: 500,
            color: 'var(--text-secondary)', textTransform: 'uppercase',
            letterSpacing: '0.06em', marginBottom: '6px',
          }}>
            Custo
          </p>
          <span style={{
            fontSize: 'clamp(14px, 1.8vw, 20px)', fontWeight: 700,
            color: 'var(--accent-cyan)', fontVariantNumeric: 'tabular-nums',
          }}>
            {custo > 0 ? fmt(custo) : '—'}
          </span>
        </div>

        {/* ── TICKET MÉDIO ──────────────────────────── */}
        <div
          className="flex-1 px-5 py-4"
          style={{ borderRight: '1px solid var(--border-subtle)', minWidth: 0 }}
        >
          <p style={{
            fontSize: '11px', fontWeight: 500,
            color: 'var(--text-secondary)', textTransform: 'uppercase',
            letterSpacing: '0.06em', marginBottom: '6px',
          }}>
            Ticket Médio
          </p>
          <span style={{
            fontSize: 'clamp(14px, 1.8vw, 20px)', fontWeight: 700,
            color: 'var(--accent-cyan)', fontVariantNumeric: 'tabular-nums',
          }}>
            {fmt(ticketMedio)}
          </span>
        </div>

        {/* ── TOTAL LUCRO ───────────────────────────── */}
        <div
          className="flex-1 px-5 py-4"
          style={{
            borderRight: '1px solid var(--border-subtle)',
            minWidth: 0,
            outline: lucroPositivo ? 'none' : '1.5px solid rgba(239,68,68,0.5)',
            outlineOffset: '-1px',
            background: lucroPositivo ? 'transparent' : 'rgba(239,68,68,0.04)',
          }}
        >
          <p style={{
            fontSize: '11px', fontWeight: 500,
            color: 'var(--text-secondary)', textTransform: 'uppercase',
            letterSpacing: '0.06em', marginBottom: '6px',
          }}>
            Total Lucro
          </p>

          {/* Valor do lucro — vermelho se negativo */}
          <span style={{
            fontSize: 'clamp(14px, 1.8vw, 20px)', fontWeight: 700,
            color: lucroPositivo ? 'var(--accent-cyan)' : '#ef4444',
            fontVariantNumeric: 'tabular-nums',
            display: 'block', marginBottom: '4px',
          }}>
            {fmt(lucro)}
          </span>

          {/* Badge de margem — nunca exibe NaN/Infinity */}
          {margemValida && (
            <span style={{
              fontSize: '12px', fontWeight: 600,
              padding: '2px 8px', borderRadius: '4px',
              display: 'inline-block',
              background: lucroPositivo ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: lucroPositivo ? '#10b981' : '#ef4444',
            }}>
              {lucroPositivo ? '↑' : '↓'} {margem.toFixed(2).replace('.', ',')}%
            </span>
          )}
        </div>

        {/* ── QTDE CLIENTES ─────────────────────────── */}
        <div className="flex-1 px-5 py-4" style={{ minWidth: 0 }}>
          <p style={{
            fontSize: '11px', fontWeight: 500,
            color: 'var(--text-secondary)', textTransform: 'uppercase',
            letterSpacing: '0.06em', marginBottom: '6px',
          }}>
            Qtde de Clientes
          </p>
          <span style={{
            fontSize: 'clamp(14px, 1.8vw, 20px)', fontWeight: 700,
            color: 'var(--accent-cyan)', fontVariantNumeric: 'tabular-nums',
          }}>
            {fmtNum(totalClientes)}
          </span>
        </div>

      </div>
    </div>
  )
}
