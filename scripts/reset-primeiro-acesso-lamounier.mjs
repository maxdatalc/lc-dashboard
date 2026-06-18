/**
 * Redefine a senha de lucas.lamounier@maxdata.com.br para "12345678"
 * e força o fluxo de primeiro acesso (must_change_password=true).
 * Uso: node scripts/reset-primeiro-acesso-lamounier.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = join(__dirname, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL  = "lucas.lamounier@maxdata.com.br";
const SENHA  = "12345678";
const NOME   = "Lucas Lamounier";

const { data: listData } = await admin.auth.admin.listUsers({ perPage: 1000 });
const user = listData?.users?.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase());

if (!user) {
  console.error(`✕ Usuário ${EMAIL} não encontrado no Supabase Auth.`);
  process.exit(1);
}

console.log(`\n── ${EMAIL} (id: ${user.id})`);

const { error } = await admin.auth.admin.updateUserById(user.id, {
  password: SENHA,
  user_metadata: {
    ...user.user_metadata,
    must_change_password: true,
    full_name: NOME,
  },
});

if (error) {
  console.error(`✕ Erro: ${error.message}`);
  process.exit(1);
}

console.log(`✓ Senha redefinida para "${SENHA}"`);
console.log(`✓ must_change_password = true`);
console.log(`\nNa próxima vez que o usuário logar, será redirecionado para /primeiro-acesso.\n`);
