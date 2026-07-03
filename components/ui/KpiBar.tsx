'use client'

import type { CSSProperties, ReactNode } from 'react'

interface KpiBarProps {
  // Venda Total
  faturamento: number
  totalVendas: number
  totalVendasAnt: number
  faturamentoChange: number | null
  devolucaoTotal: number
  totalDevolucoes: number
  // Custo
  custo: number
  custoPercentReceita: number
  custoPercentReceitaAnt: number
  // Ticket Médio
  ticketMedio: number
  ticketMedioChange: number | null
  // Lucro
  lucro: number
  margem: number
  margemAnt: number
  // Clientes
  totalClientes: number
  novosClientes: number
  recorrentesClientes: number
  // Em Aberto (estático)
  emAbertoQtd: number
  emAbertoValor: number
  isLoading?: boolean
}

// ─── Formatadores ────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v)

const fmtCompact = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

const fmtNum = (v: number) => new Intl.NumberFormat('pt-BR').format(Math.round(v))

// ─── Estilos base ────────────────────────────────────────────────────────────

const LABEL: CSSProperties = {
  fontSize: '9px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--text-primary)',
  marginBottom: 4,
  fontFamily: 'var(--font-body)',
  lineHeight: 1,
}

const STRIP: CSSProperties = {
  borderLeft: '1px solid var(--border-subtle)',
  flex: 1,
  minWidth: 130,
  padding: '11px 14px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 3,
}

const VALUE_LARGE: CSSProperties = {
  fontFamily: 'var(--font-numeric)',
  fontSize: 'clamp(18px, 2vw, 28px)',
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.1,
  letterSpacing: '-0.01em',
}

const VALUE_STRIP: CSSProperties = {
  fontFamily: 'var(--font-numeric)',
  fontSize: 'clamp(13px, 1.3vw, 17px)',
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.1,
}

// ─── Componentes auxiliares ──────────────────────────────────────────────────

function Pill({
  value,
  suffix = '%',
  positiveIsGood = true,
}: {
  value: number | null
  suffix?: string
  positiveIsGood?: boolean
}) {
  if (value === null || !isFinite(value)) return null
  const good = positiveIsGood ? value > 0 : value < 0
  const bad  = positiveIsGood ? value < 0 : value > 0
  const color = good ? '#10b981' : bad ? '#ef4444' : 'var(--text-muted)'
  const bg    = good ? 'rgba(16,185,129,0.12)' : bad ? 'rgba(239,68,68,0.12)' : 'rgba(128,128,128,0.08)'
  const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '→'
  return (
    <span style={{
      fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: 4,
      background: bg, color, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
      display: 'inline-block',
    }}>
      {arrow} {Math.abs(value).toFixed(1).replace('.', ',')}{suffix}
    </span>
  )
}

function Badge({
  children,
  color = 'rgba(128,128,128,0.12)',
  textColor = 'var(--text-primary)',
}: {
  children: ReactNode
  color?: string
  textColor?: string
}) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: 4,
      background: color, color: textColor, fontFamily: 'var(--font-body)',
      whiteSpace: 'nowrap', display: 'inline-block',
    }}>
      {children}
    </span>
  )
}

