// Cliente Supabase para uso em Server Components e Route Handlers
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente administrativo — bypassa RLS.
// Usar APENAS em operações de backend. NUNCA expor ao frontend.
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );
}

export async function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Em Server Components os cookies são read-only — ignorar sem lançar erro
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // silencioso: ocorre em Server Components onde não é possível escrever cookies
          }
        },
      },
    }
  );
}
