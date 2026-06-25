'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface ActiveFilter {
  type: 'vendedor' | 'produto' | 'cliente' | 'grupo' | 'tipo' | 'formaPagamento'
  id: number | string
  label: string
}

interface FilterContextType {
  activeFilter: ActiveFilter | null
  setFilter: (filter: ActiveFilter | null) => void
  clearFilter: () => void
}

const FilterContext = createContext<FilterContextType>({
  activeFilter: null,
  setFilter: () => {},
  clearFilter: () => {},
})

export function FilterProvider({ children }: { children: ReactNode }) {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(null)

  return (
    <FilterContext.Provider value={{
      activeFilter,
      setFilter: setActiveFilter,
      clearFilter: () => setActiveFilter(null),
    }}>
      {children}
    </FilterContext.Provider>
  )
}

export const useFilter = () => useContext(FilterContext)
