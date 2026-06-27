// Funções de banco de dados para billing — uso exclusivo server-side (admin)
import { createAdminClient } from "@/lib/supabase/server";

export type TenantBilling = {
  id: string;
  name: string;
  plan: "free" | "premium";
  subscriptionStatus: "active" | "inactive" | "overdue" | "cancelled" | null;
  asaasCustomerId: string | null;
  asaasSubscriptionId: string | null;
};

export async function getTenantBilling(tenantId: string): Promise<TenantBilling | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, plan, subscription_status, asaas_customer_id, asaas_subscription_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as Record<string, unknown>;

  return {
    id: row.id as string,
    name: row.name as string,
    plan: (row.plan as "free" | "premium") ?? "free",
    subscriptionStatus: (row.subscription_status as TenantBilling["subscriptionStatus"]) ?? null,
    asaasCustomerId: (row.asaas_customer_id as string) ?? null,
    asaasSubscriptionId: (row.asaas_subscription_id as string) ?? null,
  };
}

export async function setTenantAsaasCustomer(
  tenantId: string,
  asaasCustomerId: string
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("tenants")
    .update({ asaas_customer_id: asaasCustomerId })
    .eq("id", tenantId);

  if (error) throw new Error(error.message);
}

export async function activateTenantPremium(
  tenantId: string,
  asaasSubscriptionId: string
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("tenants")
    .update({
      plan: "premium",
      subscription_status: "active",
      asaas_subscription_id: asaasSubscriptionId,
    })
    .eq("id", tenantId);

  if (error) throw new Error(error.message);
}

export async function setTenantSubscriptionStatus(
  tenantId: string,
  status: "active" | "inactive" | "overdue" | "cancelled"
): Promise<void> {
  const supabase = createAdminClient();

  // Downgrade para free quando a assinatura é cancelada ou inativa
  const plan = status === "active" ? "premium" : "free";

  const { error } = await supabase
    .from("tenants")
    .update({ subscription_status: status, plan })
    .eq("id", tenantId);

  if (error) throw new Error(error.message);
}

// Lookup pelo ID do customer Asaas — usado no webhook
export async function getTenantByAsaasCustomer(
  asaasCustomerId: string
): Promise<{ id: string; plan: string; subscriptionStatus: string | null } | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("tenants")
    .select("id, plan, subscription_status")
    .eq("asaas_customer_id", asaasCustomerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as Record<string, unknown>;

  return {
    id: row.id as string,
    plan: (row.plan as string) ?? "free",
    subscriptionStatus: (row.subscription_status as string) ?? null,
  };
}

// Lookup pelo ID da subscription Asaas — usado no webhook
export async function getTenantByAsaasSubscription(
  asaasSubscriptionId: string
): Promise<{ id: string; plan: string } | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("tenants")
    .select("id, plan")
    .eq("asaas_subscription_id", asaasSubscriptionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as Record<string, unknown>;

  return {
    id: row.id as string,
    plan: (row.plan as string) ?? "free",
  };
}
