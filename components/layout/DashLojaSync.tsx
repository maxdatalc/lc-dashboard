"use client";

import { useEffect } from "react";

export const DASH_LOJA_KEY = "dash:selected_loja_id";

export function DashLojaSync({ lojaId }: { lojaId: string | null }) {
  useEffect(() => {
    if (lojaId) localStorage.setItem(DASH_LOJA_KEY, lojaId);
    else localStorage.removeItem(DASH_LOJA_KEY);
  }, [lojaId]);

  return null;
}
