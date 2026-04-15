import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useExecutivoData, useInspecoesData } from "@/modules/relatorios/hooks/useRelatoriosData";

// ── Mock Supabase client ───────────────────────────────────────────────────────

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: mockFrom }),
}));

// helper: cria um chain from().select().in() que resolve para data
function makeInMock(data: unknown[]) {
  const mockIn = vi.fn().mockResolvedValue({ data, error: null });
  const mockEq = vi.fn(() => ({ in: mockIn }));
  const mockSelect = vi.fn(() => ({ in: mockIn, eq: mockEq }));
  return { select: mockSelect };
}

// ── Dados mock ─────────────────────────────────────────────────────────────────

const mockAlertasFraude = [
  { mes_ano: "2026-03", resultado: "Fraude_Confirmada", score_risco: 85 },
  { mes_ano: "2026-03", resultado: null, score_risco: 60 },
  { mes_ano: "2026-03", resultado: "Fraude_Confirmada", score_risco: 75 },
];

const mockInjecao = [
  { mes_ano: "2026-03", total_kwh_injetado: 10000 },
];

const mockFaturacao = [
  { mes_ano: "2026-03", kwh_faturado: 8000, valor_cve: 120000 },
];

const mockFilters = {
  mesAno: "2026-03",
  periodo: "mes" as const,
  zona: undefined,
  tipoTarifa: undefined,
};

// ── Suite: useExecutivoData ────────────────────────────────────────────────────

describe("useExecutivoData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      if (table === "alertas_fraude") return makeInMock(mockAlertasFraude);
      if (table === "injecao_energia") return makeInMock(mockInjecao);
      if (table === "faturacao_clientes") return makeInMock(mockFaturacao);
      return makeInMock([]);
    });
  });

  it("começa com loading=true e data=null", async () => {
    const { result } = renderHook(() => useExecutivoData(mockFilters, true));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("não carrega dados quando active=false", () => {
    // useExecutivoData imported at top
    renderHook(() => useExecutivoData(mockFilters, false));
    // mockFrom nunca deve ser chamado
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("calcula totalAlertas e fraudesConfirmadas correctamente", async () => {
    // useExecutivoData imported at top
    const { result } = renderHook(() => useExecutivoData(mockFilters, true));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.kpis.totalAlertas).toBe(3);
    expect(result.current.data?.kpis.fraudesConfirmadas).toBe(2);
  });

  it("calcula taxaDetecao correctamente (fraudesConfirmadas / totalAlertas × 100)", async () => {
    // useExecutivoData imported at top
    const { result } = renderHook(() => useExecutivoData(mockFilters, true));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // 2/3 × 100 ≈ 66.7
    expect(result.current.data?.kpis.taxaDetecao).toBeCloseTo(66.7, 0);
  });

  it("retorna serie com pelo menos um ponto de dados", async () => {
    // useExecutivoData imported at top
    const { result } = renderHook(() => useExecutivoData(mockFilters, true));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.serie.length).toBeGreaterThanOrEqual(1);
    expect(result.current.data?.serie[0]).toHaveProperty("mes");
    expect(result.current.data?.serie[0]).toHaveProperty("perda");
    expect(result.current.data?.serie[0]).toHaveProperty("roi");
  });

  it("loading=false após carregamento mesmo sem dados", async () => {
    mockFrom.mockImplementation(() => makeInMock([]));

    // useExecutivoData imported at top
    const { result } = renderHook(() => useExecutivoData(mockFilters, true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).not.toBeNull();
  });
});

// ── Suite: useInspecoesData ────────────────────────────────────────────────────

describe("useInspecoesData", () => {
  const mockAlertasInspecao = [
    { resultado: "Fraude_Confirmada", status: "Inspecionado", mes_ano: "2026-03", clientes: { tipo_tarifa: "Residencial", subestacoes: { zona_bairro: "Várzea", ilha: "Santiago" } } },
    { resultado: "Fraude_Confirmada", status: "Inspecionado", mes_ano: "2026-03", clientes: { tipo_tarifa: "Residencial", subestacoes: { zona_bairro: "Várzea", ilha: "Santiago" } } },
    { resultado: "Falso_Positivo",    status: "Inspecionado", mes_ano: "2026-03", clientes: { tipo_tarifa: "Comercial",   subestacoes: { zona_bairro: "Palmarejo", ilha: "Santiago" } } },
    { resultado: null,                status: "Pendente",     mes_ano: "2026-03", clientes: { tipo_tarifa: "Residencial", subestacoes: { zona_bairro: "Várzea", ilha: "Santiago" } } },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // useInspecoesData uses .select().in() (no extra .eq initially)
    mockFrom.mockImplementation(() => {
      const mockIn = vi.fn().mockResolvedValue({ data: mockAlertasInspecao, error: null });
      const mockEq2 = vi.fn().mockResolvedValue({ data: mockAlertasInspecao, error: null });
      const mockEq = vi.fn(() => ({ in: mockIn, eq: mockEq2 }));
      const mockSelect = vi.fn(() => ({ in: mockIn, eq: mockEq }));
      return { select: mockSelect };
    });
  });

  it("não carrega dados quando active=false", () => {
    // useInspecoesData imported at top
    renderHook(() => useInspecoesData(mockFilters, false));
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("calcula totais correctamente (confirmadas, falsosPositivos, pendentes)", async () => {
    // useInspecoesData imported at top
    const { result } = renderHook(() => useInspecoesData(mockFilters, true));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.kpis.total).toBe(4);
    expect(result.current.data?.kpis.confirmadas).toBe(2);
    expect(result.current.data?.kpis.falsosPositivos).toBe(1);
  });

  it("agrupa por zona correctamente", async () => {
    // useInspecoesData imported at top
    const { result } = renderHook(() => useInspecoesData(mockFilters, true));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const vazrea = result.current.data?.porZona.find((z) => z.zona === "Várzea");
    expect(vazrea?.confirmadas).toBe(2);
    expect(vazrea?.pendentes).toBe(1);
  });

  it("taxaSucesso = confirmadas / inspecionados × 100", async () => {
    // useInspecoesData imported at top
    const { result } = renderHook(() => useInspecoesData(mockFilters, true));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // inspecionados = confirmadas(2) + anomalias(0) + falsoPositivos(1) = 3
    // taxaSucesso = 2/3 × 100 ≈ 67
    expect(result.current.data?.kpis.taxaSucesso).toBe(67);
  });

  it("donut tem 4 entradas com os tipos de resultado", async () => {
    // useInspecoesData imported at top
    const { result } = renderHook(() => useInspecoesData(mockFilters, true));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.donut).toHaveLength(4);
    expect(result.current.data?.donut.map((d) => d.name)).toContain("Fraude Confirmada");
    expect(result.current.data?.donut.map((d) => d.name)).toContain("Falso Positivo");
  });
});
