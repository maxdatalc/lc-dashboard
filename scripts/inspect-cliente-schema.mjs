/**
 * Inspeciona schema da tabela 'cliente' via Bridge SQL
 * Uso: node scripts/inspect-cliente-schema.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { createDecipheriv } from "crypto";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Lê .env.local
const envPath = join(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envContent.split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const SUPABASE_URL   = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY    = env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = env.ENCRYPTION_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !ENCRYPTION_KEY) {
  console.error("Variáveis NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ENCRYPTION_KEY não encontradas no .env.local");
  process.exit(1);
}

function decrypt(encryptedText) {
  const key = Buffer.from(ENCRYPTION_KEY, "base64");
  const [ivB64, authTagB64, dataB64] = encryptedText.split(":");
  const iv       = Buffer.from(ivB64, "base64");
  const authTag  = Buffer.from(authTagB64, "base64");
  const data     = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

async function queryBridge(bridgeUrl, token, sql, params = {}) {
  const res = await fetch(`${bridgeUrl}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sql, params }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Bridge ${res.status}: ${txt}`);
  }
  const json = await res.json();
  return json.rows ?? [];
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Pega a primeira loja com bridge configurada
  const { data: lojas, error } = await supabase
    .from("lojas")
    .select("id, name, emp_id, sql_bridge_url, sql_bridge_token")
    .not("sql_bridge_url", "is", null)
    .not("sql_bridge_token", "is", null)
    .eq("is_active", true)
    .limit(1);

  if (error || !lojas?.length) {
    console.error("Nenhuma loja com bridge configurada:", error?.message ?? "vazio");
    process.exit(1);
  }

  const loja = lojas[0];
  console.log(`\nUsando loja: ${loja.name} (empId ${loja.emp_id})\n`);

  const token = decrypt(loja.sql_bridge_token);
  const bridge = loja.sql_bridge_url;
  const empId  = loja.emp_id;

  // ── 1. Schema completo de 'cliente' ────────────────────────────────────────
  console.log("=== COLUNAS DE cliente ===");
  const cols = await queryBridge(bridge, token, `
    SELECT
      COLUMN_NAME     AS col,
      DATA_TYPE       AS tipo,
      CHARACTER_MAXIMUM_LENGTH AS tamanho,
      IS_NULLABLE     AS nulo
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'cliente'
    ORDER BY ORDINAL_POSITION
  `);
  // Filtra colunas de interesse (email, usuario, sistema)
  const interesting = cols.filter((c) =>
    /email|usu|sistema|acesso|mail|login/i.test(c.col)
  );
  console.log("Colunas com email/usu/sistema:");
  console.table(interesting);
  console.log(`\nTotal de colunas em 'cliente': ${cols.length}`);
  console.log("Primeiras 15 colunas:");
  console.table(cols.slice(0, 15));

  // ── 2. Amostra de linha com cliUsuarioUsaSistema ────────────────────────
  console.log("\n=== AMOSTRA (cliUsuarioUsaSistema IS NOT NULL) ===");
  try {
    const sample = await queryBridge(bridge, token, `
      SELECT TOP 3
        cliId, cliNome, cliUsu, cliUsuarioUsaSistema
      FROM cliente
      WHERE empId = @empId
        AND cliUsuarioUsaSistema IS NOT NULL
    `, { empId });
    console.table(sample);
  } catch (e) {
    console.log("Erro na query de amostra:", e.message);
  }

  // ── 3. Verifica colunas de 'loja_usuarios_erp' no Supabase ─────────────
  console.log("\n=== COLUNAS loja_usuarios_erp (Supabase) ===");
  try {
    const { data: lupErp } = await supabase.from("loja_usuarios_erp").select("*").limit(1);
    if (lupErp?.length) {
      console.log("Colunas:", Object.keys(lupErp[0]).join(", "));
    } else {
      console.log("Tabela vazia ou não existe.");
    }
  } catch (e) {
    console.log("Erro:", e.message);
  }

  // ── 4. Verifica integration_configs ────────────────────────────────────
  console.log("\n=== COLUNAS integration_configs (Supabase) ===");
  try {
    const { data: ic } = await supabase.from("integration_configs").select("*").limit(1);
    if (ic?.length) {
      console.log("Colunas:", Object.keys(ic[0]).join(", "));
      console.log("Valores:", ic[0]);
    } else {
      console.log("Sem dados.");
    }
  } catch (e) {
    console.log("Erro:", e.message);
  }

  // ── 5. user_tenant_settings ─────────────────────────────────────────────
  console.log("\n=== user_tenant_settings (Supabase) ===");
  try {
    const { data: uts, error: utsErr } = await supabase.from("user_tenant_settings").select("*").limit(1);
    if (utsErr) {
      console.log("Tabela não existe ou erro:", utsErr.message);
    } else {
      console.log("Existe. Colunas:", uts?.length ? Object.keys(uts[0]).join(", ") : "(vazia)");
    }
  } catch (e) {
    console.log("Erro:", e.message);
  }
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
