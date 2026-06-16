'use client'

import { useEffect, useRef, useState } from 'react'

export function TopProgressBar({ loading }: { loading: boolean }) {
  const [width, setWidth] = useState(0)
  const [opacity, setOpacity] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearAll = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  const after = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms)
    timers.current.push(t)
  }

  useEffect(() => {
    clearAll()

    if (loading) {
      setOpacity(1)
      setWidth(0)
      after(() => setWidth(18), 40)
      after(() => setWidth(45), 350)
      after(() => setWidth(68), 900)
      after(() => setWidth(80), 2000)
      after(() => setWidth(87), 4000)
    } else {
      setWidth(100)
      after(() => setOpacity(0), 280)
      after(() => setWidth(0), 680)
    }

    return clearAll
  }, [loading])

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 9999,
        pointerEvents: 'none',
        opacity,
        transition: 'opacity 0.3s ease',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${width}%`,
          background: 'linear-gradient(90deg, var(--accent-cyan) 0%, #7c3aed 100%)',
          transition: loading ? 'width 1.2s ease-out' : 'width 0.22s ease-out',
          boxShadow: '0 0 12px 1px var(--accent-cyan)',
          borderRadius: '0 2px 2px 0',
        }}
      />
    </div>
  )
}
