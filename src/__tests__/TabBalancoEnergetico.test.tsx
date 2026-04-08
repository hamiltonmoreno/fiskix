import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TabBalancoEnergetico } from "@/modules/relatorios/components/TabBalancoEnergetico";
import { useBalancoEnergeticoData } from "@/modules/relatorios/hooks/useRelatoriosData";
import type { RelatoriosFiltros } from "@/modules/relatorios/types";

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Mock do hook de dados
vi.mock("@/modules/relatorios/hooks/useRelatoriosData", () => ({
  useBalancoEnergeticoData: vi.fn(),
}));

// Mock do Recharts
vi.mock("recharts", async () => {
  const Original = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...Original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  };
});

describe("TabBalancoEnergetico.tsx", () => {
  const mockFilters: RelatoriosFiltros = {
    mesAno: "2026-03", 
    periodo: "mes",
    zona: "todas",
    tipoTarifa: undefined 
  };
  const mockOnExportReady = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation
    vi.mocked(useBalancoEnergeticoData).mockImplementation((_filtros: RelatoriosFiltros, active: boolean) => {
      if (!active) return { data: null, loading: false };
      return {
        data: {
          kpis: {
            totalInjetado: 100000,
            totalFaturado: 80000,
            perdaKwh: 20000,
            perdaPct: 20,
          },
          porSubestacao: [
            {
              id: "sub-1",
              nome: "Subestação Alfa",
              ilha: "Santiago",
              kwh_injetado: 60000,
              kwh_faturado: 45000,
              perda_kwh: 15000,
              perda_pct: 25,
              cve_estimado: 225000,
            },
            {
              id: "sub-2",
              nome: "Subestação Beta",
              ilha: "Santiago",
              kwh_injetado: 40000,
              kwh_faturado: 35000,
              perda_kwh: 5000,
              perda_pct: 12.5,
              cve_estimado: 75000,
            },
          ],
          evolucaoPerda: []
        },
        loading: false
      };
    });
  });

  it("exibe os KPIs principais corretamente quando ativo", () => {
    render(
      <TabBalancoEnergetico 
        filtros={mockFilters} 
        active={true} 
        onExportReady={mockOnExportReady} 
      />
    );

    // KPIs (100.000 kWh -> "100.0K kWh" se formatKWh usar K)
    // Verificamos a presença dos números formatados
    expect(screen.getAllByText(/100/).length).toBeGreaterThan(0); // Total Injetado
    expect(screen.getAllByText(/80/).length).toBeGreaterThan(0);  // Total Faturado
    expect(screen.getAllByText(/20/).length).toBeGreaterThan(0);  // kWh Perdidos / % Perda
  });

  it("exibe a lista de subestações na tabela de detalhes", () => {
    render(
      <TabBalancoEnergetico 
        filtros={mockFilters} 
        active={true} 
        onExportReady={mockOnExportReady} 
      />
    );

    expect(screen.getByText("Subestação Alfa")).toBeInTheDocument();
    expect(screen.getByText("Subestação Beta")).toBeInTheDocument();
    
    // Santiago aparece como ilha
    const ilhas = screen.getAllByText("Santiago");
    expect(ilhas.length).toBeGreaterThanOrEqual(2);
  });

  it("chama onExportReady com os dados formatados para Excel", () => {
    render(
      <TabBalancoEnergetico 
        filtros={mockFilters} 
        active={true} 
        onExportReady={mockOnExportReady} 
      />
    );

    expect(mockOnExportReady).toHaveBeenCalledWith(
      expect.arrayContaining(["Subestação", "Perda (%)"]),
      expect.arrayContaining([
        expect.objectContaining({ "Subestação": "Subestação Alfa", "Perda (%)": 25 })
      ])
    );
  });

  it("exibe skeletons quando em estado de loading", () => {
    // Redefine o mock temporariamente para loading
    vi.mocked(useBalancoEnergeticoData).mockReturnValue({
      data: null,
      loading: true
    });

    render(
      <TabBalancoEnergetico 
        filtros={mockFilters} 
        active={true} 
        onExportReady={mockOnExportReady} 
      />
    );

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
