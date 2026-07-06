/**
 * Roda uma query SELECT no bridge de testes oficial (BRIDGE_TEST_URL/BRIDGE_TEST_TOKEN
 * em .env.local, banco SALES). Nunca usar BATAUTO — ver docs/wiki/bridge-sql-constraints.md.
 *
 * Uso: node scripts/query-bridge-teste.mjs "SELECT TOP 5 * FROM venda"
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(__dirname, "../.env.local"), "utf8").split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sql = process.argv[2];
if (!sql) {
  console.error('Uso: node scripts/query-bridge-teste.mjs "SELECT ..."');
  process.exit(1);
}

if (!env.BRIDGE_TEST_URL || !env.BRIDGE_TEST_TOKEN) {
  console.error("BRIDGE_TEST_URL / BRIDGE_TEST_TOKEN não configurados em .env.local");
  process.exit(1);
}

async function main() {
  const res = await fetch(`${env.BRIDGE_TEST_URL.replace(/\/+$/, "")}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.BRIDGE_TEST_TOKEN}` },
    body: JSON.stringify({ sql, params: {} }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Bridge HTTP ${res.status}: ${text}`);
    process.exit(1);
  }
  const data = JSON.parse(text);
  if (data.error) {
    console.error(`Bridge erro: ${data.error}`);
    process.exit(1);
  }
  console.table(data.rows ?? []);
  console.log(`\n${(data.rows ?? []).length} linha(s).`);
}

main().catch(e => { console.error("ERRO:", e.message); process.exit(1); });
