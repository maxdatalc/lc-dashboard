// Client para a API REST Asaas v3 — uso exclusivo server-side
import type {
  AsaasCustomer,
  AsaasSubscription,
  AsaasPayment,
  AsaasListResponse,
  CreateCustomerInput,
  CreateSubscriptionInput,
} from "./types";

function getConfig() {
  const apiKey = process.env.ASAAS_API_KEY;
  const baseUrl = process.env.ASAAS_BASE_URL ?? "https://sandbox.asaas.com/api/v3";

  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada");

  return { apiKey, baseUrl };
}

async function asaasFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { apiKey, baseUrl } = getConfig();

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...options.headers,
    },
    // Não cachear respostas da API de pagamentos
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(sem corpo)");
    throw new Error(`Asaas ${res.status} em ${path}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ── Customers ─────────────────────────────────────────────────────────────────

export async function createAsaasCustomer(input: CreateCustomerInput): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getAsaasCustomerByExternalRef(
  externalRef: string
): Promise<AsaasCustomer | null> {
  const list = await asaasFetch<AsaasListResponse<AsaasCustomer>>(
    `/customers?externalReference=${encodeURIComponent(externalRef)}`
  );
  return list.data[0] ?? null;
}

export async function findAsaasCustomerByCpfCnpj(
  cpfCnpj: string
): Promise<AsaasCustomer | null> {
  const clean = cpfCnpj.replace(/\D/g, "");
  const list = await asaasFetch<AsaasListResponse<AsaasCustomer>>(
    `/customers?cpfCnpj=${encodeURIComponent(clean)}`
  );
  return list.data[0] ?? null;
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export async function createAsaasSubscription(
  input: CreateSubscriptionInput
): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getAsaasSubscription(
  subscriptionId: string
): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>(`/subscriptions/${subscriptionId}`);
}

export async function cancelAsaasSubscription(subscriptionId: string): Promise<void> {
  await asaasFetch(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
}

export async function listSubscriptionPayments(
  subscriptionId: string,
  limit = 10
): Promise<AsaasPayment[]> {
  const list = await asaasFetch<AsaasListResponse<AsaasPayment>>(
    `/subscriptions/${subscriptionId}/payments?limit=${limit}`
  );
  return list.data;
}

// ── Pagamentos avulsos (cobranças) ────────────────────────────────────────────

export async function getAsaasPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(`/payments/${paymentId}`);
}
