/**
 * Inspeciona tabela 'config' via Bridge SQL para ver empresas ativas.
 * Uso: node scripts/inspect-config-table.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { createDecipheriv } from "crypto";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

function decrypt(enc) {
  const key = Buffer.from(env.ENCRYPTION_KEY, "base64");
  const [ivB64, authTagB64, dataB64] = enc.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

async function q(url, token, sql, params = {}) {
  const res = await fetch(`${url}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sql, params }),
  });
  const json = await res.json();
  return json.rows ?? [];
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: lojas } = await supabase.from("lojas").select("name,emp_id,sql_bridge_url,sql_bridge_token").not("sql_bridge_url","is",null).eq("is_active",true).limit(1);

const loja = lojas?.[0];
if (!loja) { console.error("Nenhuma loja com bridge"); process.exit(1); }

const token = decrypt(loja.sql_bridge_token);
const url = loja.sql_bridge_url;
console.log(`Usando loja: ${loja.name}\n`);

// Colunas da tabela config
const cols = await q(url, token, `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'config' ORDER BY ORDINAL_POSITION`);
console.log("=== COLUNAS DE config ===");
console.table(cols);

// Primeiras linhas
const rows = await q(url, token, `SELECT TOP 10 * FROM config`);
console.log("\n=== TOP 10 LINHAS ===");
console.table(rows);
