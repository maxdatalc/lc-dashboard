// Middleware de autenticação — protege rotas do dashboard e redireciona usuários logados
import { updateSession } from "@/lib/supabase/middleware-client";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Redirecionar para login se tentar acessar o dashboard sem sessão
  if (pathname.startsWith("/dashboard") && user === null) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Redirecionar para o dashboard se já estiver logado e tentar acessar o login
  if (pathname === "/login" && user !== null) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

export const config = {
  // Não interceptar assets estáticos, imagens otimizadas nem rotas de API
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
