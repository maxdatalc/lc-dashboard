"use server";

import { cache } from "react";
import { createAdminClient, createClient } from "@/lib/supabase/server";

// Memoizado por request — só bate no DB uma vez mesmo que seja chamado várias vezes
const isSystemAdminCached = cache(async (userId: string): Promise<boolean> => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("is_system_admin")
    .eq("id", userId)
    .maybeSingle();
  return (data as { is_system_admin?: boolean } | null)?.is_system_admin === true;
});

export async function assertLojaAccess(userId: string, lojaId: string): Promise<void> {
  if (await isSystemAdminCached(userId)) return;
  const supabase = await createClient();
  const { data: ok } = await supabase.rpc("fs_user_can_access_loja", {
    _user_id: userId,
    _loja_id: lojaId,
  });
  if (!ok) throw new Error("Acesso negado a esta loja");
}

export async function assertManageLoja(userId: string, lojaId: string): Promise<void> {
  if (await isSystemAdminCached(userId)) return;
  const supabase = await createClient();
  const { data: ok } = await supabase.rpc("fs_user_can_manage_loja", {
    _user_id: userId,
    _loja_id: lojaId,
  });
  if (!ok) throw new Error("Sem permissão para gerenciar esta loja");
}
