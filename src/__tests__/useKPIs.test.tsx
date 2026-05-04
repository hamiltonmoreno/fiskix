import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useKPIs } from "@/modules/dashboard/hooks/useKPIs";

// ── Mock Supabase client ───────────────────────────────────────────────────────

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: mockFrom }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a fully chainable Supabase mock. Every query builder method
 * (select, eq, gte, order, limit, in) returns the same builder object.
 * The builder itself is thenable so `await builder` resolves to { data, error }.
 */
function makeTableMock(data: unknown[]) {
  const result = { data, error: null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {
    then: (resolve: (v: unknown) => void) => resolve(result),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    in: vi.fn(() => builder),
  };
  return builder;
}

function setupMocks({
  alertas = [] as unknown[],
  relatorios = [] as unknown[],
  injecoes = [] as unknown[],
  faturacao = [] as unknown[],
} = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "alertas_fraude") return makeTableMock(alertas);
    if (table === "relatorios_inspecao") return makeTableMock(relatorios);
    if (table === "injecao_energia") return makeTableMock(injecoes);
    if (table === "faturacao_clientes") return makeTableMock(faturacao);
    return makeTableMock([]);
  });
}

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("useKPIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("começa com loading=true e data=null", () => {
    setupMocks();
    // useKPIs imported at top
    const { result } = renderHook(() => useKPIs("2026-03"));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it("termina com loading=false após carregar dados", async () => {
    setupMocks();
    // useKPIs imported at top
    const { result } = renderHook(() => useKPIs("2026-03"));
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("calcula clientes_risco_critico — apenas alertas com score >= 75", async () => {
    setupMocks({
      alertas: [
        { score_risco: 80, status: "Pendente", resultado: null, clientes: { subestacoes: { zona_bairro: "Várzea" } } },
        { score_risco: 60, status: "Pendente", resultado: null, clientes: { subestacoes: { zona_bairro: "Várzea" } } },
        { score_risco: 75, status: "Pendente", resultado: null, clientes: { subestacoes: { zona_bairro: "Várzea" } } },
      ],
    });

    // useKPIs imported at top
    const { result } = renderHook(() => useKPIs("2026-03"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.clientes_risco_critico).toBe(2);
  });

  it("calcula ordens_pendentes — apenas alertas com status Pendente_Inspecao", async () => {
    setupMocks({
      alertas: [
        { score_risco: 80, status: "Pendente_Inspecao", resultado: null, clientes: { subestacoes: { zona_bairro: "Várzea" } } },
        { score_risco: 60, status: "Pendente", resultado: null, clientes: { subestacoes: { zona_bairro: "Várzea" } } },
        { score_risco: 75, status: "Pendente_Inspecao", resultado: null, clientes: { subestacoes: { zona_bairro: "Várzea" } } },
      ],
    });

    // useKPIs imported at top
    const { result } = renderHook(() => useKPIs("2026-03"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.ordens_pendentes).toBe(2);
  });

  it("calcula perda_cve_total como (injetado - faturado) × tarifa_media", async () => {
    setupMocks({
      injecoes: [{ total_kwh_injetado: 10000 }],
      faturacao: [{ kwh_faturado: 8000, valor_cve: 120000 }],
    });

    // useKPIs imported at top
    const { result } = renderHook(() => useKPIs("2026-03"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // perda = 10000 - 8000 = 2000 kWh
    // tarifa_media = 120000 / 8000 = 15 CVE/kWh
    // perda_cve = 2000 × 15 = 30000
    expect(result.current.data?.perda_cve_total).toBe(30000);
  });

  it("perda_cve_total nunca é negativa", async () => {
    setupMocks({
      injecoes: [{ total_kwh_injetado: 5000 }],
      faturacao: [{ kwh_faturado: 7000, valor_cve: 100000 }], // faturado > injetado
    });

    // useKPIs imported at top
    const { result } = renderHook(() => useKPIs("2026-03"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.perda_cve_total).toBeGreaterThanOrEqual(0);
  });

  it("retorna perda_cve=0 quando não há faturação (sem fallback de tarifa fictícia)", async () => {
    setupMocks({
      injecoes: [{ total_kwh_injetado: 1000 }],
      // sem faturacao
    });

    // useKPIs imported at top
    const { result } = renderHook(() => useKPIs("2026-03"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Sem faturação real, não temos uma tarifa fiável — retornar 0 em vez de
    // inflacionar com 15 CVE/kWh sintético que transforma um mês "sem dados"
    // numa perda fictícia enorme.
    expect(result.current.data?.perda_cve_total).toBe(0);
  });
});
