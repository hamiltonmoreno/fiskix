import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Top5Transformadores } from "@/modules/dashboard/components/Top5Transformadores";

// ── Mocks ──────────────────────────────────────────────────────────────────────
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockIn = vi.fn();

const mockSupabase = {
  from: (table: string) => ({
    select: () => {
      mockSelect(table);
      const chain = {
        eq: (col: string, val: string) => {
          mockEq(col, val);
          return chain;
        },
        order: () => {
          mockOrder();
          return chain;
        },
        limit: () => {
          mockLimit();
          if (table === "injecao_energia") {
            return Promise.resolve({
              data: [
                { id_subestacao: "sub-1", total_kwh_injetado: 100000, subestacoes: { nome: "Sub 1" } },
                { id_subestacao: "sub-2", total_kwh_injetado: 80000, subestacoes: { nome: "Sub 2" } },
              ],
              error: null
            });
          }
          return Promise.resolve({ data: [], error: null });
        },
        in: (col: string, val: string[]) => {
          mockIn(col, val);
          if (table === "clientes") {
            return Promise.resolve({
              data: [
                { id: "cli-1", id_subestacao: "sub-1" },
                { id: "cli-2", id_subestacao: "sub-2" },
              ],
              error: null
            });
          }
          if (table === "faturacao_clientes") {
            return Promise.resolve({
              data: [
                { id_cliente: "cli-1", kwh_faturado: 80000, valor_cve: 1200000 },
                { id_cliente: "cli-2", kwh_faturado: 75000, valor_cve: 1100000 },
              ],
              error: null
            });
          }
          return Promise.resolve({ data: [], error: null });
        }
      };
      return chain;
    }
  })
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

// Mock do Recharts
vi.mock("recharts", async () => {
  const OriginalRecharts = await vi.importActual<any>("recharts");
  return {
    ...OriginalRecharts,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  };
});

describe("Top5Transformadores.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exibe o skeleton enquanto carega e depois exibe eixos com dados de transformação", async () => {
    const { container } = render(<Top5Transformadores mesAno="2026-03" />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    
    // Confirma título
    expect(screen.getByText("Top 5 Transformadores — Energia Injetada vs Faturada")).toBeInTheDocument();

    await waitFor(() => {
      // Skeleton sumiu!
      expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();
    });

    // Assegura que não há mensagem "Sem dados..." pois injetámos dados mockados validos
    expect(screen.queryByText(/Sem dados de injeção/i)).not.toBeInTheDocument();
  });
});
