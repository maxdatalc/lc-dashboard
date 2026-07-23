export interface MercadoPagoOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // segundos (~180 dias em produção)
  scope: string;
  user_id: number;
  refresh_token: string;
  public_key: string;
  live_mode: boolean;
}

export interface MercadoPagoPaymentResponse {
  id: number;
  status: string; // "pending" | "approved" | "rejected" | "cancelled" | "in_process" | ...
  status_detail: string;
  transaction_amount: number;
  external_reference: string | null; // pedido_id, setado por nós ao criar a preference
  payment_type_id: string | null; // "credit_card" | "pix" | "ticket" | ... -> vira `metodo`
  payment_method_id: string | null; // "visa", "pix", "bolbradesco", ...
}

export interface MercadoPagoPreferenceResponse {
  id: string;
  init_point: string;
  sandbox_init_point: string;
}

export interface MercadoPagoError {
  message?: string;
  error?: string;
  status?: number;
}
