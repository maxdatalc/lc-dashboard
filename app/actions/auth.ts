"use server";

// Server Actions de autenticação — login e logout via Supabase Auth
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function login(formData: FormData): Promise<{ error?: string }> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email ou senha inválidos" };
  }

  // Verificar se é system admin para redirecionar corretamente
  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("is_system_admin")
    .eq("id", data.user.id)
    .maybeSingle();

  const isAdmin = (profile as { is_system_admin?: boolean } | null)?.is_system_admin;

  // redirect() lança uma exceção internamente — deve ficar fora do try/catch
  redirect(isAdmin ? "/admin" : "/dashboard");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
