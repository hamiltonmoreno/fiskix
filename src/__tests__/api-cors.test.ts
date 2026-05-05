/**
 * Testes do CORS dinâmico — Fiskix /api/v1/
 *
 * Cobre:
 * - allowlist vazia → wildcard
 * - allowlist com origins → echo do origin presente
 * - origin ausente da allowlist → null (browser bloqueia)
 * - Vary: Origin presente quando há allowlist específica
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}));

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  vi.clearAllMocks();
});

afterEach(async () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { _resetCorsCacheForTests } = await import("@/lib/api/cors");
  _resetCorsCacheForTests();
});

function buildRequest(origin?: string) {
  return new Request("http://localhost/api/v1/alertas", {
    headers: origin ? { Origin: origin } : {},
  });
}

describe("resolveAllowOrigin", () => {
  it("retorna '*' quando allowlist está vazia (compat retroativa)", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { valor: "" }, error: null });
    const { resolveAllowOrigin } = await import("@/lib/api/cors");
    const allow = await resolveAllowOrigin(buildRequest("https://qualquer.com"));
    expect(allow).toBe("*");
  });

  it("retorna '*' quando a chave config não existe", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { resolveAllowOrigin } = await import("@/lib/api/cors");
    const allow = await resolveAllowOrigin(buildRequest("https://x.com"));
    expect(allow).toBe("*");
  });

  it("ecoa o origin quando está na allowlist", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { valor: "https://erp.electra.cv,https://admin.electra.cv" },
      error: null,
    });
    const { resolveAllowOrigin } = await import("@/lib/api/cors");
    const allow = await resolveAllowOrigin(buildRequest("https://erp.electra.cv"));
    expect(allow).toBe("https://erp.electra.cv");
  });

  it("retorna null quando origin não está na allowlist", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { valor: "https://erp.electra.cv" },
      error: null,
    });
    const { resolveAllowOrigin } = await import("@/lib/api/cors");
    const allow = await resolveAllowOrigin(buildRequest("https://atacante.com"));
    expect(allow).toBeNull();
  });

  it("retorna null quando request não tem Origin e há allowlist específica", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { valor: "https://erp.electra.cv" },
      error: null,
    });
    const { resolveAllowOrigin } = await import("@/lib/api/cors");
    const allow = await resolveAllowOrigin(buildRequest());
    expect(allow).toBeNull();
  });

  it("ignora espaços em branco no CSV", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { valor: "  https://a.com  ,  https://b.com  " },
      error: null,
    });
    const { resolveAllowOrigin } = await import("@/lib/api/cors");
    const allow = await resolveAllowOrigin(buildRequest("https://b.com"));
    expect(allow).toBe("https://b.com");
  });

  it("cache evita hit DB em chamadas seguintes (5 min)", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { valor: "https://a.com" },
      error: null,
    });
    const { resolveAllowOrigin } = await import("@/lib/api/cors");
    await resolveAllowOrigin(buildRequest("https://a.com"));
    await resolveAllowOrigin(buildRequest("https://a.com"));
    await resolveAllowOrigin(buildRequest("https://a.com"));
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
  });
});

describe("corsHeadersFor", () => {
  it("inclui Vary: Origin quando há allowlist específica", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { valor: "https://a.com" },
      error: null,
    });
    const { corsHeadersFor } = await import("@/lib/api/cors");
    const headers = await corsHeadersFor(buildRequest("https://a.com"));
    expect(headers["Vary"]).toBe("Origin");
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://a.com");
  });

  it("não inclui Vary nem Allow-Origin quando origin é rejeitado", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { valor: "https://a.com" },
      error: null,
    });
    const { corsHeadersFor } = await import("@/lib/api/cors");
    const headers = await corsHeadersFor(buildRequest("https://x.com"));
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(headers["Vary"]).toBeUndefined();
  });

  it("sempre inclui Cache-Control e Allow-Headers", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { corsHeadersFor } = await import("@/lib/api/cors");
    const headers = await corsHeadersFor(buildRequest());
    expect(headers["Cache-Control"]).toBe("no-store");
    expect(headers["Access-Control-Allow-Headers"]).toMatch(/authorization/);
  });
});
