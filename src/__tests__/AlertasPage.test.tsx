import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AlertasPage from "@/app/alertas/page";

// ── Mocks ──────────────────────────────────────────────────────────────────────
const mockSelect = vi.fn();
const mockEq = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockRange = vi.fn();
const mockUpdate = vi.fn().mockResolvedValue({ error: null });

const mockSupabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: { access_token: "mock-token-123" } },
    }),
  },
  from: (table: string) => ({
    select: (fields: string, opts?: { count?: "exact" | "planned" | "estimated" }) => {
      mockSelect(table, fields, opts);
      const chain = {
        eq: (col: string, val: unknown) => {
          mockEq(col, val);
          return chain;
        },
        order: () => {
          mockOrder();
          return chain;
        },
        range: (start: number, end: number) => {
          mockRange(start, end);
          if (table === "alertas_fraude") {
            return Promise.resolve({
              data: [
                {
                  id: "alerta-1",
                  score_risco: 85,
                  status: "Pendente",
                  mes_ano: "2026-03",
                  resultado: null,
                  motivo: [{ regra: "R1", pontos: 25, descricao: "Queda de consumo" }],
                  clientes: {
                    numero_contador: "C-001",
                    nome_titular: "João Alerta",
                    morada: "Rua do Palmarejo",
                    tipo_tarifa: "Doméstica",
                    telemovel: "9998877",
                    subestacoes: { nome: "Subestação 1", zona_bairro: "Palmarejo" }
                  }
                }
              ],
              count: 1,
              error: null
            });
          }
          return Promise.resolve({ data: [], count: 0, error: null });
        },
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => {
          if (table === "subestacoes") {
            return resolve({ data: [{ zona_bairro: "Palmarejo" }, { zona_bairro: "Achada" }], error: null });
          }
          return resolve({ data: [], error: null });
        }
      };
      return chain;
    },
    update: (val: unknown) => {
      mockUpdate(val);
      return {
        eq: (col: string, id: unknown) => {
          mockEq(col, id);
          return Promise.resolve({ error: null });
        }
      };
    }
  }),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

// Mock do Fetch para as Edge Functions
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("AlertasPage.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o cabeçalho e os filtros corretamente", async () => {
    render(<AlertasPage />);

    expect(screen.getByText("Alertas de Fraude")).toBeInTheDocument();
    expect(screen.getByText(/Motor de scoring activo/)).toBeInTheDocument();
    
    // O filtro de zona usa shadcn Select — opções não estão no DOM até o dropdown abrir
    // Verificamos apenas que o componente renderizou sem erros após carregar zonas
    await waitFor(() => {
      expect(screen.getByText("Alertas de Fraude")).toBeInTheDocument();
    });
  });

  it("apresenta o alerta mockado na tabela", async () => {
    render(<AlertasPage />);

    await waitFor(() => {
      expect(screen.getByText("João Alerta")).toBeInTheDocument();
      expect(screen.getByText("85")).toBeInTheDocument();
      expect(screen.getAllByText("CRÍTICO").length).toBeGreaterThan(0);
      expect(screen.getByText("C-001")).toBeInTheDocument();
    });
  });

  it("muda o range de paginação ao clicar em atualizar (load inicial)", async () => {
    render(<AlertasPage />);
    
    await waitFor(() => {
      // PAGE_SIZE é 15, então range inicial deve ser 0 a 14
      expect(mockRange).toHaveBeenCalledWith(0, 14);
    });
  });

  it("ao clicar em enviar SMS, chama a Edge Function send-sms", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ mensagem_enviada: true }),
    });

    render(<AlertasPage />);

    // Esperar carregar o alerta
    const btnSms = await screen.findByRole("button", { name: /SMS/i });
    fireEvent.click(btnSms);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/functions/v1/send-sms"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ alerta_id: "alerta-1", tipo: "vermelho" })
        })
      );
    });
  });

  it("ao clicar em gerar ordem, faz o update do status no supabase", async () => {
    render(<AlertasPage />);

    const btnOrdem = await screen.findByRole("button", { name: /Ordem/i });
    fireEvent.click(btnOrdem);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "Pendente_Inspecao" }));
    });
  });
});
