/**
 * Constant-time string comparisons — defesa contra timing attacks.
 *
 * Para comparação de segredos (API keys, CRON_SECRET, JWT signatures), `===`
 * é early-exit e teoricamente permite recuperação byte-a-byte do segredo via
 * medições estatísticas. Estes helpers comparam em tempo proporcional ao
 * comprimento (sem early-exit em mismatch).
 *
 * Length pre-check é OK — comprimento de segredos é informação pública.
 *
 * Compatível com Node (Next.js routes) E Deno (edge functions).
 */

/** Compara duas strings em tempo constante (length pre-check + XOR scan). */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** SHA-256 hex digest. Usado para hash de API keys em configuracoes. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
