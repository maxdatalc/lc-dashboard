export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";
import { listarStatusSync } from "@/app/actions/admin-sync";
import { SincronizacaoClient } from "./sincronizacao-client";

export default async function SincronizacaoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = await isSystemAdmin(user.id);
  if (!admin) redirect("/dashboard");

  const statusLojas = await listarStatusSync();

  return <SincronizacaoClient statusLojas={statusLojas} />;
}
