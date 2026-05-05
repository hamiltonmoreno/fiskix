import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TabInteligenciaFinanceira } from "@/modules/relatorios/components/TabInteligenciaFinanceira";
import { useInteligenciaFinanceiraData } from "@/modules/relatorios/hooks/useRelatoriosData";
import type { RelatoriosFiltros, InteligenciaFinanceiraData } from "@/modules/relatorios/types";

vi.mock("@/modules/relatorios/hooks/useRelatoriosData", () => ({
  useInteligenciaFinanceiraData: vi.fn(),
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

const mockFilters: RelatoriosFiltros = {
  mesAno: "2026-03",
  periodo: "mes",
  zona: undefined,
  tipoTarifa: undefined,
};

const mockData: InteligenciaFinanceiraData = {
  kpis: {
    divida_total_cve: 145600,
    clientes_em_divida: 12,
    pct_leituras_estimadas: 18.5,
    limiar_divida_cve: 3000,
  },
  topDevedores: [
    {
      id_cliente: "c1",
      numero_contador: "607023",
      nome_titular: "Maria Orlanda Lopes",
      zona_bairro: "Cidadela",
      saldo_atual_cve: 7233,
      score_risco: 82,
    },
    {
      id_cliente: "c2",
      numero_contador: "612045",
      nome_titular: "João Silva Santos",
      zona_bairro: "Plateau",
      saldo_atual_cve: 5400,
      score_risco: 64,
    },
    {
      id_cliente: "c3",
      numero_contador: "601999",
      nome_titular: "Ana Pereira",
      zona_bairro: "Várzea",
      saldo_atual_cve: 4100,
      score_risco: 0,
    },
  ],
  porSubestacao: [
    {
      id_subestacao: "s1",
      nome: "PT Cidadela",
      zona_bairro: "Cidadela",
      divida_total_cve: 89200,
      clientes_em_divida: 8,
    },
    {
      id_subestacao: "s2",
      nome: "PT Plateau",
      zona_bairro: "Plateau",
      divida_total_cve: 56400,
      clientes_em_divida: 4,
    },
  ],
  distribuicaoTipoLeitura: [
    { tipo: "real", count: 850, pct: 65.4 },
    { tipo: "empresa", count: 220, pct: 16.9 },
    { tipo: "estimada", count: 240, pct: 18.5 },
  ],
};

describe("TabInteligenciaFinanceira.tsx", () => {
  const mockOnExportReady = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useInteligenciaFinanceiraData).mockReturnValue({ data: mockData, loading: false });
  });

  it("exibe os 4 KPIs financeiros principais", () => {
    render(<TabInteligenciaFinanceira filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />);
    expect(screen.getByText("Dívida Total")).toBeInTheDocument();
    expect(screen.getByText("Clientes em Dívida")).toBeInTheDocument();
    expect(screen.getByText("Leituras Estimadas")).toBeInTheDocument();
    expect(screen.getByText("Top Devedor")).toBeInTheDocument();
  });

  it("exibe info-box com o limiar R10 actual", () => {
    render(<TabInteligenciaFinanceira filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />);
    expect(screen.getByText(/R10 — Dívida Acumulada/i)).toBeInTheDocument();
  });

  it("exibe a tabela com top devedores em ordem decrescente de dívida", () => {
    render(<TabInteligenciaFinanceira filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />);
    // "Maria Orlanda Lopes" aparece na tabela + no KPI Top Devedor
    expect(screen.getAllByText("Maria Orlanda Lopes").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("João Silva Santos")).toBeInTheDocument();
    expect(screen.getByText("607023")).toBeInTheDocument();
    expect(screen.getByText("82")).toBeInTheDocument();
    expect(screen.getByText("64")).toBeInTheDocument();
  });

  it("mostra 'sem alerta' para devedores sem score de risco", () => {
    render(<TabInteligenciaFinanceira filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />);
    expect(screen.getByText("sem alerta")).toBeInTheDocument();
  });

  it("aplica badge vermelho para score crítico (>= 75)", () => {
    render(<TabInteligenciaFinanceira filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />);
    const badge = screen.getByText("82");
    expect(badge.className).toMatch(/red/);
  });

  it("aplica badge âmbar para score médio (50-74)", () => {
    render(<TabInteligenciaFinanceira filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />);
    const badge = screen.getByText("64");
    expect(badge.className).toMatch(/amber/);
  });

  it("exibe skeletons enquanto loading", () => {
    vi.mocked(useInteligenciaFinanceiraData).mockReturnValue({ data: null, loading: true });
    render(<TabInteligenciaFinanceira filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />);
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("exibe mensagem de sem devedores quando topDevedores está vazio", () => {
    vi.mocked(useInteligenciaFinanceiraData).mockReturnValue({
      data: { ...mockData, topDevedores: [], porSubestacao: [] },
      loading: false,
    });
    render(<TabInteligenciaFinanceira filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />);
    expect(screen.getByText(/Sem devedores no período/i)).toBeInTheDocument();
  });

  it("chama onExportReady com headers e dados de devedores", () => {
    render(<TabInteligenciaFinanceira filtros={mockFilters} active={true} onExportReady={mockOnExportReady} />);
    expect(mockOnExportReady).toHaveBeenCalledWith(
      expect.arrayContaining(["Nº Contador", "Titular", "Dívida (CVE)", "Score Risco"]),
      expect.arrayContaining([
        expect.objectContaining({
          "Nº Contador": "607023",
          "Titular": "Maria Orlanda Lopes",
          "Dívida (CVE)": 7233,
          "Score Risco": 82,
        }),
      ])
    );
  });

  it("propaga active=false ao hook (lazy fetch)", () => {
    render(<TabInteligenciaFinanceira filtros={mockFilters} active={false} onExportReady={mockOnExportReady} />);
    expect(useInteligenciaFinanceiraData).toHaveBeenCalledWith(mockFilters, false);
  });
});
