import { createHmac } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  calcularDataExpiracaoPix,
  montarManifestWebhook,
  tokenPrecisaRenovar,
  verificarAssinaturaWebhook,
} from "./mercadopago-client";

describe("montarManifestWebhook", () => {
  it("monta a manifest exatamente no formato exigido pelo Mercado Pago", () => {
    expect(montarManifestWebhook("123456", "req-1", "1700000000")).toBe(
      "id:123456;request-id:req-1;ts:1700000000;",
    );
  });
});

describe("verificarAssinaturaWebhook", () => {
  const secret = "segredo-de-teste";

  function assinar(dataId: string, requestId: string, ts: string): string {
    const manifest = montarManifestWebhook(dataId, requestId, ts);
    const hash = createHmac("sha256", secret).update(manifest).digest("hex");
    return `ts=${ts},v1=${hash}`;
  }

  it("aceita assinatura válida", () => {
    const header = assinar("999", "req-abc", "1700000000");
    expect(
      verificarAssinaturaWebhook({
        xSignatureHeader: header,
        xRequestId: "req-abc",
        dataId: "999",
        secret,
      }),
    ).toBe(true);
  });

  it("rejeita hash incorreto", () => {
    expect(
      verificarAssinaturaWebhook({
        xSignatureHeader: "ts=1700000000,v1=deadbeef",
        xRequestId: "req-abc",
        dataId: "999",
        secret,
      }),
    ).toBe(false);
  });

  it("rejeita se dataId ou requestId usados no cálculo forem diferentes dos reais", () => {
    const header = assinar("999", "req-abc", "1700000000");
    expect(
      verificarAssinaturaWebhook({
        xSignatureHeader: header,
        xRequestId: "req-outro",
        dataId: "999",
        secret,
      }),
    ).toBe(false);
  });

  it("rejeita header malformado sem lançar", () => {
    expect(
      verificarAssinaturaWebhook({
        xSignatureHeader: "lixo-sem-formato",
        xRequestId: "req-abc",
        dataId: "999",
        secret,
      }),
    ).toBe(false);
  });
});

describe("tokenPrecisaRenovar", () => {
  it("nunca renovado (sem data) precisa renovar", () => {
    expect(tokenPrecisaRenovar(null, new Date("2026-07-21T00:00:00Z"))).toBe(true);
  });

  it("ainda longe do vencimento não precisa renovar", () => {
    expect(
      tokenPrecisaRenovar("2027-01-01T00:00:00Z", new Date("2026-07-21T00:00:00Z")),
    ).toBe(false);
  });

  it("dentro da margem de segurança precisa renovar", () => {
    // Margem: 7 dias antes do vencimento.
    expect(
      tokenPrecisaRenovar("2026-07-25T00:00:00Z", new Date("2026-07-21T00:00:00Z")),
    ).toBe(true);
  });
});

describe("calcularDataExpiracaoPix", () => {
  afterEach(() => vi.useRealTimers());

  it("soma minutos e devolve ISO-8601 válido", () => {
    const agora = new Date("2026-07-21T12:00:00.000Z");
    expect(calcularDataExpiracaoPix(agora, 30)).toBe("2026-07-21T12:30:00.000Z");
  });
});
