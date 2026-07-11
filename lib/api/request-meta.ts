/**
 * Extrai o IP do cliente a partir dos headers da requisição (best-effort).
 * Prefere o primeiro endereço de x-forwarded-for; cai para x-real-ip.
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  return real?.trim() || null;
}
