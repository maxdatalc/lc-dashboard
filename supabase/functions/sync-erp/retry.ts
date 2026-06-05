// Helper de retry com backoff exponencial para syncs resilientes
// Usado pelo sync-erp-daily para tolerar quedas temporárias do ERP local

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RetryOptions {
  tentativas: number;        // número máximo de tentativas
  intervaloMs: number;       // intervalo base entre tentativas em ms
  onTentativa?: (n: number, erro: string) => void; // callback para logging
}

// Executa fn com retry automático.
// Se todas as tentativas falharem, lança o último erro.
export async function comRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions
): Promise<T> {
  let ultimoErro: Error = new Error("Erro desconhecido");

  for (let tentativa = 1; tentativa <= opts.tentativas; tentativa++) {
    try {
      return await fn();
    } catch (err) {
      ultimoErro = err instanceof Error ? err : new Error(String(err));
      opts.onTentativa?.(tentativa, ultimoErro.message);

      if (tentativa < opts.tentativas) {
        // Backoff: 5min, 10min, 15min entre tentativas
        await sleep(opts.intervaloMs * tentativa);
      }
    }
  }

  throw ultimoErro;
}
