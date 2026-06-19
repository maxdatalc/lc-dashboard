import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";

function isSafeUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    const h = u.hostname.toLowerCase();
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(h)) return false;
    const blocked = ["169.254.", "127.", "localhost", "metadata.google"];
    return !blocked.some((b) => h === b || h.startsWith(b));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, erro: "Não autenticado" }, { status: 401 });

  const admin = await isSystemAdmin(user.id);
  if (!admin) return NextResponse.json({ success: false, erro: "Acesso negado" }, { status: 403 });

  const body = (await req.json()) as { maxApiUrl?: string; terminal?: string; empId?: number };
  const { maxApiUrl, terminal, empId } = body;

  if (!maxApiUrl || !terminal || empId == null) {
    return NextResponse.json({ success: false, erro: "maxApiUrl, terminal e empId são obrigatórios" });
  }

  if (!isSafeUrl(maxApiUrl)) {
    return NextResponse.json({ success: false, erro: "URL inválida ou não permitida" });
  }

  const baseUrl = maxApiUrl.replace(/\/$/, "");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);

  try {
    const res = await fetch(`${baseUrl}/v2/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empid: empId, terminal }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      return NextResponse.json({
        success: true,
        info: `Token obtido com sucesso (HTTP ${res.status}). MaxAPI acessível.`,
      });
    }

    const text = await res.text().catch(() => "");
    return NextResponse.json({
      success: false,
      erro: `MaxAPI respondeu HTTP ${res.status}: ${text.slice(0, 200)}`,
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error).name === "AbortError") {
      return NextResponse.json({ success: false, erro: "Timeout: MaxAPI não respondeu em 15s" });
    }
    return NextResponse.json({
      success: false,
      erro: err instanceof Error ? err.message : "Erro desconhecido",
    });
  }
}
