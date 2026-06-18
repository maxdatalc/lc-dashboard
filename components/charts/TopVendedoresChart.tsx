'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

export interface VendedorItem {
  vendedorId: number
  nome: string
  valor: number
  quantidade: number
  ticketMedio: number
}

interface Props {
  data: VendedorItem[]
  onSelect?: (vendedorId: number | null, nome: string | null) => void
  selectedId?: number | null
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtNum = (v: number) =>
  new Intl.NumberFormat('pt-BR').format(Math.round(v))

// Paleta de cores por posição no ranking
const CORES = [
  '#f59e0b', '#94a3b8', '#a78bfa', '#00e5ff',
  '#10b981', '#f97316', '#ec4899', '#3b82f6',
  '#84cc16', '#e11d48',
]

export function TopVendedoresChart({ data, onSelect, selectedId }: Props) {
  const [modo, setModo] = useState<'valor' | 'qtd'>('valor')

  if (!data.length) {
    return (
      <div style={{
        textAlign: 'center', padding: '40px 0',
        color: 'var(--text-muted)', fontSize: '13px',
      }}>
        Sem dados de vendedores no período
      </div>
    )
  }

  const lista = [...data].sort((a, b) =>
    modo === 'valor' ? b.valor - a.valor : b.quantidade - a.quantidade
  )

  const maxValor = lista[0]?.valor ?? 1
  const maxQtd = lista[0]?.quantidade ?? 1

  return (
    <div>
      {/* Toggle Valor/Qtd */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {(['valor', 'qtd'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModo(m)}
            style={{
              padding: '3px 10px', borderRadius: '20px',
              fontSize: '12px', fontWeight: 500,
              border: '1px solid', cursor: 'pointer',
              background: modo === m ? 'var(--accent-cyan)' : 'transparent',
              borderColor: modo === m ? 'var(--accent-cyan)' : 'var(--toggle-inactive-border)',
              color: modo === m ? '#0a0f1e' : 'var(--toggle-inactive-color)',
              transition: 'all 0.15s',
            }}
          >
            {m === 'valor' ? 'Valor' : 'Qtd'}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="custom-scroll" style={{ height: '210px', overflowY: 'auto', paddingRight: '4px' }}>
        {lista.map((v, i) => {
          const isSelected = selectedId === v.vendedorId
          const cor = CORES[i] ?? '#475569'
          const barraWidth = modo === 'valor'
            ? (v.valor / maxValor) * 100
            : (v.quantidade / maxQtd) * 100

          return (
            <div
              key={v.vendedorId}
              onClick={() => onSelect?.(isSelected ? null : v.vendedorId, isSelected ? null : v.nome)}
              style={{
                position: 'relative',
                borderRadius: '6px',
                padding: '6px 8px',
                marginBottom: '4px',
                cursor: onSelect ? 'pointer' : 'default',
                background: isSelected ? 'var(--sidebar-item-active-bg)' : 'transparent',
                border: isSelected
                  ? '1px solid rgba(0,229,255,0.3)'
                  : '1px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              {isSelected && onSelect && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSelect(null, null); }}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'rgba(239,68,68,0.18)',
                    color: '#ef4444',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <X size={10} />
                </button>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Badge ranking */}
                <span style={{
                  fontSize: '11px', fontWeight: 700,
                  minWidth: '24px', flexShrink: 0,
                  color: cor, fontFamily: 'var(--font-numeric)',
                }}>
                  #{i + 1}
                </span>

                {/* Avatar com inicial */}
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  flexShrink: 0, display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                  background: `${cor}22`, color: cor,
                  fontSize: '11px', fontWeight: 700,
                }}>
                  {v.nome.charAt(0).toUpperCase()}
                </div>

                {/* Nome + barra de progresso */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '12px', fontWeight: 500,
                    color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', marginBottom: '4px',
                  }}>
                    {v.nome}
                  </div>
                  <div style={{ height: '3px', background: 'var(--chart-track-bg)', borderRadius: '2px' }}>
                    <div style={{
                      width: `${barraWidth}%`, height: '100%',
                      borderRadius: '2px', background: cor,
                      transition: 'width 0.8s ease',
                    }} />
                  </div>
                </div>

                {/* Valor e subtítulo */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontSize: '13px', fontWeight: 600,
                    color: 'var(--text-primary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {modo === 'valor' ? fmt(v.valor) : `${fmtNum(v.quantidade)} vdas`}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {modo === 'valor'
                      ? `${fmtNum(v.quantidade)} vendas`
                      : `TM: ${fmt(v.ticketMedio)}`}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
