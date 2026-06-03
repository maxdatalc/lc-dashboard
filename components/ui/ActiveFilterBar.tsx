'use client'

import { X } from 'lucide-react'
import { useFilter } from '@/lib/contexts/filter-context'

const LABELS: Record<string, string> = {
  vendedor: 'Vendedor',
  produto: 'Produto',
  cliente: 'Cliente',
  grupo: 'Grupo',
}

export function ActiveFilterBar() {
  const { activeFilter, clearFilter } = useFilter()
  if (!activeFilter) return null

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 mb-3 rounded-lg"
      style={{
        background: 'rgba(0,229,255,0.08)',
        border: '1px solid rgba(0,229,255,0.2)',
        fontFamily: 'var(--font-inter)',
      }}
    >
      <span style={{
        fontSize: '11px', color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        Filtro ativo:
      </span>
      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-cyan)' }}>
        {LABELS[activeFilter.type] ?? activeFilter.type} —
      </span>
      <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
        {activeFilter.label}
      </span>
      <button
        onClick={clearFilter}
        className="ml-auto flex items-center gap-1"
        style={{
          fontSize: '11px', color: 'var(--text-muted)',
          cursor: 'pointer', padding: '2px 8px',
          borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)',
          background: 'transparent', transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#ef4444'
          e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-muted)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
        }}
      >
        <X size={10} />
        <span>Limpar filtro</span>
      </button>
    </div>
  )
}
