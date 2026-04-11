/**
 * Rate limiter simples em memória.
 * NOTA: não é distribuído — em ambientes multi-instância (Vercel prod)
 * cada instância tem o seu contador. Para a PoC com um único cliente
 * B2B é suficiente. Migrar para Supabase ou Vercel KV se escalar.
 *
 * Limite: 60 requests por minuto por API key.
 */

const JANELA_MS = 60_000;
const LIMITE = 60;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + JANELA_MS };
    buckets.set(key, bucket);
  }

  bucket.count++;

  const allowed = bucket.count <= LIMITE;
  const remaining = Math.max(0, LIMITE - bucket.count);

  return { allowed, remaining, resetAt: bucket.resetAt };
}
