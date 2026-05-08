// Cliente MaxData — estrutura base para integração com a API REST do ERP MaxManager
// Implementação completa será feita nas próximas etapas

export type MaxDataConfig = {
  baseUrl: string;
  empId: number;
  terminal: string;
};

// Placeholder — será implementado quando a integração com o ERP for desenvolvida
export async function getMaxDataToken(config: MaxDataConfig): Promise<string> {
  void config; // evita erro de variável não utilizada antes da implementação
  throw new Error("MaxData client not implemented yet");
}
