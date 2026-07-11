import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getLojaDbConfig } from "@/lib/db/tenants";

export const dynamic = "force-dynamic";

export async function GET() {
  // Exige usuário autenticado — sem login não revela nada sobre a bridge
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ connected: false, reason: "unauthorized" });
  }

  const cookieStore = await cookies();
  const lojaId = cookieStore.get("selected_loja_id")?.value;

  if (!lojaId) {
    return NextResponse.json({ connected: false, reason: "no_loja" });
  }

  // Confirma que o usuário tem acesso a esta loja (membro do tenant ou system admin).
  // Bloqueia sondar a saúde/nome do banco de lojas de outras empresas via cookie forjado.
  const admin = createAdminClient();
  const [lojaRes, profileRes] = await Promise.all([
    admin.from("lojas").select("tenant_id").eq("id", lojaId).maybeSingle(),
    admin.from("profiles").select("is_system_admin").eq("id", user.id).maybeSingle(),
  ]);

  const loja = lojaRes.data as { tenant_id: string } | null;
  if (!loja) {
    return NextResponse.json({ connected: false, reason: "no_config" });
  }

  const isSystemAdmin =
    (profileRes.data as { is_system_admin?: boolean } | null)?.is_system_admin === true;

  if (!isSystemAdmin) {
    const { data: membership } = await admin
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("tenant_id", loja.tenant_id)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ connected: false, reason: "forbidden" });
    }
  }

  const config = await getLojaDbConfig(lojaId).catch(() => null);
  if (!config) {
    return NextResponse.json({ connected: false, reason: "no_config" });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${config.bridgeUrl}/health`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ connected: false });
    }

    const data = await res.json() as { ok?: boolean; db?: string; sql?: boolean };
    return NextResponse.json({
      connected: data.ok === true && data.sql !== false,
      dbName: data.db ?? null,
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
