"use client";

import { useLayoutEffect, useRef, useState } from "react";

interface FitTextOptions {
  /** Tamanho de fonte inicial/máximo, em px. */
  max: number;
  /** Piso — nunca encolhe além disso (garante legibilidade mínima). */
  min: number;
}

/**
 * Encolhe o fontSize de um elemento até caber em uma linha, sem quebrar.
 * Resolve o caso que `clamp()` baseado em `vw` não cobre: o clamp só sabe a
 * largura da JANELA, não a largura real do card (que varia com o número de
 * colunas do grid — 6 no desktop vs. 2 no mobile). Compara `scrollWidth`
 * (largura do conteúdo, com `white-space:nowrap`) contra `clientWidth` (a
 * largura do próprio box, definida pelo container via flex/block stretch) —
 * funciona independente da estrutura do pai. Reage a resize/zoom via
 * ResizeObserver no próprio elemento.
 *
 * Uso: const { ref, fontSize } = useFitText(value, { max: 27, min: 14 });
 * <p ref={ref} style={{ fontSize, whiteSpace: "nowrap" }}>{value}</p>
 */
export function useFitText<T extends HTMLElement>(text: string, { max, min }: FitTextOptions) {
  const ref = useRef<T>(null);
  const [fontSize, setFontSize] = useState(max);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    function fit() {
      if (!el) return;
      // Sempre remedir a partir do máximo — o texto pode ter encurtado ou o
      // card pode ter crescido desde a última medição.
      let size = max;
      el.style.fontSize = `${size}px`;
      while (el.scrollWidth > el.clientWidth && size > min) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
      setFontSize(size);
    }

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, max, min]);

  return { ref, fontSize };
}
