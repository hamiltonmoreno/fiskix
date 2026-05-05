/**
 * Extrai o IP do cliente. Em produção (Vercel), usa o primeiro IP de
 * `x-forwarded-for` (cadeia de proxies). Fallback para `x-real-ip`.
 *
 * Returns "unknown" se nenhum header disponível — evita NPE; o caller
 * usa o valor como bucket key de rate limit, não para autenticação.
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    // Primeiro IP é o cliente original; restantes são proxies
    return xff.split(",")[0]!.trim();
  }
  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();
  return "unknown";
}
