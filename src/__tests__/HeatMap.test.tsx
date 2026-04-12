import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { HeatMap } from "@/modules/dashboard/components/HeatMap";

const mockEq = vi.fn();
const mockGte = vi.fn();

// Mock Supabase stable instance
const mockSupabase = {
  from: (table: string) => ({
    select: () => {
      const chain = {
        eq: (col: string, val: unknown) => {
          mockEq(col, val);
          return chain;
        },
        gte: (col: string, val: unknown) => {
          mockGte(col, val);
          return chain;
        },
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => {
          if (table === "subestacoes") {
            return resolve({
              data: [{ id: "sub-1", nome: "Sub 1", zona_bairro: "Centro", lat: 10, lng: 10, ativo: true }],
              error: null
            });
          }
          if (table === "injecao_energia") {
            return resolve({
              data: [{ id_subestacao: "sub-1", total_kwh_injetado: 50000 }],
              error: null
            });
          }
          if (table === "alertas_fraude") {
            return resolve({
              data: [{ id: "alt-1", score_risco: 80, clientes: { id_subestacao: "sub-1" } }],
              error: null
            });
          }
          if (table === "faturacao_clientes") {
            return resolve({
              data: [{ kwh_faturado: 35000, clientes: { id_subestacao: "sub-1" } }],
              error: null
            });
          }
          return resolve({ data: [], error: null });
        }
      };
      return chain;
    }
  })
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase
}));

// Mock do import dinâmico que o HeatMap faz
vi.mock("@/modules/dashboard/components/LeafletMap", () => ({
  LeafletMap: ({ subestacoes }: { subestacoes: unknown[] }) => (
    <div data-testid="mock-leaflet-map">
      Mock Map Container, subestacoes count: {subestacoes.length}
    </div>
  )
}));

describe("HeatMap.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exibe o skeleton de carregamento", () => {
    const { container } = render(<HeatMap mesAno="03-2026" />);

    expect(screen.getByText("Mapa de Calor — Subestações")).toBeInTheDocument();
    expect(container.querySelector("[data-slot='skeleton']")).toBeInTheDocument();
  });

  it("renderiza o LeafletMap dinamicamente depois de carregar", async () => {
    render(<HeatMap mesAno="03-2026" />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-leaflet-map")).toBeInTheDocument();
    });

    // Como carregamos 1 subestação mockada, verifica count
    expect(screen.getByText("Mock Map Container, subestacoes count: 1")).toBeInTheDocument();

    // Legendas (verde, ambar, vermelho)
    expect(screen.getByText("<10% perda")).toBeInTheDocument();
    expect(screen.getByText("10-15%")).toBeInTheDocument();
    expect(screen.getByText(">15%")).toBeInTheDocument();
  });
});
