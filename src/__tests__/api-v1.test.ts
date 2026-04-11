import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks globais ──────────────────────────────────────────────────────────────

// Mock da verificação de API key
vi.mock("@/lib/api/auth", () => ({
  verificarApiKey: vi.fn(),
}));

// Mock do rate limiter — por defeito permite tudo
vi.mock("@/lib/api/rateLimit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 })),
}));

// Mock do Supabase
const mockRange = vi.fn();
const mockOrder = vi.fn(() => ({ range: mockRange }));
const mockGte = vi.fn(() => ({ order: mockOrder }));
const mockEq = vi.fn(() => ({ order: mockOrder, gte: mockGte, single: vi.fn(), in: vi.fn() }));
const mockLike = vi.fn();
const mockIn = vi.fn(() => ({ eq: mockEq, gte: mockGte }));
const mockSelect = vi.fn(() => ({ eq: mockEq, like: mockLike, order: mockOrder, in: mockIn }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}));

function setupEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
}

function buildRequest(url: string, apiKey = "chave-valida") {
  return new Request(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

// ── GET /api/v1/alertas ────────────────────────────────────────────────────────

describe("GET /api/v1/alertas", () => {
  beforeEach(async () => {
    setupEnv();
    vi.clearAllMocks();
    const { verificarApiKey } = await import("@/lib/api/auth");
    vi.mocked(verificarApiKey).mockResolvedValue("electra");
    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 });
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("retorna 401 quando API key é inválida", async () => {
    const { verificarApiKey } = await import("@/lib/api/auth");
    vi.mocked(verificarApiKey).mockResolvedValue(null);

    const { GET } = await import("@/app/api/v1/alertas/route");
    const res = await GET(buildRequest("http://localhost/api/v1/alertas", "invalida"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/API key/i);
  });

  it("retorna 429 quando rate limit é excedido", async () => {
    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const { GET } = await import("@/app/api/v1/alertas/route");
    const res = await GET(buildRequest("http://localhost/api/v1/alertas"));
    expect(res.status).toBe(429);
  });

  it("retorna 200 com lista de alertas e meta de paginação", async () => {
    const alertasMock = [
      { id: "a1", score_risco: 85, status: "Pendente", resultado: null, mes_ano: "2026-03", criado_em: "2026-03-01", clientes: { id: "c1", numero_contador: "CV-001", nome_titular: "João Silva", tipo_tarifa: "Residencial", subestacoes: { id: "s1", nome: "Sub Norte", zona_bairro: "Várzea" } } },
    ];

    mockRange.mockResolvedValue({ data: alertasMock, error: null, count: 1 });

    const { GET } = await import("@/app/api/v1/alertas/route");
    const res = await GET(buildRequest("http://localhost/api/v1/alertas"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.meta.total).toBe(1);
    expect(body.meta.page).toBe(1);
    expect(body.meta.limit).toBe(50);
  });

  it("retorna dados vazios quando não há alertas", async () => {
    mockRange.mockResolvedValue({ data: [], error: null, count: 0 });

    const { GET } = await import("@/app/api/v1/alertas/route");
    const res = await GET(buildRequest("http://localhost/api/v1/alertas"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  it("inclui headers CORS e Cache-Control", async () => {
    mockRange.mockResolvedValue({ data: [], error: null, count: 0 });

    const { GET } = await import("@/app/api/v1/alertas/route");
    const res = await GET(buildRequest("http://localhost/api/v1/alertas"));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("responde ao preflight OPTIONS com 204", async () => {
    const { OPTIONS } = await import("@/app/api/v1/alertas/route");
    const res = await OPTIONS();
    expect(res.status).toBe(204);
  });
});

// ── GET /api/v1/alertas/:id ────────────────────────────────────────────────────

describe("GET /api/v1/alertas/:id", () => {
  beforeEach(async () => {
    setupEnv();
    vi.clearAllMocks();
    const { verificarApiKey } = await import("@/lib/api/auth");
    vi.mocked(verificarApiKey).mockResolvedValue("electra");
    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 });
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("retorna 401 quando API key é inválida", async () => {
    const { verificarApiKey } = await import("@/lib/api/auth");
    vi.mocked(verificarApiKey).mockResolvedValue(null);

    const { GET } = await import("@/app/api/v1/alertas/[id]/route");
    const res = await GET(
      buildRequest("http://localhost/api/v1/alertas/uuid-1", "invalida"),
      { params: Promise.resolve({ id: "uuid-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("retorna 404 quando alerta não existe", async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } });
    mockEq.mockReturnValue({ single: mockSingle });

    const { GET } = await import("@/app/api/v1/alertas/[id]/route");
    const res = await GET(
      buildRequest("http://localhost/api/v1/alertas/inexistente"),
      { params: Promise.resolve({ id: "inexistente" }) }
    );
    expect(res.status).toBe(404);
  });

  it("retorna 200 com detalhe do alerta quando existe", async () => {
    const alertaMock = {
      id: "a1", score_risco: 85, status: "Pendente", resultado: null,
      motivo: [{ regra: "R1", pontos: 20 }], mes_ano: "2026-03",
      criado_em: "2026-03-01", atualizado_em: "2026-03-01",
      clientes: { id: "c1", numero_contador: "CV-001", nome_titular: "João Silva", tipo_tarifa: "Residencial", morada: "Rua A", telemovel: "+238123456", subestacoes: { id: "s1", nome: "Sub Norte", zona_bairro: "Várzea", ilha: "Santiago" } },
    };

    const mockSingle = vi.fn().mockResolvedValue({ data: alertaMock, error: null });
    mockEq.mockReturnValue({ single: mockSingle });

    const { GET } = await import("@/app/api/v1/alertas/[id]/route");
    const res = await GET(
      buildRequest("http://localhost/api/v1/alertas/a1"),
      { params: Promise.resolve({ id: "a1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("a1");
    expect(body.data.motivo).toHaveLength(1);
  });
});

// ── GET /api/v1/balanco ────────────────────────────────────────────────────────

describe("GET /api/v1/balanco", () => {
  beforeEach(async () => {
    setupEnv();
    vi.clearAllMocks();
    const { verificarApiKey } = await import("@/lib/api/auth");
    vi.mocked(verificarApiKey).mockResolvedValue("electra");
    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 });
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("retorna 400 quando mes_ano está ausente", async () => {
    const { GET } = await import("@/app/api/v1/balanco/route");
    const res = await GET(buildRequest("http://localhost/api/v1/balanco"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/mes_ano/i);
  });

  it("retorna 400 quando mes_ano tem formato inválido", async () => {
    const { GET } = await import("@/app/api/v1/balanco/route");
    const res = await GET(buildRequest("http://localhost/api/v1/balanco?mes_ano=2026/03"));
    expect(res.status).toBe(400);
  });

  it("retorna 401 quando API key é inválida", async () => {
    const { verificarApiKey } = await import("@/lib/api/auth");
    vi.mocked(verificarApiKey).mockResolvedValue(null);

    const { GET } = await import("@/app/api/v1/balanco/route");
    const res = await GET(buildRequest("http://localhost/api/v1/balanco?mes_ano=2026-03", "invalida"));
    expect(res.status).toBe(401);
  });

  it("retorna 200 com split técnico/comercial quando dados existem", async () => {
    // Mock para configuracoes
    const mockInCfg = vi.fn().mockResolvedValue({
      data: [
        { chave: "limiar_perda_zona_pct", valor: "15" },
        { chave: "perda_tecnica_estimada_pct", valor: "5" },
      ],
      error: null,
    });
    // Mock para subestacoes
    const mockEqSubs = vi.fn().mockResolvedValue({
      data: [{ id: "s1", nome: "Sub Norte", zona_bairro: "Várzea", ilha: "Santiago" }],
      error: null,
    });
    // Mock para injecao_energia — cadeia: .eq().in()
    const mockInInj = vi.fn().mockResolvedValue({
      data: [{ id_subestacao: "s1", total_kwh_injetado: 10000 }],
      error: null,
    });
    const mockEqInj = vi.fn(() => ({ in: mockInInj }));
    // Mock para faturacao_clientes — cadeia: .eq()
    const mockEqFat = vi.fn().mockResolvedValue({
      data: [{ kwh_faturado: 8000, valor_cve: 120000, clientes: { id_subestacao: "s1" } }],
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "configuracoes") return { select: () => ({ in: mockInCfg }) };
      if (table === "subestacoes") return { select: () => ({ eq: mockEqSubs }) };
      if (table === "injecao_energia") return { select: () => ({ eq: mockEqInj }) };
      if (table === "faturacao_clientes") return { select: () => ({ eq: mockEqFat }) };
      return { select: mockSelect };
    });

    const { GET } = await import("@/app/api/v1/balanco/route");
    const res = await GET(buildRequest("http://localhost/api/v1/balanco?mes_ano=2026-03"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.mes_ano).toBe("2026-03");
    expect(body.data.subestacoes).toHaveLength(1);
    // 10000 kWh injetados, 8000 faturados = 2000 perda
    // perda_tecnica = 10000 * 5% = 500
    // perda_comercial = 2000 - 500 = 1500
    expect(body.data.subestacoes[0].perda_tecnica_kwh).toBe(500);
    expect(body.data.subestacoes[0].perda_comercial_kwh).toBe(1500);
  });
});

// ── GET /api/v1/predicoes ──────────────────────────────────────────────────────

describe("GET /api/v1/predicoes", () => {
  beforeEach(async () => {
    setupEnv();
    vi.clearAllMocks();
    const { verificarApiKey } = await import("@/lib/api/auth");
    vi.mocked(verificarApiKey).mockResolvedValue("electra");
    const { checkRateLimit } = await import("@/lib/api/rateLimit");
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 });
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("retorna 401 quando API key é inválida", async () => {
    const { verificarApiKey } = await import("@/lib/api/auth");
    vi.mocked(verificarApiKey).mockResolvedValue(null);

    const { GET } = await import("@/app/api/v1/predicoes/route");
    const res = await GET(buildRequest("http://localhost/api/v1/predicoes", "invalida"));
    expect(res.status).toBe(401);
  });

  it("retorna 200 com lista de predições ML", async () => {
    const predicoesMock = [
      {
        id: "p1", score_ml: 0.87, modelo_versao: "heuristic_v1",
        features_json: { f_queda: 0.8 }, mes_ano: "2026-03", criado_em: "2026-03-02",
        clientes: { id: "c1", numero_contador: "CV-001", nome_titular: "Maria Santos", subestacoes: { nome: "Sub Norte", zona_bairro: "Várzea" } },
      },
    ];

    mockRange.mockResolvedValue({ data: predicoesMock, error: null, count: 1 });

    const { GET } = await import("@/app/api/v1/predicoes/route");
    const res = await GET(buildRequest("http://localhost/api/v1/predicoes"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].score_ml).toBe(0.87);
    expect(body.data[0].modelo_versao).toBe("heuristic_v1");
    expect(body.meta.total).toBe(1);
  });

  it("retorna lista vazia quando não há predições", async () => {
    mockRange.mockResolvedValue({ data: [], error: null, count: 0 });

    const { GET } = await import("@/app/api/v1/predicoes/route");
    const res = await GET(buildRequest("http://localhost/api/v1/predicoes"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  it("retorna 500 quando a query Supabase falha", async () => {
    mockRange.mockResolvedValue({ data: null, error: { message: "DB error" }, count: 0 });

    const { GET } = await import("@/app/api/v1/predicoes/route");
    const res = await GET(buildRequest("http://localhost/api/v1/predicoes"));
    expect(res.status).toBe(500);
  });
});
