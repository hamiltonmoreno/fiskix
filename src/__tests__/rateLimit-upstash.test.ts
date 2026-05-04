/**
 * Testes do backend Upstash do rate limiter — Fiskix
 *
 * O lib/api/rateLimit.ts escolhe Upstash em runtime quando os env vars estão
 * presentes. Estes testes mockam @upstash/redis para verificar:
 *   - INCR + EXPIRE são chamados corretamente
 *   - allowed/remaining derivam de count vs LIMITE
 *   - resetAt = now + ttl*1000
 *   - Em erro do Redis, fail-open com fallback in-memory
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock do @upstash/redis. Cada teste injecta o seu comportamento via factory.
const incrMock = vi.fn();
const expireMock = vi.fn();
const ttlMock = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    incr: incrMock,
    expire: expireMock,
    ttl: ttlMock,
  })),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

const ENV_BACKUP = {
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
});

afterEach(() => {
  if (ENV_BACKUP.UPSTASH_REDIS_REST_URL === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = ENV_BACKUP.UPSTASH_REDIS_REST_URL;
  if (ENV_BACKUP.UPSTASH_REDIS_REST_TOKEN === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = ENV_BACKUP.UPSTASH_REDIS_REST_TOKEN;
});

describe("checkRateLimit — Upstash backend", () => {
  it("usa o backend upstash quando env vars estão presentes", async () => {
    incrMock.mockResolvedValue(1);
    expireMock.mockResolvedValue(1);
    ttlMock.mockResolvedValue(60);

    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    const result = await checkRateLimit("electra");

    expect(result.backend).toBe("upstash");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
  });

  it("incrementa atomicamente e respeita o limite de 60/min", async () => {
    incrMock.mockResolvedValue(60);
    ttlMock.mockResolvedValue(30);

    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    const result = await checkRateLimit("electra");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("bloqueia quando count > LIMITE", async () => {
    incrMock.mockResolvedValue(61);
    ttlMock.mockResolvedValue(20);

    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    const result = await checkRateLimit("electra");

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("define EXPIRE no primeiro hit (count === 1)", async () => {
    incrMock.mockResolvedValue(1);
    expireMock.mockResolvedValue(1);
    ttlMock.mockResolvedValue(60);

    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    await checkRateLimit("electra");

    expect(expireMock).toHaveBeenCalledWith("fiskix:ratelimit:electra", 60);
  });

  it("não chama EXPIRE em hits subsequentes (count > 1)", async () => {
    incrMock.mockResolvedValue(5);
    ttlMock.mockResolvedValue(45);

    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    await checkRateLimit("electra");

    expect(expireMock).not.toHaveBeenCalled();
  });

  it("define EXPIRE defensivamente quando ttl < 0 (race condition)", async () => {
    incrMock.mockResolvedValue(2);
    ttlMock.mockResolvedValue(-1);
    expireMock.mockResolvedValue(1);

    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    const result = await checkRateLimit("electra");

    expect(expireMock).toHaveBeenCalledWith("fiskix:ratelimit:electra", 60);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it("calcula resetAt como now + ttl*1000", async () => {
    const before = Date.now();
    incrMock.mockResolvedValue(3);
    ttlMock.mockResolvedValue(45);

    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    const result = await checkRateLimit("electra");

    expect(result.resetAt).toBeGreaterThanOrEqual(before + 45_000 - 100);
    expect(result.resetAt).toBeLessThanOrEqual(Date.now() + 45_000 + 100);
  });

  it("usa namespace fiskix:ratelimit: na key do Redis", async () => {
    incrMock.mockResolvedValue(1);
    expireMock.mockResolvedValue(1);
    ttlMock.mockResolvedValue(60);

    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    await checkRateLimit("cliente-X");

    expect(incrMock).toHaveBeenCalledWith("fiskix:ratelimit:cliente-X");
  });

  it("fail-open: em erro do Redis, cai para backend memory", async () => {
    incrMock.mockRejectedValue(new Error("upstash 503"));

    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    const result = await checkRateLimit("electra");

    expect(result.backend).toBe("memory");
    expect(result.allowed).toBe(true);
  });
});

describe("checkRateLimit — sem env vars de Upstash", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("usa o backend memory quando env vars estão ausentes", async () => {
    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    const result = await checkRateLimit(`memory-test-${Date.now()}`);

    expect(result.backend).toBe("memory");
    // incr nunca foi chamado porque o cliente Redis não foi instanciado
    expect(incrMock).not.toHaveBeenCalled();
  });
});
