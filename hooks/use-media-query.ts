"use client";

import { useEffect, useState } from "react";

/**
 * Retorna se a media query casa com o viewport atual.
 * Inicia como false no servidor/primeiro render (SSR-safe) — use apenas onde
 * CSS puro não resolve, ex.: decidir entre renderizar <Drawer> ou <aside>.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
