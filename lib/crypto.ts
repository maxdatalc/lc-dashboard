// Utilitários de criptografia AES-256-GCM usando o módulo nativo do Node.js
// Usado para proteger sql_bridge_token armazenado no banco de dados

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY não configurada");
  // A chave é armazenada em base64 e convertida para Buffer de 32 bytes
  return Buffer.from(raw, "base64");
}

// Criptografa um texto e retorna "{iv_base64}:{authTag_base64}:{encrypted_base64}"
export function encrypt(text: string): string {
  const key = getKey();
  // IV aleatório de 16 bytes — único por operação para garantir segurança do GCM
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);

  // authTag é gerado pelo GCM e necessário para verificar integridade na decriptação
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

// Recebe "{iv_base64}:{authTag_base64}:{encrypted_base64}" e retorna o texto original
export function decrypt(encryptedText: string): string {
  const key = getKey();
  const [ivB64, authTagB64, dataB64] = encryptedText.split(":");

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  // O authTag deve ser definido antes de chamar update/final no GCM
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
