"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const LOJA_COOKIE = "selected_loja_id";

function makeAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function selectLoja(lojaId: string): Promise<void> {
  const [supabase, cookieStore] = await Promise.all([createClient(), cookies()]);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const tenantId = cookieStore.get("selected_tenant_id")?.value;
  if (!tenantId) throw new Error("Empresa não selecionada");

  const admin = makeAdminClient();

  // Verifica que o usuário pertence ao tenant E que a loja pertence ao tenant
  const [membershipRes, lojaRes] = await Promise.all([
    admin
      .from("tenant_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    admin
      .from("lojas")
      .select("id")
      .eq("id", lojaId)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);

  if (!membershipRes.data) throw new Error("Sem acesso ao tenant");
  if (!lojaRes.data) throw new Error("Loja inválida ou sem acesso");

  cookieStore.set(LOJA_COOKIE, lojaId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  revalidatePath("/dashboard", "layout");
}

export async function getSelectedLojaId(): Promise<string | null> {
  return (await cookies()).get(LOJA_COOKIE)?.value ?? null;
}
