import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TendenciaPerdas } from "@/modules/dashboard/components/TendenciaPerdas";

// ── Mocks ──────────────────────────────────────────────────────────────────────
const mockSelect = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();

// Mock do Supabase
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: vi.fn(),
    from: () => ({
      select: () => {
        const selectObj = {
          in: (col: string, val: string[]) => {
            const inObj = {
              eq: (col2: string, val2: string) => {
                return Promise.resolve({
                  data: [
                    { kwh_injetado: 50000, kwh_faturado: 45000, valor_cve: 600000, mes_ano: "2026-01-01", total_kwh_injetado: 50000 },
                    { kwh_injetado: 52000, kwh_faturado: 46000, valor_cve: 610000, mes_ano: "2026-02-01", total_kwh_injetado: 52000 },
                    { kwh_injetado: 48000, kwh_faturado: 48000, valor_cve: 650000, mes_ano: "2026-03-01", total_kwh_injetado: 48000 },
                  ],
                  error: null
                });
              },
              then: (resolve: any) => resolve({
                 data: [
                    { kwh_injetado: 50000, kwh_faturado: 45000, valor_cve: 600000, mes_ano: "2026-01", total_kwh_injetado: 50000 },
                    { kwh_injetado: 52000, kwh_faturado: 46000, valor_cve: 610000, mes_ano: "2026-02", total_kwh_injetado: 52000 },
                    { kwh_injetado: 48000, kwh_faturado: 48000, valor_cve: 650000, mes_ano: "2026-03", total_kwh_injetado: 48000 },
                  ],
                  error: null
              })
            };
            return inObj;
          }
        };
        mockSelect();
        return selectObj;
      }
    }),
  }),
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
