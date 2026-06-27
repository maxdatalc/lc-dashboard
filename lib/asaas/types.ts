// Tipos TypeScript para a API Asaas v3

export type AsaasBillingType = "BOLETO" | "CREDIT_CARD" | "PIX" | "UNDEFINED";

export type AsaasSubscriptionCycle =
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMIANNUALLY"
  | "YEARLY";

export type AsaasSubscriptionStatus = "ACTIVE" | "INACTIVE" | "EXPIRED";

export type AsaasPaymentStatus =
  | "PENDING"
  | "RECEIVED"
  | "CONFIRMED"
  | "OVERDUE"
  | "REFUNDED"
  | "RECEIVED_IN_CASH"
  | "REFUND_REQUESTED"
  | "CHARGEBACK_REQUESTED"
  | "CHARGEBACK_DISPUTE"
  | "AWAITING_CHARGEBACK_REVERSAL"
  | "DUNNING_REQUESTED"
  | "DUNNING_RECEIVED"
  | "AWAITING_RISK_ANALYSIS";

export type AsaasCustomer = {
  id: string;
  name: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
  deleted?: boolean;
};

export type CreateCustomerInput = {
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  externalReference?: string; // tenant ID para rastreabilidade
  notificationDisabled?: boolean;
};

export type AsaasSubscription = {
  id: string;
  customer: string;
  billingType: AsaasBillingType;
  cycle: AsaasSubscriptionCycle;
  value: number;
  nextDueDate: string;
  description?: string;
  status: AsaasSubscriptionStatus;
  externalReference?: string;
  paymentLink?: string;
  deleted?: boolean;
};

export type CreateSubscriptionInput = {
  customer: string; // asaas customer ID
  billingType: AsaasBillingType;
  value: number;
  nextDueDate: string; // yyyy-MM-dd
  cycle: AsaasSubscriptionCycle;
  description?: string;
  externalReference?: string; // tenant ID
};

export type AsaasPayment = {
  id: string;
  customer: string;
  subscription?: string;
  billingType: AsaasBillingType;
  value: number;
  netValue?: number;
  dueDate: string;
  paymentDate?: string;
  description?: string;
  status: AsaasPaymentStatus;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  transactionReceiptUrl?: string;
};

export type AsaasListResponse<T> = {
  object: "list";
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: T[];
};

// Eventos enviados pelo webhook Asaas
export type AsaasWebhookEventType =
  | "PAYMENT_CREATED"
  | "PAYMENT_UPDATED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_DELETED"
  | "PAYMENT_RESTORED"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_RECEIVED_IN_CASH_UNDONE"
  | "PAYMENT_CHARGEBACK_REQUESTED"
  | "PAYMENT_DUNNING_RECEIVED"
  | "PAYMENT_DUNNING_REQUESTED"
  | "SUBSCRIPTION_CREATED"
  | "SUBSCRIPTION_UPDATED"
  | "SUBSCRIPTION_DELETED"
  | "SUBSCRIPTION_INACTIVATED"
  | "SUBSCRIPTION_ACTIVATED"
  | "SUBSCRIPTION_RENEWED";

export type AsaasWebhookPayload = {
  event: AsaasWebhookEventType;
  payment?: AsaasPayment;
  subscription?: AsaasSubscription;
};
