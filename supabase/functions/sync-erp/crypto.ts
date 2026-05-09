// Decriptografia AES-256-GCM compatível com Deno (Web Crypto API)
// Espelha o formato gerado por lib/crypto.ts do projeto Next.js (Node.js)
// Formato da string: "iv_base64:authTag_base64:encrypted_base64"

function base64ToBytes(b64: string): Uint8Array {
  // Remove espaços e quebras de linha que podem vir do ambiente
  const clean = b64.trim().replace(/\s+/g, "");
  // Adiciona padding = se necessário (base64 precisa ser múltiplo de 4)
  const padded = clean + "=".repeat((4 - (clean.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    throw new Error(
      `Erro ao decodificar base64 (primeiros 20 chars: "${clean.substring(0, 20)}"): ${e}`
    );
  }
}

export async function decrypt(encryptedText: string): Promise<string> {
  const [ivB64, authTagB64, dataB64] = encryptedText.split(":");

  const iv = base64ToBytes(ivB64);
  const authTag = base64ToBytes(authTagB64);
  const encrypted = base64ToBytes(dataB64);

  // Importar a chave de criptografia do ambiente
  const keyBytes = base64ToBytes(Deno.env.get("ENCRYPTION_KEY")!);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // Web Crypto AES-GCM espera ciphertext + authTag concatenados (ao contrário do Node)
  const ciphertextWithTag = new Uint8Array(encrypted.length + authTag.length);
  ciphertextWithTag.set(encrypted, 0);
  ciphertextWithTag.set(authTag, encrypted.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    ciphertextWithTag
  );

  return new TextDecoder().decode(decrypted);
}
