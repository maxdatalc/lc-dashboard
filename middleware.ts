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

  // ── 0. Primeiro acesso — troca de senha obrigatória ──────────────────────
  const mustChangePassword = user?.user_metadata?.must_change_password === true;

  if (pathname === "/primeiro-acesso") {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    if (!mustChangePassword) return NextResponse.redirect(new URL("/home", request.url));
    return supabaseResponse;
  }

  if (mustChangePassword && user) {
    return NextResponse.redirect(new URL("/primeiro-acesso", request.url));
  }

  if (pathname === "/selecionar-empresa") {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    return supabaseResponse;
  }

  // ── 1. Roteamento por subdomínio (só em produção) ─────────────────────────
  if (!IS_DEV) {
    if (isAdmin) {
      // admpainel.lcgestor.com.br → apenas rotas /admin e /login
      if (pathname === "/") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      if (pathname.startsWith("/dashboard") || pathname.startsWith("/home")) {
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
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/home") ||
    pathname.startsWith("/os") ||
    pathname.startsWith("/relatorios");
  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ── 3. Já logado e tentando acessar /login ────────────────────────────────
  if (pathname === "/login" && user) {
    const adminClient = makeAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("is_system_admin, is_suporte")
      .eq("id", user.id)
      .maybeSingle();

    const p3 = profile as { is_system_admin?: boolean; is_suporte?: boolean } | null;
    const isAdminOrSuporte = !!p3?.is_system_admin || !!p3?.is_suporte;

    // Admin / suporte vai sempre para /admin
    if (isAdminOrSuporte) {
      return IS_DEV
        ? NextResponse.redirect(new URL("/admin", request.url))
        : NextResponse.redirect(`${ADMIN_URL}/admin`);
    }

    // Não-admin: só redireciona para /dashboard se o cookie de empresa estiver presente.
    // Se o cookie expirou, deixa o usuário chegar na tela de login para re-selecionar empresa.
    const hasTenantCookie = !!request.cookies.get("selected_tenant_id")?.value;
    if (hasTenantCookie) {
      // Se o módulo Visão Geral estiver com kill-switch ligado, pula direto para o
      // dashboard de Vendas em vez de mandar pro /home (que ficaria vazio/bloqueado).
      const { data: visaoGeralSettings } = await adminClient
        .from("module_settings")
        .select("kill_switch_enabled")
        .eq("feature_key", "dashboard_visao_geral")
        .maybeSingle();
      const visaoGeralKilled =
        (visaoGeralSettings as { kill_switch_enabled?: boolean } | null)?.kill_switch_enabled === true;
      const destino = visaoGeralKilled ? "/dashboard" : "/home";

      return IS_DEV
        ? NextResponse.redirect(new URL(destino, request.url))
        : NextResponse.redirect(`${APP_URL}${destino}`);
    }

    // Sem empresa selecionada: vai para tela de seleção
    return IS_DEV
      ? NextResponse.redirect(new URL("/selecionar-empresa", request.url))
      : NextResponse.redirect(`${APP_URL}/selecionar-empresa`);
  }

  // ── 4. Rotas /admin exigem is_system_admin ou is_suporte ─────────────────
  if (pathname.startsWith("/admin") && user) {
    const adminClient = makeAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("is_system_admin, is_suporte")
      .eq("id", user.id)
      .maybeSingle();

    const p4 = profile as { is_system_admin?: boolean; is_suporte?: boolean } | null;
    const canAccessAdmin = !!p4?.is_system_admin || !!p4?.is_suporte;

    if (!canAccessAdmin) {
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
