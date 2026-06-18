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
  const [a, b, c] = enc.split(":");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(a,"base64"));
  d.setAuthTag(Buffer.from(b,"base64"));
  return Buffer.concat([d.update(Buffer.from(c,"base64")), d.final()]).toString("utf8");
}
async function q(url, token, sql, params={}) {
  const r = await fetch(`${url}/query`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({sql,params})});
  return (await r.json()).rows ?? [];
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: lojas } = await supabase.from("lojas").select("sql_bridge_url,sql_bridge_token").not("sql_bridge_url","is",null).eq("is_active",true).limit(1);
const loja = lojas?.[0];
const token = decrypt(loja.sql_bridge_token);
const url = loja.sql_bridge_url;

// Ver colunas que contenham 'emp' ou 'id'
const cols = await q(url, token, `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='config' AND (LOWER(COLUMN_NAME) LIKE '%emp%' OR LOWER(COLUMN_NAME) LIKE '%id%' OR LOWER(COLUMN_NAME) LIKE '%ativo%' OR LOWER(COLUMN_NAME) LIKE '%raz%' OR LOWER(COLUMN_NAME) LIKE '%fan%') ORDER BY ORDINAL_POSITION`);
console.log("Colunas relevantes em config:");
console.table(cols);

// SELECT TOP 3 com todas as colunas
const row = await q(url, token, `SELECT TOP 3 * FROM config`);
if (row.length) {
  console.log("\nChaves disponíveis:", Object.keys(row[0]).join(", "));
  console.log("\nPrimeira linha:");
  console.log(JSON.stringify(row[0], null, 2));
}
