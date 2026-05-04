import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TabAnaliseAvancada } from "@/modules/relatorios/components/TabAnaliseAvancada";
import { useAnaliseAvancadaData } from "@/modules/relatorios/hooks/useRelatoriosData";
import type { RelatoriosFiltros } from "@/modules/relatorios/types";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@/modules/relatorios/hooks/useRelatoriosData", () => ({
  useAnaliseAvancadaData: vi.fn(),
}));

vi.mock("recharts", async () => {
  const Original = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...Original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

// ── Dados mock ─────────────────────────────────────────────────────────────────

const mockFilters: RelatoriosFiltros = {
  mesAno: "2026-03",
  periodo: "mes",
  zona: undefined,
  tipoTarifa: undefined,
};

const mockData = {
  kpis: {
    perda_total_kwh: 20000,
    perda_tecnica_kwh: 5000,
    perda_comercial_kwh: 15000,
    perda_comercial_pct: 75,
    cve_comercial_estimado: 225000,
    perda_tecnica_estimada_pct: 5,
  },
  porSubestacao: [
    {
      id: "s1",
      nome: "Sub Norte",
      zona_bairro: "Várzea",
      kwh_injetado: 100000,
      perda_kwh: 20000,
      perda_pct: 20,
      perda_tecnica_kwh: 5000,
      perda_comercial_kwh: 15000,
      perda_comercial_pct: 75,
      cve_comercial_estimado: 225000,
      irec: 12.5,
      alertas_alto_score: 5,
      total_alertas: 8,
    },
    {
      id: "s2",
      nome: "Sub Sul",
      zona_bairro: "Palmarejo",
      kwh_injetado: 80000,
      perda_kwh: 8000,
      perda_pct: 10,
      perda_tecnica_kwh: 4000,
      perda_comercial_kwh: 4000,
      perda_comercial_pct: 50,
      cve_comercial_estimado: 60000,
      irec: 4.2,
      alertas_alto_score: 2,
      total_alertas: 6,
    },
  ],
  evolucaoComercial: [
    { mes: "fev. 26", pct_comercial: 8.5, pct_tecnica: 5.0 },
    { mes: "mar. 26", pct_comercial: 15.0, pct_tecnica: 5.0 },
  ],
};

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("TabAnaliseAvancada.tsx", () => {
  const mockOnExportReady = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAnaliseAvancadaData).mockReturnValue({ data: mockData, loading: false });
  });

  it("exibe os 4 KPIs quando há dados", () => {
    render(
      <TabAnaliseAvancada filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />
    );

    // Os labels dos KPIs também aparecem nos headers da tabela — usar getAllByText
    expect(screen.getAllByText("Perda Comercial").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Perda Técnica").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("% Comercial/Total")).toBeInTheDocument();
    expect(screen.getAllByText("CVE Comercial").length).toBeGreaterThanOrEqual(1);
  });

  it("exibe mensagem informativa com o limiar de perdas técnicas", () => {
    render(
      <TabAnaliseAvancada filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />
    );

    expect(screen.getByText(/Perdas técnicas estimadas/i)).toBeInTheDocument();
    expect(screen.getByText("5%")).toBeInTheDocument();
  });

  it("exibe a lista de subestações na tabela com índice de recuperabilidade", () => {
    render(
      <TabAnaliseAvancada filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />
    );

    expect(screen.getByText("Sub Norte")).toBeInTheDocument();
    expect(screen.getByText("Sub Sul")).toBeInTheDocument();

    // Alertas críticos/total
    expect(screen.getByText("5/8")).toBeInTheDocument();
    expect(screen.getByText("2/6")).toBeInTheDocument();

    // Índice de recuperabilidade
    expect(screen.getByText("12.5")).toBeInTheDocument();
    expect(screen.getByText("4.2")).toBeInTheDocument();
  });

  it("exibe skeletons de loading quando a tab está em carregamento", () => {
    vi.mocked(useAnaliseAvancadaData).mockReturnValue({ data: null, loading: true });

    render(
      <TabAnaliseAvancada filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />
    );

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("exibe mensagem de sem dados quando a lista está vazia", () => {
    vi.mocked(useAnaliseAvancadaData).mockReturnValue({
      data: { ...mockData, porSubestacao: [] },
      loading: false,
    });

    render(
      <TabAnaliseAvancada filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />
    );

    // A mensagem aparece no gráfico vazio e na tabela vazia
    expect(screen.getAllByText(/Sem dados para o período/i).length).toBeGreaterThanOrEqual(1);
  });

  it("não chama o hook quando a tab não está activa", () => {
    render(
      <TabAnaliseAvancada filtros={mockFilters} active={false} onExportReady={mockOnExportReady} />
    );

    expect(useAnaliseAvancadaData).toHaveBeenCalledWith(mockFilters, false);
  });

  it("chama onExportReady com headers e dados correctos quando há dados", () => {
    render(
      <TabAnaliseAvancada filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />
    );

    expect(mockOnExportReady).toHaveBeenCalledWith(
      expect.arrayContaining(["Subestação", "Perda Comercial (kWh)", "Índice Recuperabilidade"]),
      expect.arrayContaining([
        expect.objectContaining({
          "Subestação": "Sub Norte",
          "Perda Comercial (kWh)": 15000,
          "Índice Recuperabilidade": 12.5,
        }),
      ])
    );
  });

  it("aplica badge vermelho para índice de recuperabilidade alto (> 10)", () => {
    render(
      <TabAnaliseAvancada filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />
    );

    // Sub Norte tem irec=12.5 (> 10) — deve ter classe text-red-700
    const badge = screen.getByText("12.5");
    expect(badge.className).toMatch(/red/);
  });

  it("aplica badge âmbar para índice de recuperabilidade médio (5-10)", () => {
    vi.mocked(useAnaliseAvancadaData).mockReturnValue({
      data: {
        ...mockData,
        porSubestacao: [
          { ...mockData.porSubestacao[1], irec: 7.3 },
        ],
      },
      loading: false,
    });

    render(
      <TabAnaliseAvancada filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />
    );

    const badge = screen.getByText("7.3");
    expect(badge.className).toMatch(/amber/);
  });
});
