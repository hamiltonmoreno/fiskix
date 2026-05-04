import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TabExecutivo } from "@/modules/relatorios/components/TabExecutivo";
import { useExecutivoData } from "@/modules/relatorios/hooks/useRelatoriosData";
import type { RelatoriosFiltros } from "@/modules/relatorios/types";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@/modules/relatorios/hooks/useRelatoriosData", () => ({
  useExecutivoData: vi.fn(),
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
    totalAlertas: 42,
    fraudesConfirmadas: 12,
    receitaRecuperada: 180000,
    taxaDetecao: 28.6,
  },
  serie: [
    { mes: "Fev. 26", mesRaw: "2026-02", perda: 500000, recuperado: 90000, roi: -410000, roiAcumulado: -410000 },
    { mes: "Mar. 26", mesRaw: "2026-03", perda: 480000, recuperado: 180000, roi: -320000, roiAcumulado: -730000 },
  ],
};

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("TabExecutivo.tsx", () => {
  const mockOnExportReady = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useExecutivoData).mockReturnValue({ data: mockData, loading: false });
  });

  it("exibe os 4 KPIs quando há dados", () => {
    render(<TabExecutivo filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />);

    expect(screen.getByText("42")).toBeInTheDocument();    // totalAlertas
    expect(screen.getByText("12")).toBeInTheDocument();   // fraudesConfirmadas
    expect(screen.getByText(/28\.6%/)).toBeInTheDocument(); // taxaDetecao
  });

  it("exibe skeletons de loading quando está a carregar", () => {
    vi.mocked(useExecutivoData).mockReturnValue({ data: null, loading: true });

    render(<TabExecutivo filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />);

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("exibe a tabela de histórico de relatórios", () => {
    render(<TabExecutivo filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />);

    expect(screen.getByText("Histórico de Relatórios Gerados")).toBeInTheDocument();
    expect(screen.getByText("REL-2026-003")).toBeInTheDocument();
    expect(screen.getByText("REL-2026-002")).toBeInTheDocument();
  });

  it("não chama o hook quando a tab não está activa", () => {
    render(<TabExecutivo filtros={mockFilters} active={false} onExportReady={mockOnExportReady} />);

    expect(useExecutivoData).toHaveBeenCalledWith(mockFilters, false);
  });

  it("chama onExportReady com headers e dados da série quando há dados", () => {
    render(<TabExecutivo filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />);

    expect(mockOnExportReady).toHaveBeenCalledWith(
      expect.arrayContaining(["Mês", "Perda (CVE)", "Recuperado (CVE)", "ROI (CVE)"]),
      expect.arrayContaining([
        expect.objectContaining({
          "Mês": "Fev. 26",
          "Perda (CVE)": 500000,
        }),
      ])
    );
  });

  it("não chama onExportReady quando data é null", () => {
    vi.mocked(useExecutivoData).mockReturnValue({ data: null, loading: false });

    render(<TabExecutivo filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />);

    expect(mockOnExportReady).not.toHaveBeenCalled();
  });
});
