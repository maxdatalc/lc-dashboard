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

export interface MercadoPagoPixPointOfInteraction {
  transaction_data: {
    qr_code: string;
    qr_code_base64: string;
    ticket_url: string;
  };
}

export interface MercadoPagoCard {
  last_four_digits: string;
}

export interface MercadoPagoPaymentResponse {
  id: number;
  status: string; // "pending" | "approved" | "rejected" | "cancelled" | ...
  status_detail: string;
  date_of_expiration: string | null;
  transaction_amount: number;
  point_of_interaction?: MercadoPagoPixPointOfInteraction; // PIX-only
  card?: MercadoPagoCard; // cartão-only
}

export interface MercadoPagoError {
  message?: string;
  error?: string;
  status?: number;
}
