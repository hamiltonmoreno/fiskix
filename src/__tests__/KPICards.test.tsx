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
  variacao_criticos_pct: 8.0,
  variacao_pendentes_pct: -12.5,
  variacao_receita_pct: 25.0,
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
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/score ≥ 75/)).toBeInTheDocument();
  });

  it("exibe as ordens pendentes", () => {
    render(<KPICards data={mockKPIData} loading={false} />);
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText(/aguardam inspeção/)).toBeInTheDocument();
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

  it("mostra delta de variação em cada KPI", () => {
    render(<KPICards data={mockKPIData} loading={false} />);
    // Cada KPI tem o seu próprio %; verificamos que ao menos os textos aparecem
    expect(screen.getByText(/5\.2% vs mês ant\./)).toBeInTheDocument(); // perda -5.2
    expect(screen.getByText(/8\.0% vs mês ant\./)).toBeInTheDocument(); // criticos +8.0
    expect(screen.getByText(/12\.5% vs mês ant\./)).toBeInTheDocument(); // pendentes -12.5
    expect(screen.getByText(/25\.0% vs mês ant\./)).toBeInTheDocument(); // receita +25.0
  });

  it("Receita: subir é bom (verde) — semântica invertida vs perda/criticos", () => {
    const { container } = render(
      <KPICards data={mockKPIData} loading={false} />
    );
    // Perda subir é mau. Mock tem perda -5.2 → trending_down → verde.
    // Receita +25 → trending_up + inverted → verde também.
    // Ambos devem ser verdes. Verificamos pela classe de fundo no badge.
    const greenBadges = container.querySelectorAll(".bg-emerald-100, .dark\\:bg-emerald-950\\/40");
    // Espera ≥2 badges verdes (perda baixa + receita sobe)
    expect(greenBadges.length).toBeGreaterThanOrEqual(2);
  });

  it("não mostra DeltaBadge quando pct === 0", () => {
    const zeroDeltas: KPIData = {
      ...mockKPIData,
      variacao_perda_pct: 0,
      variacao_criticos_pct: 0,
      variacao_pendentes_pct: 0,
      variacao_receita_pct: 0,
    };
    render(<KPICards data={zeroDeltas} loading={false} />);
    // Nenhum badge "vs mês ant." deve aparecer; mostramos só os subs
    expect(screen.queryByText(/vs mês ant\./)).not.toBeInTheDocument();
  });
});
