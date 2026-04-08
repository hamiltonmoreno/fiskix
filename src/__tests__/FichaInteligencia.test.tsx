import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FichaInteligencia } from "@/modules/mobile/components/FichaInteligencia";

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock do Recharts (senão dependemos de ResizeObserver no ambiente de testes)
vi.mock("recharts", async () => {
  const OriginalRecharts = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...OriginalRecharts,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

// ── Dados Fictícios ──────────────────────────────────────────────────────────
const mockAlerta = {
  id: "alerta-123",
  score_risco: 85,
  status: "Pendente",
  mes_ano: "03-2026",
  motivo: [
    { regra: "R1", pontos: 30, descricao: "Queda súbita de consumo > 50%" },
    { regra: "R2", pontos: 55, descricao: "Consumo zero > 3 meses consecutivos" },
    { regra: "R3", pontos: 0, descricao: "Regra não aplicável" },
  ],
  clientes: {
    numero_contador: "C-999-888",
    nome_titular: "João Fictício",
    morada: "Rua das Flores, Lote 1, Praia",
    tipo_tarifa: "Doméstica",
    telemovel: "9876543",
    subestacoes: { nome: "Subestação Centro", zona_bairro: "Centro" },
  },
};

const mockHistorico = [
  { mes_ano: "10-2025", kwh_faturado: 120 },
  { mes_ano: "11-2025", kwh_faturado: 110 },
  { mes_ano: "12-2025", kwh_faturado: 130 },
  { mes_ano: "01-2026", kwh_faturado: 0 },
  { mes_ano: "02-2026", kwh_faturado: 0 },
  { mes_ano: "03-2026", kwh_faturado: 0 },
];

describe("FichaInteligencia.tsx", () => {
  it("renderiza o cabeçalho e dados gerais do cliente", () => {
    render(
      <FichaInteligencia
        alertaId="alerta-123"
        alerta={mockAlerta}
        faturacaoHistorico={mockHistorico}
        medianaCluster={80}
      />
    );

    // Titular e contador no cabeçalho
    expect(screen.getByText("João Fictício")).toBeInTheDocument();
    expect(screen.getAllByText("C-999-888").length).toBeGreaterThan(0); // Pode aparecer no header e nos detalhes
    
    // Dados do titular (cartão "Dados do Titular")
    expect(screen.getByText("Doméstica")).toBeInTheDocument();
    expect(screen.getByText("Rua das Flores, Lote 1, Praia")).toBeInTheDocument();
  });

  it("exibe o score de risco corretamente", () => {
    render(
      <FichaInteligencia
        alertaId="alerta-123"
        alerta={mockAlerta}
        faturacaoHistorico={mockHistorico}
        medianaCluster={80}
      />
    );

    // Exibe o número do score
    expect(screen.getByText("85")).toBeInTheDocument();
    // Exibe o label formatado para score > 75
    expect(screen.getByText("CRÍTICO")).toBeInTheDocument();
  });

  it("exibe apenas as regras que pontuaram (> 0)", () => {
    render(
      <FichaInteligencia
        alertaId="alerta-123"
        alerta={mockAlerta}
        faturacaoHistorico={mockHistorico}
        medianaCluster={80}
      />
    );

    // Deve mostrar R1 e R2
    expect(screen.getByText("R1")).toBeInTheDocument();
    expect(screen.getByText("Queda súbita de consumo > 50%")).toBeInTheDocument();
    expect(screen.getByText("+30")).toBeInTheDocument();

    expect(screen.getByText("R2")).toBeInTheDocument();
    expect(screen.getByText("+55")).toBeInTheDocument();

    // R3 teve 0 pontos, não deve estar na interface
    expect(screen.queryByText("R3")).not.toBeInTheDocument();
    expect(screen.queryByText("Regra não aplicável")).not.toBeInTheDocument();
  });

  it("gera o link correto de iniciar inspeção", () => {
    render(
      <FichaInteligencia
        alertaId="alerta-123"
        alerta={mockAlerta}
        faturacaoHistorico={mockHistorico}
        medianaCluster={80}
      />
    );

    const btn = screen.getByRole("link", { name: /Iniciar Inspeção/i });
    expect(btn).toHaveAttribute("href", "/mobile/alerta-123/report");
  });
});
