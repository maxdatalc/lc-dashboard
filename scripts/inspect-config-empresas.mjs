/**
 * Consulta empresas ativas na tabela 'config' (empId, razão, fantasia).
 * Uso: node scripts/inspect-config-empresas.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { createDecipheriv } from "crypto";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(__dirname, "../.env.local"), "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

function decrypt(enc) {
  const key = Buffer.from(env.ENCRYPTION_KEY, "base64");
  const [ivB64, authB64, dataB64] = enc.split(":");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  d.setAuthTag(Buffer.from(authB64, "base64"));
  return Buffer.concat([d.update(Buffer.from(dataB64, "base64")), d.final()]).toString("utf8");
}

async function q(url, token, sql, params = {}) {
  const res = await fetch(`${url}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sql, params }),
  });
  return (await res.json()).rows ?? [];
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: lojas } = await supabase.from("lojas").select("name,sql_bridge_url,sql_bridge_token").not("sql_bridge_url","is",null).eq("is_active",true).limit(1);
const loja = lojas?.[0];
if (!loja) { console.error("Nenhuma loja com bridge"); process.exit(1); }
const token = decrypt(loja.sql_bridge_token);

// Tenta encontrar empId na tabela config ou empresa
const empresas = await q(loja.sql_bridge_url, token, `
  SELECT empId, cofEmpRazao, cofEmpFantasia, cofEmpCnpj
  FROM config
  ORDER BY empId
`);
console.log("=== EMPRESAS em config ===");
console.table(empresas);

// Verifica se existe tabela 'empresa'
const tbls = await q(loja.sql_bridge_url, token, `
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME IN ('empresa','empresas','filial','filiais')
`);
console.log("\n=== Tabelas alternativas (empresa/filial) ===");
console.table(tbls);
