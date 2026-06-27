import { NextRequest, NextResponse } from "next/server";
import type { AsaasWebhookPayload } from "@/lib/asaas/types";
import {
  getTenantByAsaasCustomer,
  getTenantByAsaasSubscription,
  setTenantSubscriptionStatus,
  activateTenantPremium,
} from "@/lib/db/billing";

// Verifica o token configurado no painel Asaas → Configurações → Webhooks
function verifyToken(req: NextRequest): boolean {
  const token = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!token || token === "TROQUE_POR_TOKEN_SEGURO") return false;

  // Asaas envia o access_token no header Authorization (Bearer) ou no corpo JSON
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const bearer = authHeader.replace(/^Bearer\s+/i, "");
    return bearer === token;
  }

  return false;
}

async function resolveTenantId(payload: AsaasWebhookPayload): Promise<string | null> {
  // Tenta via subscription primeiro (mais específico)
  const subscriptionId =
    payload.subscription?.id ?? payload.payment?.subscription ?? null;

  if (subscriptionId) {
    const tenant = await getTenantByAsaasSubscription(subscriptionId);
    if (tenant) return tenant.id;
  }

  // Fallback: via customer
  const customerId = payload.payment?.customer ?? payload.subscription?.customer ?? null;
  if (customerId) {
    const tenant = await getTenantByAsaasCustomer(customerId);
    if (tenant) return tenant.id;
  }

  return null;
}

export async function POST(req: NextRequest) {
  if (!verifyToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: AsaasWebhookPayload;
  try {
    payload = (await req.json()) as AsaasWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event } = payload;

  // Ignora eventos que não afetam o plano
  const relevantEvents = new Set([
    "PAYMENT_CONFIRMED",
    "PAYMENT_RECEIVED",
    "PAYMENT_OVERDUE",
    "PAYMENT_REFUNDED",
    "SUBSCRIPTION_ACTIVATED",
    "SUBSCRIPTION_INACTIVATED",
    "SUBSCRIPTION_DELETED",
  ]);

  if (!relevantEvents.has(event)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const tenantId = await resolveTenantId(payload);
  if (!tenantId) {
    // Não logamos erro — pode ser um evento de período de testes sem tenant vinculado
    return NextResponse.json({ ok: true, skipped: true });
  }

  switch (event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED": {
      const subscriptionId =
        payload.payment?.subscription ?? payload.subscription?.id ?? null;
      if (subscriptionId) {
        await activateTenantPremium(tenantId, subscriptionId);
      }
      break;
    }

    case "PAYMENT_OVERDUE":
      await setTenantSubscriptionStatus(tenantId, "overdue");
      break;

    case "PAYMENT_REFUNDED":
    case "SUBSCRIPTION_INACTIVATED":
    case "SUBSCRIPTION_DELETED":
      await setTenantSubscriptionStatus(tenantId, "cancelled");
      break;

    case "SUBSCRIPTION_ACTIVATED":
      if (payload.subscription?.id) {
        await activateTenantPremium(tenantId, payload.subscription.id);
      }
      break;
  }

  return NextResponse.json({ ok: true });
}
