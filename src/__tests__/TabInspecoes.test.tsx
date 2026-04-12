import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TabInspecoes } from "@/modules/relatorios/components/TabInspecoes";
import { useInspecoesData } from "@/modules/relatorios/hooks/useRelatoriosData";
import type { RelatoriosFiltros } from "@/modules/relatorios/types";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@/modules/relatorios/hooks/useRelatoriosData", () => ({
  useInspecoesData: vi.fn(),
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
    total: 30,
    confirmadas: 18,
    falsosPositivos: 4,
    taxaSucesso: 75,
  },
  porZona: [
    { zona: "Várzea", confirmadas: 10, anomalias: 2, falsosPositivos: 2, pendentes: 3, total: 17, taxaSucesso: 71 },
    { zona: "Palmarejo", confirmadas: 8, anomalias: 1, falsosPositivos: 2, pendentes: 2, total: 13, taxaSucesso: 73 },
  ],
  donut: [
    { name: "Fraude Confirmada", value: 18, color: "#22C55E" },
    { name: "Anomalia Técnica", value: 3, color: "#F59E0B" },
    { name: "Falso Positivo", value: 4, color: "#94A3B8" },
    { name: "Pendente", value: 5, color: "#3B82F6" },
  ],
};

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("TabInspecoes.tsx", () => {
  const mockOnExportReady = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useInspecoesData).mockReturnValue({ data: mockData, loading: false });
  });

  it("exibe os 4 KPIs quando há dados", () => {
    render(<TabInspecoes filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />);

    expect(screen.getByText("30")).toBeInTheDocument();   // total
    expect(screen.getByText("18")).toBeInTheDocument();   // confirmadas
    expect(screen.getByText("4")).toBeInTheDocument();    // falsosPositivos
    expect(screen.getByText("75%")).toBeInTheDocument();  // taxaSucesso
  });

  it("exibe skeletons de loading quando está a carregar", () => {
    vi.mocked(useInspecoesData).mockReturnValue({ data: null, loading: true });

    render(<TabInspecoes filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />);

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("não chama o hook quando a tab não está activa", () => {
    render(<TabInspecoes filtros={mockFilters} active={false} onExportReady={mockOnExportReady} />);

    expect(useInspecoesData).toHaveBeenCalledWith(mockFilters, false);
  });

  it("chama onExportReady com headers e dados por zona quando há dados", () => {
    render(<TabInspecoes filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />);

    expect(mockOnExportReady).toHaveBeenCalledWith(
      expect.arrayContaining(["Zona", "Total", "Confirmadas", "Taxa Sucesso (%)"]),
      expect.arrayContaining([
        expect.objectContaining({ "Zona": "Várzea", "Total": 17 }),
        expect.objectContaining({ "Zona": "Palmarejo", "Total": 13 }),
      ])
    );
  });

  it("não chama onExportReady quando data é null", () => {
    vi.mocked(useInspecoesData).mockReturnValue({ data: null, loading: false });

    render(<TabInspecoes filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />);

    expect(mockOnExportReady).not.toHaveBeenCalled();
  });
});
