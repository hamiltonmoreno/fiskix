import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockExchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  }),
}));

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redireciona para /dashboard quando o código é válido", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const { GET } = await import("@/app/auth/callback/route");
    const res = await GET(new Request("http://localhost/auth/callback?code=valid-code"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("redireciona para /login?error=auth_callback_failed quando não há código", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    const res = await GET(new Request("http://localhost/auth/callback"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=auth_callback_failed");
  });

  it("redireciona para /login?error=auth_callback_failed quando a troca falha", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: { message: "invalid code" } });

    const { GET } = await import("@/app/auth/callback/route");
    const res = await GET(new Request("http://localhost/auth/callback?code=bad-code"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=auth_callback_failed");
  });

  it("respeita o parâmetro next quando fornecido", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const { GET } = await import("@/app/auth/callback/route");
    const res = await GET(new Request("http://localhost/auth/callback?code=abc&next=/relatorios"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/relatorios");
  });
});
