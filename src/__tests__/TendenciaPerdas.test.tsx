import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TendenciaPerdas } from "@/modules/dashboard/components/TendenciaPerdas";

// ── Mocks ──────────────────────────────────────────────────────────────────────
const mockSelect = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockEq = vi.fn();

// Mock do Supabase
const mockSupabase = {
  from: (table: string) => ({
    select: () => {
      const chain = {
        eq: (col: string, val: any) => {
          mockEq(col, val);
          return chain;
        },
        gte: (col: string, val: any) => {
          mockGte(col, val);
          return chain;
        },
        lte: (col: string, val: any) => {
          mockLte(col, val);
          return chain;
        },
        in: (col: string, val: string[]) => {
          return chain;
        },
        then: (resolve: any) => {
          if (table === "injecao_energia") {
            return resolve({
              data: [
                { mes_ano: "2026-01", total_kwh_injetado: 50000 },
                { mes_ano: "2026-02", total_kwh_injetado: 52000 },
                { mes_ano: "2026-03", total_kwh_injetado: 48000 },
              ],
              error: null
            });
          }
          if (table === "faturacao_clientes") {
            return resolve({
              data: [
                { mes_ano: "2026-01", kwh_faturado: 40000, valor_cve: 600000 },
                { mes_ano: "2026-02", kwh_faturado: 42000, valor_cve: 630000 },
                { mes_ano: "2026-03", kwh_faturado: 38000, valor_cve: 570000 },
              ],
              error: null
            });
          }
          return resolve({ data: [], error: null });
        }
      };
      mockSelect();
      return chain;
    }
  })
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

// Mock do Recharts (evita o ResizeObserver error)
vi.mock("recharts", async () => {
  const OriginalRecharts = await vi.importActual<any>("recharts");
  return {
    ...OriginalRecharts,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  };
});

describe("TendenciaPerdas.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o Skeleton de loading inicialmente e depois os dados do gráfico", async () => {
    // Rendemos o componente
    const { container } = render(<TendenciaPerdas mesAno="2026-03" />);
    
    // O skeleton inicia visível
    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();

    // Verificamos que o texto descritivo e título aparecem
    expect(screen.getByText("Tendência de Perdas — 12 Meses")).toBeInTheDocument();

    await waitFor(() => {
      // O Skeleton deve ter desaparecido
      expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();
    });
    
    // Assegurar que não está a mostrar a mensagem de vazio
    expect(screen.queryByText(/Sem dados de injeção/i)).not.toBeInTheDocument();
  });
});
