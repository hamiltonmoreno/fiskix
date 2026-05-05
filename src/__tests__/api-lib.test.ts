import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────────
//
// A chain Supabase usada por verificarApiKey é:
//   from(table).select(cols).like(col, pattern).eq(col, hash).maybeSingle()

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockLike = vi.fn(() => ({ eq: mockEq }));
const mockSelect = vi.fn(() => ({ like: mockLike }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}));

// ── Tests: lib/api/auth.ts ─────────────────────────────────────────────────────

describe("verificarApiKey", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  function buildRequest(authHeader?: string) {
    return new Request("http://localhost/api/v1/alertas", {
      headers: authHeader ? { Authorization: authHeader } : {},
    });
  }

  it("retorna null quando não há header Authorization", async () => {
    const { verificarApiKey } = await import("@/lib/api/auth");
    const result = await verificarApiKey(buildRequest());
    expect(result).toBeNull();
  });

  it("retorna null quando o header não começa com Bearer", async () => {
    const { verificarApiKey } = await import("@/lib/api/auth");
    const result = await verificarApiKey(buildRequest("Basic abc123"));
    expect(result).toBeNull();
  });

  it("retorna null quando a chave não existe na BD", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { verificarApiKey } = await import("@/lib/api/auth");
    const result = await verificarApiKey(buildRequest("Bearer chave-invalida"));
    expect(result).toBeNull();
  });

  it("retorna o nome do cliente quando a chave é válida", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { chave: "api_key_electra" },
      error: null,
    });

    const { verificarApiKey } = await import("@/lib/api/auth");
    const result = await verificarApiKey(buildRequest("Bearer chave-valida-123"));
    expect(result).toBe("electra");
  });

  it("hash do input é usado na query .eq() (apenas hash, sem plaintext)", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { chave: "api_key_electra" },
      error: null,
    });

    const { verificarApiKey } = await import("@/lib/api/auth");
    await verificarApiKey(buildRequest("Bearer chave-x"));

    const eqCallArgs = mockEq.mock.calls[0] as unknown as [string, string];
    expect(eqCallArgs[0]).toBe("valor");
    expect(eqCallArgs[1]).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
    expect(eqCallArgs[1]).not.toBe("chave-x"); // plaintext NÃO é enviado
  });

  it("retorna null quando a query Supabase falha", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "connection error" } });

    const { verificarApiKey } = await import("@/lib/api/auth");
    const result = await verificarApiKey(buildRequest("Bearer qualquer-chave"));
    expect(result).toBeNull();
  });

  it("retorna null quando as variáveis de ambiente estão ausentes", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const { verificarApiKey } = await import("@/lib/api/auth");
    const result = await verificarApiKey(buildRequest("Bearer qualquer-chave"));
    expect(result).toBeNull();
  });
});

// ── Tests: lib/api/rateLimit.ts ────────────────────────────────────────────────
//
// Estes testes cobrem o backend in-memory (default sem env vars Upstash).
// O backend Upstash é testado em rateLimit-upstash.test.ts com mocks dedicados.

describe("checkRateLimit (memory backend)", () => {
  it("permite o primeiro request", async () => {
    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    const { allowed, backend } = await checkRateLimit(`key-${Date.now()}-1`);
    expect(allowed).toBe(true);
    expect(backend).toBe("memory");
  });

  it("decrementa o remaining a cada chamada", async () => {
    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    const key = `key-${Date.now()}-2`;
    const r1 = await checkRateLimit(key);
    const r2 = await checkRateLimit(key);
    expect(r2.remaining).toBe(r1.remaining - 1);
  });

  it("bloqueia após exceder o limite de 60 por minuto", async () => {
    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    const key = `key-${Date.now()}-3`;
    // Consumir todos os 60 slots
    for (let i = 0; i < 60; i++) await checkRateLimit(key);
    const { allowed, remaining } = await checkRateLimit(key);
    expect(allowed).toBe(false);
    expect(remaining).toBe(0);
  });

  it("fornece resetAt como timestamp futuro", async () => {
    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    const key = `key-${Date.now()}-4`;
    const { resetAt } = await checkRateLimit(key);
    expect(resetAt).toBeGreaterThan(Date.now());
  });

  it("trata chaves diferentes de forma independente", async () => {
    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    const keyA = `key-${Date.now()}-A`;
    const keyB = `key-${Date.now()}-B`;
    for (let i = 0; i < 60; i++) await checkRateLimit(keyA);
    const { allowed } = await checkRateLimit(keyB);
    expect(allowed).toBe(true); // B não foi afectado por A
  });
});

// ── Tests: lib/api/response.ts ─────────────────────────────────────────────────

describe("parsePaginacao", () => {
  it("usa defaults quando não há parâmetros", async () => {
    const { parsePaginacao } = await import("@/lib/api/response");
    const params = new URLSearchParams();
    const { limit, offset, page } = parsePaginacao(params);
    expect(limit).toBe(50);
    expect(offset).toBe(0);
    expect(page).toBe(1);
  });

  it("calcula offset correctamente para página 2", async () => {
    const { parsePaginacao } = await import("@/lib/api/response");
    const params = new URLSearchParams({ limit: "10", page: "2" });
    const { limit, offset, page } = parsePaginacao(params);
    expect(limit).toBe(10);
    expect(offset).toBe(10);
    expect(page).toBe(2);
  });

  it("limita o máximo a 100 registos por página", async () => {
    const { parsePaginacao } = await import("@/lib/api/response");
    const params = new URLSearchParams({ limit: "999" });
    const { limit } = parsePaginacao(params);
    expect(limit).toBe(100);
  });

  it("garante mínimo de 1 registo por página", async () => {
    const { parsePaginacao } = await import("@/lib/api/response");
    const params = new URLSearchParams({ limit: "0" });
    const { limit } = parsePaginacao(params);
    expect(limit).toBe(1);
  });
});

describe("apiError", () => {
  it("retorna response com status correcto e corpo JSON", async () => {
    const { apiError } = await import("@/lib/api/response");
    const res = await apiError("Não encontrado", 404);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Não encontrado");
  });

  it("usa 400 como status por defeito", async () => {
    const { apiError } = await import("@/lib/api/response");
    const res = await apiError("Parâmetro inválido");
    expect(res.status).toBe(400);
  });

  it("usa wildcard CORS quando request não é fornecido (legacy callsites)", async () => {
    const { apiError } = await import("@/lib/api/response");
    const res = await apiError("erro");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
