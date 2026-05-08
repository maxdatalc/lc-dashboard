"use server";

// Server Actions para seleção de loja ativa
// A loja selecionada é persistida num cookie httpOnly e lida pelo layout do dashboard

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const LOJA_COOKIE = "selected_loja_id";

export async function selectLoja(lojaId: string): Promise<void> {
  cookies().set(LOJA_COOKIE, lojaId, {
    httpOnly: true,
    sameSite: "lax",
    // Cookie válido por 30 dias — persiste entre sessões do navegador
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  // Revalidar o layout para refletir a nova seleção
  revalidatePath("/dashboard", "layout");
}

export async function getSelectedLojaId(): Promise<string | null> {
  return cookies().get(LOJA_COOKIE)?.value ?? null;
}
