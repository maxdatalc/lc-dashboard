'use client'

interface KpiBarProps {
  faturamento: number
  devolucaoTotal: number
  totalDevolucoes: number
  custo: number
  lucro: number
  margem: number
  ticketMedio: number
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
  new Intl.NumberFormat('pt-BR').format(v)

export function KpiBar({
  faturamento,
  devolucaoTotal,
  totalDevolucoes,
  custo,
  lucro,
  margem,
  ticketMedio,
  totalClientes,
  isLoading = false,
}: KpiBarProps) {
  const kpis = [
    {
      id: 'venda',
      label: 'Venda',
      valor: fmt(faturamento),
      extra: devolucaoTotal > 0
        ? {
            label: `Devolução (${fmtNum(totalDevolucoes)})`,
            valor: fmt(devolucaoTotal),
            cor: '#ef4444',
          }
        : null,
      badge: null as { valor: string; positivo: boolean } | null,
    },
    {
      id: 'custo',
      label: 'Custo',
      valor: custo > 0 ? fmt(custo) : '—',
      extra: null,
      badge: null as { valor: string; positivo: boolean } | null,
    },
    {
      id: 'lucro',
      label: 'Total lucro',
      valor: fmt(lucro),
      badge: {
        valor: `${margem.toFixed(2).replace('.', ',')}%`,
        positivo: margem >= 0,
      },
      extra: null,
    },
    {
      id: 'ticket',
      label: 'Ticket médio',
      valor: fmt(ticketMedio),
      extra: null,
      badge: null as { valor: string; positivo: boolean } | null,
    },
    {
      id: 'clientes',
      label: 'Qtde de Clientes',
      valor: fmtNum(totalClientes),
      extra: null,
      badge: null as { valor: string; positivo: boolean } | null,
    },
  ]

  if (isLoading) {
    return (
      <div
        className="rounded-xl overflow-hidden mb-4"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex">
          {kpis.map((_, i) => (
            <div
              key={i}
              className="flex-1 p-4"
              style={{
                borderRight: i < kpis.length - 1
                  ? '1px solid var(--border-subtle)'
                  : 'none',
              }}
            >
              <div className="shimmer rounded mb-2" style={{ height: 12, width: 60 }} />
              <div className="shimmer rounded" style={{ height: 24, width: 120 }} />
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
        {kpis.map((kpi, i) => (
          <div
            key={kpi.id}
            className="flex-1 px-5 py-4"
            style={{
              borderRight: i < kpis.length - 1
                ? '1px solid var(--border-subtle)'
                : 'none',
              minWidth: 0,
            }}
          >
            {/* Label */}
            <p
              className="mb-1.5"
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {kpi.label}
            </p>

            {/* Valor principal + badge de margem */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                style={{
                  fontSize: 'clamp(14px, 1.8vw, 20px)',
                  fontWeight: 700,
                  color: 'var(--accent-cyan)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.2,
                }}
              >
                {kpi.valor}
              </span>

              {kpi.badge && (
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: kpi.badge.positivo
                      ? 'rgba(16,185,129,0.15)'
                      : 'rgba(239,68,68,0.15)',
                    color: kpi.badge.positivo ? '#10b981' : '#ef4444',
                  }}
                >
                  {kpi.badge.positivo ? '↑' : '↓'} {kpi.badge.valor}
                </span>
              )}
            </div>

            {/* Extra (devolução) */}
            {kpi.extra && (
              <div className="mt-1.5">
                <p
                  style={{
                    fontSize: '11px',
                    color: kpi.extra.cor,
                    fontWeight: 500,
                  }}
                >
                  {kpi.extra.label}
                </p>
                <p
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: kpi.extra.cor,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {kpi.extra.valor}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
