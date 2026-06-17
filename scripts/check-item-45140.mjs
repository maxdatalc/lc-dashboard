/**
 * Consulta o item 45140 no banco REMOTO via Bridge SQL.
 * Pega a URL e token do Bridge a partir do Supabase (para o loja_id do BATAUTO prod).
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

// AES-256-GCM decrypt — formato "ivB64:authTagB64:dataB64" (lib/crypto.ts)
function decrypt(encryptedText) {
  const key = Buffer.from(env.ENCRYPTION_KEY, "base64");
  const [ivB64, authTagB64, dataB64] = encryptedText.split(":");
  const iv      = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const data    = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// Bridge: POST {url}/query com body { sql, params } → { rows }
async function queryBridge(url, token, sqlQuery, params = {}) {
  const base = url.replace(/\/+$/, "").replace(/\/query$/, "");
  const res = await fetch(`${base}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sql: sqlQuery, params }),
  });
  if (!res.ok) throw new Error(`Bridge HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(`Bridge erro: ${data.error}`);
  return data.rows ?? [];
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Lista todas as lojas com Bridge configurada para identificar a do cliente BATAUTO
console.log("Buscando lojas com Bridge configurada...");
const { data: lojas, error } = await supabase
  .from("lojas")
  .select("id, name, emp_id, sql_bridge_url, sql_bridge_token")
  .not("sql_bridge_url", "is", null);

if (error) { console.error(error); process.exit(1); }

console.log("Lojas encontradas:");
for (const loja of lojas) {
  console.log(`  [${loja.id}] ${loja.name} | empId=${loja.emp_id} | url=${loja.sql_bridge_url}`);
}

// Usa a primeira loja que tiver Bridge (ou filtra pelo nome)
const loja = lojas[0];
if (!loja?.sql_bridge_token) { console.error("Sem token"); process.exit(1); }

const bridgeUrl   = loja.sql_bridge_url;
const bridgeToken = decrypt(loja.sql_bridge_token);

console.log(`\nUsando loja: ${loja.name}`);
console.log(`Bridge URL: ${bridgeUrl}`);

// Consulta o item
console.log("\n=== Consultando vdiId = 45140 via Bridge ===");
const rows = await queryBridge(bridgeUrl, bridgeToken, `
  SELECT
    vi.vdiId,
    vi.vdiVedId,
    vi.vdiItemId        AS produtoId,
    vi.vdiProNome       AS descricaoSalva,
    pe.proDescricao     AS descricaoOriginalERP,
    vi.vdiQtde          AS qtde,
    vi.vdiValor         AS valorUnit,
    vi.vdiCancel        AS cancelado
  FROM vendaItem vi
  LEFT JOIN produto pe ON pe.proId = vi.vdiItemId
  WHERE vi.vdiId = 45140
`);

if (!rows || rows.length === 0) {
  console.log("Nenhum resultado para vdiId = 45140");
} else {
  for (const r of rows) {
    console.log("\n---");
    console.log("  vdiId           :", r.vdiId);
    console.log("  descricaoSalva  :", r.descricaoSalva);
    console.log("  descricaoOrigERP:", r.descricaoOriginalERP);
    console.log("  qtde            :", r.qtde);
    console.log("  valorUnit       :", r.valorUnit);
    console.log("  cancelado       :", r.cancelado);
    console.log("\n  DESCRIÇÃO CUSTOMIZADA FOI SALVA?",
      r.descricaoSalva !== r.descricaoOriginalERP
        ? "✅ SIM — ERP aceitou descrição customizada"
        : "❌ NÃO — ERP usou a descrição original"
    );
  }
}
