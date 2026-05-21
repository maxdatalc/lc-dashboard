// Middleware de autenticação — protege rotas do dashboard e redireciona usuários logados
import { updateSession } from "@/lib/supabase/middleware-client";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Redirecionar para login se tentar acessar o dashboard sem sessão
  if (pathname.startsWith("/dashboard") && user === null) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Redirecionar para o destino correto se já estiver logado e tentar acessar o login
  if (pathname === "/login" && user !== null) {
    const adminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    );
    const { data: profile } = await adminClient
      .from("profiles")
      .select("is_system_admin")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = (profile as { is_system_admin?: boolean } | null)?.is_system_admin;
    const destUrl = request.nextUrl.clone();
    destUrl.pathname = isAdmin ? "/admin" : "/dashboard";
    return NextResponse.redirect(destUrl);
  }

  // Proteger rotas /admin — exige autenticação e is_system_admin
  if (pathname.startsWith("/admin")) {
    if (user === null) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }

    // Criar cliente admin sem cookies (service role não precisa de sessão)
    const adminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    );

    const { data: profile } = await adminClient
      .from("profiles")
      .select("is_system_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!(profile as { is_system_admin?: boolean } | null)?.is_system_admin) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  // Não interceptar assets estáticos, imagens otimizadas nem rotas de API
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
