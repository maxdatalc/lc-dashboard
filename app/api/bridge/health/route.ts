import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getLojaDbConfig } from "@/lib/db/tenants";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const lojaId = cookieStore.get("selected_loja_id")?.value;

  if (!lojaId) {
    return NextResponse.json({ connected: false, reason: "no_loja" });
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
