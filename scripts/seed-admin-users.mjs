/**
 * Cria/atualiza os usuários system admin do admpainel.
 * Uso: node scripts/seed-admin-users.mjs
 *
 * Executa uma única vez (idempotente — pode rodar novamente sem duplicar).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Lê .env.local
const envPath = join(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envContent
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env.local");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMINS = [
  { email: "lucasruana.f@gmail.com",        nome: "Lucas Ruan",       senha: "123456" },
  { email: "lucas.lamounier@maxdata.com.br", nome: "Lucas Lamounier",  senha: "123456" },
];

const { data: listData } = await admin.auth.admin.listUsers({ perPage: 1000 });
const existingUsers = listData?.users ?? [];

for (const u of ADMINS) {
  console.log(`\n── ${u.email}`);

  const existing = existingUsers.find(
    (eu) => eu.email?.toLowerCase() === u.email.toLowerCase()
  );

  let userId;

  if (existing) {
    // Atualiza senha e seta flag de primeiro acesso
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: u.senha,
      user_metadata: {
        ...existing.user_metadata,
        must_change_password: true,
        full_name: u.nome,
      },
    });
    if (error) {
      console.error(`  ✕ Erro ao atualizar auth: ${error.message}`);
      continue;
    }
    userId = existing.id;
    console.log(`  ✓ Auth atualizado (senha resetada, must_change_password=true)`);
  } else {
    // Cria novo usuário
    const { data: created, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.senha,
      email_confirm: true,
      user_metadata: {
        must_change_password: true,
        full_name: u.nome,
      },
    });
    if (error) {
      console.error(`  ✕ Erro ao criar usuário: ${error.message}`);
      continue;
    }
    userId = created.user.id;
    console.log(`  ✓ Usuário criado no Auth`);
  }

  // Upsert profile como system admin
  const { error: profileError } = await admin.from("profiles").upsert(
    { id: userId, full_name: u.nome, is_system_admin: true },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error(`  ✕ Erro ao salvar profile: ${profileError.message}`);
  } else {
    console.log(`  ✓ Profile: is_system_admin=true`);
  }
}

console.log("\n✓ Concluído. Ambos os usuários devem alterar a senha no primeiro acesso.\n");
