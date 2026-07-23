import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const LOJA_ID = "468d8b01-440f-4f0d-a8c7-50f854185f4f"; // lojateste
const CPF_TESTE = "11144477735"; // mesmo CPF do cliente 2980 já criado no ERP — testa o caminho "reusar por CPF"
const PRODUTO_ID = "106ef377-da7a-4ebc-b701-8bdcaea146d1"; // ecom_produtos.id, external_id 4323
const EXTERNAL_ID = 4323;
const PRECO = 29.68;

async function main() {
  const email = `claude.teste.fase5.${Date.now()}@example.com`;

  console.log("1. Criando usuário de teste (exercita o trigger ecom_handle_new_user)...");
  const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
    email,
    password: "SenhaTeste123!",
    email_confirm: true,
    user_metadata: {
      loja_id: LOJA_ID,
      nome: "Claude Teste Fase5",
      full_name: "Claude Teste Fase5",
      celular: "94999998888",
      cep: "77817320",
      logradouro: "RUA TESTE FASE 5",
      numero: "100",
      complemento: null,
      bairro: "CENTRO",
      cidade: "ARAGUAÍNA",
      uf: "TO",
      codigo_ibge: "1702109",
    },
  });
  if (userErr) { console.error("Falhou criar user:", userErr.message); process.exit(1); }
  const userId = userData.user.id;
  console.log(`   user_id=${userId} email=${email}`);

  console.log("\n2. Conferindo se o trigger criou ecom_clientes + ecom_enderecos...");
  const { data: cliente } = await supabase
    .from("ecom_clientes")
    .select("*")
    .eq("user_id", userId)
    .eq("loja_id", LOJA_ID)
    .maybeSingle();
  if (!cliente) { console.error("   ecom_clientes NÃO foi criado pelo trigger!"); process.exit(1); }
  console.log("   ecom_clientes:", JSON.stringify(cliente));

  const { data: enderecos } = await supabase
    .from("ecom_enderecos")
    .select("*")
    .eq("cliente_id", cliente.id);
  console.log("   ecom_enderecos:", JSON.stringify(enderecos));
  if (!enderecos || enderecos.length !== 1 || !enderecos[0].is_padrao || !enderecos[0].codigo_ibge) {
    console.error("   Endereço padrão NÃO foi criado corretamente pelo trigger!");
    process.exit(1);
  }

  console.log("\n3. Congelando CPF no cliente (simula confirmarPedido)...");
  await supabase.from("ecom_clientes").update({ cpf_cnpj: CPF_TESTE }).eq("id", cliente.id);

  console.log("\n4. Criando pedido 'pendente' + item (simula garantirPedidoCriado)...");
  const { data: pedido, error: pedidoErr } = await supabase
    .from("ecom_pedidos")
    .insert({
      cliente_id: cliente.id,
      carrinho_id: null,
      status: "pendente",
      tipo_entrega: "retirada",
      endereco_snapshot: null,
      frete_valor: null,
      frete_prazo_dias: null,
      frete_servico: null,
      cpf: CPF_TESTE,
      total: PRECO,
      pago_em: null,
      venda_erp_id: null,
      erp_tentativas: 0,
      erp_ultimo_erro: null,
    })
    .select("id")
    .single();
  if (pedidoErr) { console.error("Falhou criar pedido:", pedidoErr.message); process.exit(1); }
  console.log(`   pedido_id=${pedido.id}`);

  const { error: itemErr } = await supabase.from("ecom_pedido_itens").insert({
    pedido_id: pedido.id,
    produto_id: PRODUTO_ID,
    external_id: EXTERNAL_ID,
    nome: "PARAF RODA COMPL M20X75 CARRETA MARTELINHO",
    preco: PRECO,
    quantidade: 1,
    enviado_erp: false,
  });
  if (itemErr) { console.error("Falhou criar item:", itemErr.message); process.exit(1); }

  console.log("\n5. Flipando pedido pra 'pago' (mesma técnica já usada pra testar o webhook da Fase 4)...");
  const { error: flipErr } = await supabase
    .from("ecom_pedidos")
    .update({ status: "pago", pago_em: new Date().toISOString() })
    .eq("id", pedido.id);
  if (flipErr) { console.error("Falhou flipar status:", flipErr.message); process.exit(1); }

  console.log(`\nOK. pedido_id=${pedido.id} cliente_id=${cliente.id} user_id=${userId}`);
}

main().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
