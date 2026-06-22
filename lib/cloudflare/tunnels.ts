import { decrypt } from "@/lib/crypto";

const CF_BASE = "https://api.cloudflare.com/client/v4";
const BRIDGE_DOMAIN = "lcgestor.com.br";

function cfHeaders() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN não configurada");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function getAccountId() {
  const id = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!id) throw new Error("CLOUDFLARE_ACCOUNT_ID não configurada");
  return id;
}

function getZoneId() {
  const id = process.env.CLOUDFLARE_ZONE_ID;
  if (!id) throw new Error("CLOUDFLARE_ZONE_ID não configurada");
  return id;
}

export function nomeTunnelParaBridgeUrl(nome: string): string {
  return `https://${nome}sql.${BRIDGE_DOMAIN}`;
}

export async function criarTunnelCompleto(nome: string): Promise<{
  tunnelId: string;
  tunnelToken: string;
  bridgeUrl: string;
}> {
  const acc = getAccountId();
  const subdominio = `${nome}sql`;
  const hostname = `${subdominio}.${BRIDGE_DOMAIN}`;

  // 1. Criar tunnel
  const createRes = await fetch(`${CF_BASE}/accounts/${acc}/cfd_tunnel`, {
    method: "POST",
    headers: cfHeaders(),
    body: JSON.stringify({ name: nome, config_src: "cloudflare" }),
  });
  const createData = (await createRes.json()) as {
    success: boolean;
    result?: { id: string };
    errors?: { message: string }[];
  };
  if (!createData.success)
    throw new Error(createData.errors?.[0]?.message ?? "Erro ao criar tunnel na Cloudflare");
  const tunnelId = createData.result!.id;

  // 2. Buscar token do tunnel
  const tokenRes = await fetch(`${CF_BASE}/accounts/${acc}/cfd_tunnel/${tunnelId}/token`, {
    headers: cfHeaders(),
  });
  const tokenData = (await tokenRes.json()) as {
    success: boolean;
    result?: string;
    errors?: { message: string }[];
  };
  if (!tokenData.success)
    throw new Error(tokenData.errors?.[0]?.message ?? "Erro ao obter token do tunnel");
  const tunnelToken = tokenData.result!;

  // 3. Configurar ingress: localhost:3055 para o hostname gerado
  await fetch(`${CF_BASE}/accounts/${acc}/cfd_tunnel/${tunnelId}/configurations`, {
    method: "PUT",
    headers: cfHeaders(),
    body: JSON.stringify({
      config: {
        ingress: [
          { hostname, service: "http://localhost:3055" },
          { service: "http_status:404" },
        ],
      },
    }),
  });

  // 4. Criar registro DNS CNAME para o subdomínio
  await fetch(`${CF_BASE}/zones/${getZoneId()}/dns_records`, {
    method: "POST",
    headers: cfHeaders(),
    body: JSON.stringify({
      type: "CNAME",
      name: subdominio,
      content: `${tunnelId}.cfargotunnel.com`,
      proxied: true,
    }),
  });

  return { tunnelId, tunnelToken, bridgeUrl: `https://${hostname}` };
}

export async function deletarTunnel(tunnelId: string): Promise<void> {
  const acc = getAccountId();
  await fetch(`${CF_BASE}/accounts/${acc}/cfd_tunnel/${tunnelId}`, {
    method: "DELETE",
    headers: cfHeaders(),
  });
}

export function decryptTunnelToken(encryptedToken: string): string {
  return decrypt(encryptedToken);
}
