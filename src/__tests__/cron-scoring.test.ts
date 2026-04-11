import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runPool } from "@/lib/concurrency";

const CONCURRENCY_LIMIT = 5;

// ── Mocks globais ──────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockFetch = vi.fn();

const subestacoes = [
  { id: "sub-1", nome: "Subestação Norte" },
  { id: "sub-2", nome: "Subestação Sul" },
  { id: "sub-3", nome: "Subestação Centro" },
];

function buildRequest(secret = "test-secret") {
  return new Request("http://localhost/api/cron/scoring", {
    headers: { Authorization: `Bearer ${secret}` },
  });
}

function setupEnv() {
  process.env.CRON_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
}

function setupSupabaseMock(data = subestacoes, error: null | object = null) {
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockResolvedValue({ data, error });
}

function setupScoringEngineMock(result: object = { alertas_gerados: 2, perda_pct: "12.5" }) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => result,
  });
}

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("runPool", () => {
  it("retorna array vazio para lista vazia", async () => {
    const result = await runPool([], 5, async (x) => x);
    expect(result).toEqual([]);
  });

  it("preserva a ordem dos resultados", async () => {
    const items = [3, 1, 4, 1, 5, 9, 2, 6];
    const result = await runPool(items, 3, async (n) => n * 2);
    expect(result).toEqual(items.map((n) => n * 2));
  });

  it("executa com concorrência real — máximo de workers simultâneos não excede o limite", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);

    await runPool(items, CONCURRENCY_LIMIT, async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 5));
      concurrent--;
    });

    expect(maxConcurrent).toBeLessThanOrEqual(CONCURRENCY_LIMIT);
    expect(maxConcurrent).toBeGreaterThan(1); // executou em paralelo
  });

  it("processa todos os items mesmo que alguns falhem", async () => {
    const items = ["ok", "fail", "ok"];
    const result = await runPool(items, 2, async (x) => {
      if (x === "fail") throw new Error("ops");
      return x;
    });

    // runPool agora é resiliente: retorna os resultados com os erros individuais
    // sem rejeitar a promessa global do pool.
    expect(result[0]).toBe("ok");
    expect(result[1]).toBeInstanceOf(Error);
    expect((result[1] as Error).message).toBe("ops");
    expect(result[2]).toBe("ok");
  });

  it("com menos items que o limite usa apenas os workers necessários", async () => {
    const calls: number[] = [];
    const items = [10, 20];

    await runPool(items, 10, async (n) => {
      calls.push(n);
    });

    expect(calls.sort()).toEqual([10, 20]);
  });
});

describe("GET /api/cron/scoring", () => {
  beforeEach(() => {
    setupEnv();
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  // ── Autorização ──────────────────────────────────────────────────────────────

  it("retorna 401 quando o header Authorization está errado", async () => {
    const { GET } = await import("@/app/api/cron/scoring/route");
    const res = await GET(buildRequest("wrong-secret"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("retorna 401 quando o header Authorization está ausente", async () => {
    const { GET } = await import("@/app/api/cron/scoring/route");
    const res = await GET(new Request("http://localhost/api/cron/scoring"));
    expect(res.status).toBe(401);
  });

  // ── Configuração ─────────────────────────────────────────────────────────────

  it("retorna 500 quando CRON_SECRET não está definido", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/cron/scoring/route");
    const res = await GET(buildRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/CRON_SECRET/);
  });

  it("retorna 500 quando NEXT_PUBLIC_SUPABASE_URL não está definida", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const { GET } = await import("@/app/api/cron/scoring/route");
    const res = await GET(buildRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/SUPABASE_URL/);
  });

  it("retorna 500 quando SUPABASE_SERVICE_ROLE_KEY não está definida", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { GET } = await import("@/app/api/cron/scoring/route");
    const res = await GET(buildRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/SERVICE_ROLE_KEY/);
  });

  // ── Erro na query de subestações ─────────────────────────────────────────────

  it("retorna 500 quando a query de subestações falha", async () => {
    setupSupabaseMock([], { message: "connection refused" });
    const { GET } = await import("@/app/api/cron/scoring/route");
    const res = await GET(buildRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/subestações/i);
  });

  // ── Happy path ───────────────────────────────────────────────────────────────

  it("processa todas as subestações em paralelo e agrega resultados corretamente", async () => {
    setupSupabaseMock();
    setupScoringEngineMock({ alertas_gerados: 3, perda_pct: "14.2" });

    const { GET } = await import("@/app/api/cron/scoring/route");
    const res = await GET(buildRequest());

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.subestacoes_processadas).toBe(3);
    expect(body.total_alertas_gerados).toBe(9); // 3 subestações × 3 alertas
    expect(body.erros).toBe(0);
    expect(body.resultados).toHaveLength(3);
    expect(body.resultados[0].subestacao_id).toBe("sub-1");
    expect(body.resultados[1].subestacao_id).toBe("sub-2");
    expect(body.resultados[2].subestacao_id).toBe("sub-3");
  });

  it("inclui x-request-id no cabeçalho da resposta", async () => {
    setupSupabaseMock([]);
    const { GET } = await import("@/app/api/cron/scoring/route");
    const res = await GET(buildRequest());
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("contabiliza erros individualmente sem abortar as restantes subestações", async () => {
    setupSupabaseMock();

    // sub-2 falha sempre, sub-1 e sub-3 têm sucesso
    let callCount = 0;
    mockFetch.mockImplementation(async (_url: string, opts: RequestInit) => {
      callCount++;
      const body = JSON.parse(opts.body as string) as { subestacao_id: string };
      if (body.subestacao_id === "sub-2") {
        return { ok: false, status: 500, json: async () => ({ error: "engine crash" }) };
      }
      return { ok: true, json: async () => ({ alertas_gerados: 2, perda_pct: "10.0" }) };
    });

    const { GET } = await import("@/app/api/cron/scoring/route");
    const res = await GET(buildRequest());

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.erros).toBe(1);
    expect(body.total_alertas_gerados).toBe(4); // só sub-1 e sub-3
    // sub-2 regista o erro no seu resultado
    const sub2 = body.resultados.find(
      (r: { subestacao_id: string }) => r.subestacao_id === "sub-2"
    );
    expect(sub2.error).toMatch(/Falha após/);
    // fetch chamado 3× por sub-2 (retries) + 1× cada para sub-1 e sub-3
    expect(callCount).toBe(5);
  });

  it("retorna 200 com lista vazia quando não há subestações ativas", async () => {
    setupSupabaseMock([]);
    const { GET } = await import("@/app/api/cron/scoring/route");
    const res = await GET(buildRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subestacoes_processadas).toBe(0);
    expect(body.total_alertas_gerados).toBe(0);
    expect(body.resultados).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("executa scoring em paralelo real — N subestações terminam em tempo < N × delay", async () => {
    const muitas = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, nome: `Sub ${i}` }));
    setupSupabaseMock(muitas);

    const DELAY = 30;
    mockFetch.mockImplementation(
      () =>
        new Promise((r) =>
          setTimeout(() => r({ ok: true, json: async () => ({ alertas_gerados: 1 }) }), DELAY)
        )
    );

    const { GET } = await import("@/app/api/cron/scoring/route");
    const start = Date.now();
    const res = await GET(buildRequest());
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    // Sequencial: 10 × 30ms = 300ms. Paralelo (C=5): 2 rondas × 30ms = ~60ms
    // Margem generosa para CI lento: < 250ms confirma que não foi sequencial
    expect(elapsed).toBeLessThan(10 * DELAY * 0.8);
  });
});
