import { updateSession } from "@/lib/supabase/middleware-client";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ── Domínios configuráveis via env ────────────────────────────────────────────
const ADMIN_DOMAIN  = process.env.ADMIN_DOMAIN  ?? "admpainel.lcgestor.com.br";
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL   ?? "https://app.lcgestor.com.br";
const ADMIN_URL     = process.env.NEXT_PUBLIC_ADMIN_URL ?? "https://admpainel.lcgestor.com.br";
const IS_DEV        = process.env.NODE_ENV === "development";

function onAdminDomain(host: string): boolean {
  return host === ADMIN_DOMAIN || host.startsWith("admpainel.");
}

// Helper: cria cliente Supabase sem cookies (service role, para verificar perfil)
function makeAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const host   = request.headers.get("host") ?? "";
  const isAdmin = onAdminDomain(host);

  // ── 1. Roteamento por subdomínio (só em produção) ─────────────────────────
  if (!IS_DEV) {
    if (isAdmin) {
      // admpainel.lcgestor.com.br → apenas rotas /admin e /login
      if (pathname === "/") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      if (pathname.startsWith("/dashboard")) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
    } else {
      // app.lcgestor.com.br → bloqueia /admin
      if (pathname.startsWith("/admin")) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  // ── 2. Rotas protegidas — exigem sessão ───────────────────────────────────
  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ── 3. Já logado e tentando acessar /login ────────────────────────────────
  if (pathname === "/login" && user) {
    const adminClient = makeAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("is_system_admin")
      .eq("id", user.id)
      .maybeSingle();

    const isSysAdmin = (profile as { is_system_admin?: boolean } | null)?.is_system_admin === true;

    // Admin vai sempre para /admin
    if (isSysAdmin) {
      return IS_DEV
        ? NextResponse.redirect(new URL("/admin", request.url))
        : NextResponse.redirect(`${ADMIN_URL}/admin`);
    }

    // Não-admin: só redireciona para /dashboard se o cookie de empresa estiver presente.
    // Se o cookie expirou, deixa o usuário chegar na tela de login para re-selecionar empresa.
    const hasTenantCookie = !!request.cookies.get("selected_tenant_id")?.value;
    if (hasTenantCookie) {
      return IS_DEV
        ? NextResponse.redirect(new URL("/dashboard", request.url))
        : NextResponse.redirect(`${APP_URL}/dashboard`);
    }

    return supabaseResponse;
  }

  // ── 4. Rotas /admin exigem is_system_admin ────────────────────────────────
  if (pathname.startsWith("/admin") && user) {
    const adminClient = makeAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("is_system_admin")
      .eq("id", user.id)
      .maybeSingle();

    const isSysAdmin = (profile as { is_system_admin?: boolean } | null)?.is_system_admin === true;

    if (!isSysAdmin) {
      return IS_DEV
        ? NextResponse.redirect(new URL("/dashboard", request.url))
        : NextResponse.redirect(`${APP_URL}/dashboard`);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
