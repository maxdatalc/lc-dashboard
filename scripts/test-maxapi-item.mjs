/**
 * Teste: adicionar item em O.S com descrição diferente da cadastrada no ERP.
 * Verifica se o campo produtoDescricao substitui o nome original quando proalteranome = -1.
 */

const BASE_URL = "https://lucasbatauto.lcgestor.com.br";
const TERMINAL  = "207EF31D360681679CC2559581980B76";
const EMP_ID    = 1;
const OS_ID     = 10393;
const PRODUTO_ID = 29958;

async function main() {
  // 1. Auth
  console.log("──────────────────────────────────");
  console.log("1. Autenticando na MaxAPI...");
  const authRes = await fetch(`${BASE_URL}/v2/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ empid: EMP_ID, terminal: TERMINAL }),
  });
  if (!authRes.ok) {
    const t = await authRes.text();
    console.error(`Auth falhou HTTP ${authRes.status}:`, t);
    return;
  }
  const { token } = await authRes.json();
  console.log("✅ Token:", token.slice(0, 30) + "...");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // 2. Detalhes da O.S
  console.log("\n──────────────────────────────────");
  console.log(`2. Consultando O.S ${OS_ID}...`);
  const osRes = await fetch(`${BASE_URL}/v2/serviceorder/${OS_ID}`, { headers });
  if (!osRes.ok) {
    const t = await osRes.text();
    console.error(`O.S não encontrada HTTP ${osRes.status}:`, t);
    return;
  }
  const os = await osRes.json();
  console.log("O.S encontrada:");
  console.log("  Status  :", os.status ?? os.situacao ?? "—");
  console.log("  Cliente :", os.clienteNome ?? os.cliente?.nome ?? "—");
  console.log("  Placa   :", os.veiculo?.placa ?? os.placa ?? "—");

  // 3. Detalhes do produto
  console.log("\n──────────────────────────────────");
  console.log(`3. Consultando produto ${PRODUTO_ID}...`);
  const prodRes = await fetch(`${BASE_URL}/v2/product/${PRODUTO_ID}`, { headers });
  let descricaoOriginal = "PRODUTO TESTE";
  let unidade = "UN";
  let preco = 50.0;
  if (prodRes.ok) {
    const prod = await prodRes.json();
    descricaoOriginal = prod.nome ?? prod.descricao ?? prod.produtoDescricao ?? "PRODUTO TESTE";
    unidade = prod.un ?? prod.unidade ?? "UN";
    preco = prod.precoVenda ?? prod.valor ?? 50.0;
    console.log("Produto encontrado:");
    console.log("  Descrição original:", descricaoOriginal);
    console.log("  Unidade           :", unidade);
    console.log("  Preço             :", preco);
  } else {
    const t = await prodRes.text();
    console.log(`  Produto não retornado pela MaxAPI (HTTP ${prodRes.status}): ${t.slice(0, 120)}`);
    console.log("  Prosseguindo com valores padrão...");
  }

  // 4. Adicionar item com descrição DIFERENTE
  const descricaoCustom = `[TESTE ALTERACAO] ${descricaoOriginal}`;
  console.log("\n──────────────────────────────────");
  console.log("4. Adicionando item com descrição customizada:");
  console.log("   Original :", descricaoOriginal);
  console.log("   Customizada:", descricaoCustom);

  const itemBody = {
    OsId: OS_ID,
    produtoId: PRODUTO_ID,
    produtoDescricao: descricaoCustom,
    qtde: 1,
    valor: preco,
    tipo: "P",
    un: unidade,
    tecnicoId: 1,
  };

  console.log("\nBody enviado:");
  console.log(JSON.stringify(itemBody, null, 2));

  const addRes = await fetch(`${BASE_URL}/v2/serviceorder/items`, {
    method: "POST",
    headers,
    body: JSON.stringify(itemBody),
  });

  const addText = await addRes.text();
  let addData;
  try { addData = JSON.parse(addText); } catch { addData = addText; }

  console.log(`\nResposta HTTP ${addRes.status}:`);
  console.log(JSON.stringify(addData, null, 2));

  if (addRes.ok) {
    console.log("\n✅ SUCESSO! Item criado com ID:", addData?.id ?? "—");
    console.log("👉 Verifique no ERP se a descrição do item ficou como a customizada ou voltou para a original.");
  } else {
    console.log("\n❌ FALHA ao adicionar item.");
  }
}

main().catch(console.error);
