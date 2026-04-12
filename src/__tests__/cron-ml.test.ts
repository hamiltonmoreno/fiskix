import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
];

function buildRequest(secret = "test-secret") {
  return new Request("http://localhost/api/cron/ml", {
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

function setupMLScoringMock(result: object = { scored: 5 }) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => result,
  });
}

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("GET /api/cron/ml", () => {
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
    const { GET } = await import("@/app/api/cron/ml/route");
    const res = await GET(buildRequest("wrong-secret"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("retorna 401 quando o header Authorization está ausente", async () => {
    const { GET } = await import("@/app/api/cron/ml/route");
    const res = await GET(new Request("http://localhost/api/cron/ml"));
    expect(res.status).toBe(401);
  });

  // ── Configuração ─────────────────────────────────────────────────────────────

  it("retorna 500 quando CRON_SECRET não está definido", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/cron/ml/route");
    const res = await GET(buildRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/CRON_SECRET/);
  });

  it("retorna 500 quando variáveis de ambiente Supabase estão ausentes", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const { GET } = await import("@/app/api/cron/ml/route");
    const res = await GET(buildRequest());
    expect(res.status).toBe(500);
  });

  // ── Erro na query de subestações ─────────────────────────────────────────────

  it("retorna 500 quando a query de subestações falha", async () => {
    setupSupabaseMock([], { message: "connection refused" });
    const { GET } = await import("@/app/api/cron/ml/route");
    const res = await GET(buildRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/subestações/i);
  });

  // ── Happy path ───────────────────────────────────────────────────────────────

  it("processa todas as subestações e agrega total_scored", async () => {
    setupSupabaseMock();
    setupMLScoringMock({ scored: 4 });

    const { GET } = await import("@/app/api/cron/ml/route");
    const res = await GET(buildRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subestacoes_processadas).toBe(2);
    expect(body.total_scored).toBe(8); // 2 subestações × 4
    expect(body.erros).toBe(0);
    expect(body.resultados).toHaveLength(2);
  });

  it("inclui x-request-id no cabeçalho da resposta", async () => {
    setupSupabaseMock([]);
    const { GET } = await import("@/app/api/cron/ml/route");
    const res = await GET(buildRequest());
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("retorna 200 com lista vazia quando não há subestações ativas", async () => {
    setupSupabaseMock([]);
    const { GET } = await import("@/app/api/cron/ml/route");
    const res = await GET(buildRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subestacoes_processadas).toBe(0);
    expect(body.total_scored).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("contabiliza erros individualmente sem abortar as restantes subestações", async () => {
    setupSupabaseMock([
      { id: "sub-1", nome: "Sub Norte" },
      { id: "sub-2", nome: "Sub Sul" },
      { id: "sub-3", nome: "Sub Centro" },
    ]);

    mockFetch.mockImplementation(async (_url: string, opts: RequestInit) => {
      const body = JSON.parse(opts.body as string) as { subestacao_id: string };
      if (body.subestacao_id === "sub-2") {
        return { ok: false, status: 500, json: async () => ({ error: "ml engine crash" }) };
      }
      return { ok: true, json: async () => ({ scored: 3 }) };
    });

    const { GET } = await import("@/app/api/cron/ml/route");
    const res = await GET(buildRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.erros).toBe(1);
    expect(body.total_scored).toBe(6); // sub-1 + sub-3 = 3 + 3

    const sub2 = body.resultados.find(
      (r: { subestacao_id: string }) => r.subestacao_id === "sub-2"
    );
    expect(sub2.error).toMatch(/Falha após/);
  });

  it("inclui mes_ano correcto (mês anterior ao actual)", async () => {
    setupSupabaseMock([]);
    const { GET } = await import("@/app/api/cron/ml/route");
    const res = await GET(buildRequest());

    const body = await res.json();
    // mes_ano deve ser o mês anterior no formato YYYY-MM
    expect(body.mes_ano).toMatch(/^\d{4}-\d{2}$/);

    const now = new Date();
    const expected = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const expectedStr = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, "0")}`;
    expect(body.mes_ano).toBe(expectedStr);
  });
});
