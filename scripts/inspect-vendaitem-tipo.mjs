/**
 * Inspeciona vendaItem dos itens da OS 10393 para descobrir o que
 * diferencia produto (ANEL/T proId=29958) de serviço (RESTAURACAO proId=25181).
 */

import { createClient } from "@supabase/supabase-js";
import { createDecipheriv } from "crypto";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(join(__dirname, "../.env.local"), "utf8");
const env = Object.fromEntries(
  envContent.split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#") && l.trim())
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

function decrypt(encryptedText) {
  const key = Buffer.from(env.ENCRYPTION_KEY, "base64");
  const [ivB64, authTagB64, dataB64] = encryptedText.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

async function bridge(url, token, sql, params = {}) {
  const base = url.replace(/\/+$/, "").replace(/\/query$/, "");
  const res = await fetch(`${base}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sql, params }),
  });
  if (!res.ok) throw new Error(`Bridge HTTP ${res.status}: ${await res.text()}`);
  const d = await res.json();
  if (d.error) throw new Error(`Bridge: ${d.error}`);
  return d.rows ?? [];
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: lojas } = await supabase.from("lojas").select("name, sql_bridge_url, sql_bridge_token").eq("name", "BatAuto").maybeSingle();
const url = lojas.sql_bridge_url;
const token = decrypt(lojas.sql_bridge_token);

// 1. Todas as colunas dos itens da OS 10393 (produto proId=29958 e serviço proId=25181)
console.log("=== Colunas completas de vendaItem para OS 10393 ===");
const rows = await bridge(url, token, `SELECT * FROM vendaItem WHERE vdiVedId = 10393 ORDER BY vdiId DESC`);
console.log(`${rows.length} itens encontrados`);
if (rows.length > 0) {
  console.log("\nColunas disponíveis:", Object.keys(rows[0]).join(", "));
  for (const r of rows) {
    console.log("\n--- vdiId:", r.vdiId, "| proId:", r.vdiItemId, "| nome:", r.vdiProNome);
    // Mostra colunas que possam indicar tipo
    const tipoCols = Object.entries(r).filter(([k]) =>
      /tipo|type|cat|serv|prod|classe|grp|grupo|flag|kind/i.test(k)
    );
    if (tipoCols.length) {
      console.log("  Colunas de tipo encontradas:", tipoCols.map(([k,v]) => `${k}=${v}`).join(" | "));
    }
    // Mostra todos os valores não-nulos/não-vazios para comparação
    const nonEmpty = Object.entries(r).filter(([,v]) => v !== null && v !== "" && v !== 0);
    console.log("  Campos com valor:", nonEmpty.map(([k,v]) => `${k}=${JSON.stringify(v)}`).join(" | "));
  }
}

// 2. Compara com produto e serviço na tabela produto (se existir)
console.log("\n=== Produto proId=29958 na tabela produto ===");
const prod = await bridge(url, token, `SELECT * FROM produto WHERE proId = 29958`);
if (prod.length) {
  const tipoCols = Object.entries(prod[0]).filter(([k]) => /tipo|type|cat|serv|prod|classe/i.test(k));
  console.log("Colunas de tipo:", tipoCols.map(([k,v]) => `${k}=${v}`).join(" | "));
}

console.log("\n=== Produto proId=25181 na tabela produto ===");
const serv = await bridge(url, token, `SELECT * FROM produto WHERE proId = 25181`);
if (serv.length) {
  const tipoCols = Object.entries(serv[0]).filter(([k]) => /tipo|type|cat|serv|prod|classe/i.test(k));
  console.log("Colunas de tipo:", tipoCols.map(([k,v]) => `${k}=${v}`).join(" | "));
}
