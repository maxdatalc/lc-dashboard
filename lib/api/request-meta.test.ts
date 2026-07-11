import { describe, it, expect } from "vitest";
import { clientIpFromHeaders } from "./request-meta";

describe("clientIpFromHeaders", () => {
  it("retorna o primeiro IP de x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.9, 70.41.3.18" });
    expect(clientIpFromHeaders(h)).toBe("203.0.113.9");
  });

  it("cai para x-real-ip quando não há x-forwarded-for", () => {
    const h = new Headers({ "x-real-ip": "198.51.100.7" });
    expect(clientIpFromHeaders(h)).toBe("198.51.100.7");
  });

  it("retorna null quando não há nenhum header de IP", () => {
    expect(clientIpFromHeaders(new Headers())).toBeNull();
  });
});
