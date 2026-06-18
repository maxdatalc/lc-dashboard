// Cliente Supabase para uso no middleware do Next.js
// Atualiza a sessão do usuário a cada request e retorna o usuário atual

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Resposta base que será modificada pelo Supabase ao atualizar cookies de sessão
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Escrever nos cookies do request e da response para manter a sessão sincronizada
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          // Em produção, usa domínio pai para compartilhar sessão entre admpainel e app
          const domain = process.env.NODE_ENV === "production" ? ".lcgestor.com.br" : undefined;
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, { ...options, ...(domain ? { domain } : {}) })
          );
        },
      },
    }
  );

  // getUser() valida o JWT com o servidor do Supabase — não usar getSession() aqui
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}
