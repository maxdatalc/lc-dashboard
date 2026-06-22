/**
 * Query rápida: dados cadastrais de config + VW_BI_DIM_LOJA
 * Uso: node scripts/query-config-cnpj.mjs
 */

import sql from "mssql";

const pool = await sql.connect({
  server: "localhost",
  port: 1433,
  database: "BATAUTO",
  user: "sa",
  password: "REDACTED-SENHA",
  options: { trustServerCertificate: true, enableArithAbort: true },
});

// 1. Todos os registros de config com dados cadastrais
console.log("=== config: cofId, razao, fantasia, cnpj, filial ===");
const r1 = await pool.request().query(
  "SELECT cofId, cofEmpRazao, cofEmpFantasia, cofEmpCnpj, cofEmpIe, cofEmpFilial FROM config ORDER BY cofId"
);
console.table(r1.recordset);

// 2. Colunas de VW_BI_DIM_LOJA
console.log("\n=== Colunas de VW_BI_DIM_LOJA ===");
const r2 = await pool.request().query(
  "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'VW_BI_DIM_LOJA' ORDER BY ORDINAL_POSITION"
);
console.table(r2.recordset);

// 3. Sample VW_BI_DIM_LOJA
console.log("\n=== TOP 5 VW_BI_DIM_LOJA ===");
try {
  const r3 = await pool.request().query("SELECT TOP 5 * FROM VW_BI_DIM_LOJA");
  console.table(r3.recordset);
} catch (e) {
  console.log("Erro VW_BI_DIM_LOJA:", e.message);
}

// 4. Check se view VW_BI_DIM_LOJA tem empId-like column
console.log("\n=== Colunas INFORMATION_SCHEMA.VIEWS que contem 'loja' ou 'dim' ===");
const r4 = await pool.request().query(
  "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME LIKE '%LOJA%' OR TABLE_NAME LIKE '%DIM%' ORDER BY TABLE_NAME"
);
console.table(r4.recordset);

await pool.close();
console.log("\nFinalizado.");
