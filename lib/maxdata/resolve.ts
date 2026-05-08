// Ponte entre o banco de dados e o cliente MaxData
// Obtém as credenciais da loja e retorna o token autenticado

import { getLojaConfig } from "@/lib/db/tenants";
import { getMaxDataToken } from "@/lib/maxdata/client";

// Resolve o token MaxData para uma loja a partir do seu ID no banco
export async function getTokenForLoja(lojaId: string): Promise<string> {
  const config = await getLojaConfig(lojaId);
  return getMaxDataToken(config);
}