function Sub({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonBar() {
  return (
    <div
      className="rounded-xl overflow-hidden mb-3"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div style={{ display: 'flex', minHeight: 80, overflowX: 'auto' }}>
        {/* Spotlight skeleton */}
        <div style={{ padding: '12px 16px', width: '30%', minWidth: 180, borderRight: '1px solid var(--border-subtle)' }}>
          <div className="shimmer rounded mb-3" style={{ height: 9, width: 72 }} />
          <div className="shimmer rounded mb-2" style={{ height: 28, width: '80%' }} />
          <div className="shimmer rounded mb-1" style={{ height: 10, width: 100 }} />
          <div className="shimmer rounded" style={{ height: 10, width: 80 }} />
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ ...STRIP, minWidth: 130 }}>
            <div className="shimmer rounded mb-2" style={{ height: 9, width: 56 }} />
            <div className="shimmer rounded mb-1" style={{ height: 17, width: 88 }} />
            <div className="shimmer rounded" style={{ height: 10, width: 64 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

export function KpiBar({
  faturamento,
  totalVendas,
  totalVendasAnt,
  faturamentoChange,
  devolucaoTotal,
  totalDevolucoes,
  custo,
  custoPercentReceita,
  custoPercentReceitaAnt,
  ticketMedio,
  ticketMedioChange,
  lucro,
  margem,
  margemAnt,
  totalClientes,
  novosClientes,
  recorrentesClientes,
  emAbertoQtd,
  emAbertoValor,
  isLoading = false,
}: KpiBarProps) {
  if (isLoading) return <SkeletonBar />

  const lucroPositivo  = lucro >= 0
  const margemPP       = margem - margemAnt          // variação em pp (positivo = bom)
  const custoPP        = custoPercentReceita - custoPercentReceitaAnt  // positivo = ruim (custo subiu)
  const margemValida   = isFinite(margem)
  const custoPercValido = isFinite(custoPercentReceita) && custoPercentReceita > 0

  return (
    <div
      className="rounded-xl overflow-hidden mb-3"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div style={{ display: 'flex', minHeight: 80, alignItems: 'stretch', overflowX: 'auto' }}>

        {/* ── SPOTLIGHT: VENDA TOTAL ─────────────────────────── */}
        <div style={{
          width: '30%', minWidth: 200, flexShrink: 0,
          borderRight: '1px solid var(--border-subtle)',
          padding: '11px 16px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3,
        }}>
          <p style={LABEL}>Venda Total</p>

          {/* Valor + pill de variação */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ ...VALUE_LARGE, color: 'var(--accent-green)' }}>
              {fmt(faturamento)}
            </span>
            <Pill value={faturamentoChange} positiveIsGood={true} />
          </div>

          {/* Contagens atual e anterior */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Sub>{fmtNum(totalVendas)} vendas no período</Sub>
            {totalVendasAnt > 0 && (
              <Sub>
                <span style={{ color: 'var(--text-muted)' }}>
                  {fmtNum(totalVendasAnt)} no período anterior
                </span>
              </Sub>
            )}
          </div>

          {/* Devoluções (apenas se existirem) */}
          {devolucaoTotal > 0 && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 1 }}>
              <span style={{ fontFamily: 'var(--font-numeric)', fontSize: '12px', color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
                − {fmt(devolucaoTotal)}
              </span>
              <span style={{ fontSize: '10px', color: '#ef4444' }}>
                {fmtNum(totalDevolucoes)} devol.
              </span>
            </div>
          )}
        </div>

        {/* ── LUCRO BRUTO ──────────────────────────────────────── */}
        <div style={STRIP}>
          <p style={LABEL}>Lucro Bruto</p>
          <span style={{ ...VALUE_STRIP, color: lucroPositivo ? 'var(--accent-green)' : '#ef4444' }}>
            {fmt(lucro)}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            {margemValida && (
              <Badge
                color={lucroPositivo ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}
                textColor={lucroPositivo ? '#10b981' : '#ef4444'}
              >
                {lucroPositivo ? '↑' : '↓'} {margem.toFixed(1).replace('.', ',')}% margem
              </Badge>
            )}
            {margemValida && isFinite(margemPP) && margemAnt > 0 && (
              <span style={{ fontSize: '11px', color: margemPP >= 0 ? '#10b981' : '#ef4444', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
                {margemPP >= 0 ? '↑' : '↓'} {Math.abs(margemPP).toFixed(1).replace('.', ',')}pp vs ant.
              </span>
            )}
          </div>
        </div>

        {/* ── CUSTO TOTAL ──────────────────────────────────────── */}
        <div style={STRIP}>
          <p style={LABEL}>Custo Total</p>
          <span style={{ ...VALUE_STRIP, color: 'var(--text-primary)' }}>
            {custo > 0 ? fmt(custo) : '—'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            {custoPercValido && (
              <Badge color="rgba(245,158,11,0.12)" textColor="#f59e0b">
                ● {custoPercentReceita.toFixed(1).replace('.', ',')}% da receita
              </Badge>
            )}
            {custoPercValido && isFinite(custoPP) && custoPercentReceitaAnt > 0 && (
              <span style={{
                fontSize: '11px',
                color: custoPP <= 0 ? '#10b981' : '#ef4444',
                fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
              }}>
                {custoPP <= 0 ? '↓' : '↑'} {Math.abs(custoPP).toFixed(1).replace('.', ',')}pp
              </span>
            )}
          </div>
        </div>

        {/* ── TICKET MÉDIO ─────────────────────────────────────── */}
        <div style={STRIP}>
          <p style={LABEL}>Ticket Médio</p>
          <span style={{ ...VALUE_STRIP, color: 'var(--text-primary)' }}>
            {fmt(ticketMedio)}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <Pill value={ticketMedioChange} positiveIsGood={true} />
            {totalVendas > 0 && (
              <Sub>{fmtNum(totalVendas)} pedidos</Sub>
            )}
          </div>
        </div>

        {/* ── CLIENTES NO PERÍODO ──────────────────────────────── */}
        <div style={STRIP}>
          <p style={LABEL}>Clientes no Período</p>
          <span style={{ ...VALUE_STRIP, fontSize: 'clamp(17px, 1.6vw, 22px)', color: 'var(--text-primary)' }}>
            {fmtNum(totalClientes)}
          </span>
          {(novosClientes > 0 || recorrentesClientes > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              {novosClientes > 0 && (
                <Badge color="rgba(59,130,246,0.12)" textColor="#3b82f6">
                  Novos {fmtNum(novosClientes)}
                </Badge>
              )}
              {recorrentesClientes > 0 && (
                <Badge color="rgba(99,102,241,0.12)" textColor="#818cf8">
                  Recorrentes {fmtNum(recorrentesClientes)}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* ── EM ABERTO (estático) ─────────────────────────────── */}
        <div style={{
          ...STRIP,
          borderRight: 'none',
          background: emAbertoQtd > 0 ? 'rgba(245,158,11,0.04)' : 'transparent',
        }}>
          <p style={LABEL}>Em Aberto</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              ...VALUE_STRIP,
              fontSize: 'clamp(17px, 1.6vw, 22px)',
              color: emAbertoQtd > 0 ? '#f59e0b' : 'var(--text-muted)',
            }}>
              {fmtNum(emAbertoQtd)}
            </span>
            {emAbertoQtd > 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                pedidos pendentes
              </span>
            )}
          </div>
          {emAbertoQtd === 0 && (
            <Sub>sem pendências</Sub>
          )}
          {emAbertoValor > 0 && (
            <Sub>
              <span style={{ color: '#f59e0b', fontFamily: 'var(--font-numeric)', fontVariantNumeric: 'tabular-nums' }}>
                {fmtCompact(emAbertoValor)}
              </span>
              {' '}valor total em aberto
            </Sub>
          )}
        </div>

      </div>
    </div>
  )
}
