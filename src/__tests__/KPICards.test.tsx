/**
 * Testes do componente KPICards (src/modules/dashboard/components/KPICards.tsx)
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KPICards } from "@/modules/dashboard/components/KPICards";
import type { KPIData } from "@/modules/dashboard/types";

const mockKPIData: KPIData = {
  perda_cve_total: 1_500_000,
  clientes_risco_critico: 42,
  ordens_pendentes: 7,
  receita_recuperada_ytd: 320_000,
  variacao_perda_pct: -5.2,
  alertas_criticos: [],
};

describe("KPICards", () => {
  it("mostra skeleton de loading quando loading=true", () => {
    const { container } = render(<KPICards data={null} loading={true} />);
    // Skeletons têm classe animate-pulse
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("mostra '—' para todos os KPIs quando data=null e loading=false", () => {
    render(<KPICards data={null} loading={false} />);
    const dashes = screen.getAllByText("—");
    expect(dashes).toHaveLength(4);
  });

  it("exibe os títulos dos 4 KPIs", () => {
    render(<KPICards data={null} loading={false} />);
    expect(screen.getByText("Perda Estimada")).toBeInTheDocument();
    expect(screen.getByText("Risco Crítico")).toBeInTheDocument();
    expect(screen.getByText("Ordens Pendentes")).toBeInTheDocument();
    expect(screen.getByText("Receita Recuperada")).toBeInTheDocument();
  });

  it("exibe o número de clientes em risco crítico", () => {
    render(<KPICards data={mockKPIData} loading={false} />);
    expect(screen.getByText("42 clientes")).toBeInTheDocument();
  });

  it("exibe as ordens pendentes", () => {
    render(<KPICards data={mockKPIData} loading={false} />);
    expect(screen.getByText("7 ordens")).toBeInTheDocument();
  });

  it("exibe os subtítulos descritivos", () => {
    render(<KPICards data={null} loading={false} />);
    expect(screen.getByText(/score ≥ 75/)).toBeInTheDocument();
    expect(screen.getByText(/aguardam inspeção/)).toBeInTheDocument();
  });

  it("renderiza 4 cards no grid", () => {
    const { container } = render(
      <KPICards data={mockKPIData} loading={false} />
    );
    const cards = container.querySelectorAll(".rounded-xl");
    expect(cards).toHaveLength(4);
  });
});
