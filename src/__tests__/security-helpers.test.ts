/**
 * Testes dos security helpers — Fiskix
 *
 * - constantTimeEqual: timing-safe string compare
 * - sha256Hex: hex digest determinístico
 * - verifyCronAuth: combinação de timing-safe Bearer + user-agent check
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  constantTimeEqual,
  sha256Hex,
} from "@/lib/security/constant-time";
import { verifyCronAuth } from "@/lib/security/cron-auth";

describe("constantTimeEqual", () => {
  it("retorna true para strings iguais", () => {
    expect(constantTimeEqual("hello", "hello")).toBe(true);
    expect(constantTimeEqual("", "")).toBe(true);
  });

  it("retorna false para strings diferentes do mesmo comprimento", () => {
    expect(constantTimeEqual("hello", "world")).toBe(false);
    expect(constantTimeEqual("abcdef", "abcdeg")).toBe(false);
  });

  it("retorna false para comprimentos diferentes (length pre-check)", () => {
    expect(constantTimeEqual("short", "longer")).toBe(false);
    expect(constantTimeEqual("a", "")).toBe(false);
  });

  it("aceita strings unicode", () => {
    expect(constantTimeEqual("açúcar", "açúcar")).toBe(true);
    expect(constantTimeEqual("açúcar", "açucar")).toBe(false);
  });
});

describe("sha256Hex", () => {
  it("retorna hex digest determinístico de 64 chars", async () => {
    const h1 = await sha256Hex("hello");
    const h2 = await sha256Hex("hello");
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produz hashes diferentes para inputs diferentes", async () => {
    const h1 = await sha256Hex("a");
    const h2 = await sha256Hex("b");
    expect(h1).not.toBe(h2);
  });

  it("conhece o digest canónico de 'abc'", async () => {
    // SHA-256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    const h = await sha256Hex("abc");
    expect(h).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("verifyCronAuth", () => {
  beforeEach(() => {
    // Os testes assumem dev/test por defeito (skip user-agent check)
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function mkRequest(opts: { authorization?: string; userAgent?: string; vercelCron?: string } = {}) {
    const headers: Record<string, string> = {};
    if (opts.authorization !== undefined) headers["authorization"] = opts.authorization;
    if (opts.userAgent !== undefined) headers["user-agent"] = opts.userAgent;
    if (opts.vercelCron !== undefined) headers["x-vercel-cron"] = opts.vercelCron;
    return new Request("http://localhost/api/cron/scoring", { headers });
  }

  it("rejeita quando cronSecret é undefined (missing_secret)", () => {
    const r = verifyCronAuth(mkRequest({ authorization: "Bearer x" }), undefined);
    expect(r).toEqual({ ok: false, reason: "missing_secret", status: 500 });
  });

  it("rejeita quando authorization header está ausente", () => {
    const r = verifyCronAuth(mkRequest(), "secret-x");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unauthorized");
  });

  it("rejeita quando bearer token diverge do CRON_SECRET", () => {
    const r = verifyCronAuth(mkRequest({ authorization: "Bearer wrong" }), "secret-x");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unauthorized");
  });

  it("aceita quando bearer token bate certo (em test/dev sem UA check)", () => {
    const r = verifyCronAuth(mkRequest({ authorization: "Bearer secret-x" }), "secret-x");
    expect(r).toEqual({ ok: true });
  });

  it("aceita request sem user-agent quando NODE_ENV != production", () => {
    const r = verifyCronAuth(mkRequest({ authorization: "Bearer s" }), "s");
    expect(r.ok).toBe(true);
  });

  describe("em production", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
    });

    it("rejeita quando UA não é vercel-cron e sem header x-vercel-cron", () => {
      const r = verifyCronAuth(
        mkRequest({ authorization: "Bearer s", userAgent: "curl/7.85" }),
        "s"
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("invalid_caller");
    });

    it("aceita quando UA começa com vercel-cron/", () => {
      const r = verifyCronAuth(
        mkRequest({ authorization: "Bearer s", userAgent: "vercel-cron/1.0" }),
        "s"
      );
      expect(r).toEqual({ ok: true });
    });

    it("aceita quando header x-vercel-cron: 1 está presente", () => {
      const r = verifyCronAuth(
        mkRequest({ authorization: "Bearer s", userAgent: "anything", vercelCron: "1" }),
        "s"
      );
      expect(r).toEqual({ ok: true });
    });

    it("rejeita header x-vercel-cron com valor diferente de '1'", () => {
      const r = verifyCronAuth(
        mkRequest({ authorization: "Bearer s", userAgent: "x", vercelCron: "true" }),
        "s"
      );
      expect(r.ok).toBe(false);
    });
  });
});
