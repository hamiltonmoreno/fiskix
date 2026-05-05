/**
 * Rate limiter da API REST pública (Fiskix).
 *
 * Suporta dois backends, escolhidos em runtime:
 *
 *   1. **Upstash Redis** (preferido para produção multi-instância em Vercel).
 *      Activado quando UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *      estão presentes. Usa INCR + EXPIRE para janela fixa por API key.
 *      Atómico, distribuído, sem cold-start penalty.
 *
 *   2. **In-memory** (fallback). Activado por omissão dos env vars.
 *      Adequado para dev local e PoC com 1 cliente B2B; em multi-instância
 *      cada cold-start tem o seu Map → o limite efetivo é N×LIMITE.
 *
 * Limite default: 60 req/min por API key (alinhado com .claude/rules/api-conventions.md).
 *
 * NOTA: a função é async para suportar Upstash. As 4 routes em /api/v1/
 * fazem `await checkRateLimit(...)`.
 */

import { Redis } from "@upstash/redis";
import { logger } from "@/lib/observability/logger";

export const RATE_LIMIT_JANELA_MS = 60_000;
export const RATE_LIMIT_LIMITE = 60;

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  /** Backend usado (útil para logging/métricas). */
  backend: "upstash" | "memory";
}

// ─── In-memory backend ────────────────────────────────────────────────────────

const memoryBuckets = new Map<string, Bucket>();

function checkMemory(key: string, now: number): RateLimitResult {
  let bucket = memoryBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_JANELA_MS };
    memoryBuckets.set(key, bucket);
  }
  bucket.count++;
  return {
    allowed: bucket.count <= RATE_LIMIT_LIMITE,
    remaining: Math.max(0, RATE_LIMIT_LIMITE - bucket.count),
    resetAt: bucket.resetAt,
    backend: "memory",
  };
}

// ─── Upstash backend ──────────────────────────────────────────────────────────

let _redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (_redisClient) return _redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redisClient = new Redis({ url, token });
  return _redisClient;
}

async function checkUpstash(redis: Redis, key: string, now: number): Promise<RateLimitResult> {
  const redisKey = `fiskix:ratelimit:${key}`;
  const windowSeconds = Math.ceil(RATE_LIMIT_JANELA_MS / 1000);

  // INCR é atómico. Se for o primeiro hit (count === 1), define TTL para a janela.
  // Caso contrário, a chave já tem TTL e expira sozinha.
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, windowSeconds);
  }

  // Obter TTL para resetAt; se -1 (sem TTL), define-o (defensivo contra race).
  let ttlSec = await redis.ttl(redisKey);
  if (ttlSec < 0) {
    await redis.expire(redisKey, windowSeconds);
    ttlSec = windowSeconds;
  }

  return {
    allowed: count <= RATE_LIMIT_LIMITE,
    remaining: Math.max(0, RATE_LIMIT_LIMITE - count),
    resetAt: now + ttlSec * 1000,
    backend: "upstash",
  };
}

// ─── API pública ──────────────────────────────────────────────────────────────

export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const now = Date.now();
  const redis = getRedisClient();

  if (!redis) {
    return checkMemory(key, now);
  }

  try {
    return await checkUpstash(redis, key, now);
  } catch (err) {
    // Se o Redis falhar, NÃO bloquear o caller — fail-open com fallback memória.
    // Em alternativa pode-se fail-closed (devolver allowed=false) se preferires
    // segurança a disponibilidade. Para a API pública da Electra (B2B PoC),
    // fail-open é preferido para não derrubar a integração por incidente Upstash.
    logger().warn("rate_limit.upstash_failed_falling_back_to_memory", {
      error: err instanceof Error ? err.message : String(err),
    });
    return checkMemory(key, now);
  }
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Limpa estado interno — apenas para testes (NÃO usar em código de produção). */
export function _resetForTests() {
  memoryBuckets.clear();
  _redisClient = null;
}
