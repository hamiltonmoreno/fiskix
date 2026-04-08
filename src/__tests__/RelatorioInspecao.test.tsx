import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RelatorioInspecao } from "@/modules/mobile/components/RelatorioInspecao";

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

// Mock do IDB (IndexedDB)
vi.mock("idb", () => ({
  openDB: vi.fn().mockResolvedValue({
    put: vi.fn().mockResolvedValue(true),
    getAll: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true),
  }),
}));

const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockResolvedValue({ error: null });
const mockUpload = vi.fn().mockResolvedValue({ data: { path: "teste.jpg" }, error: null });
const mockEq = vi.fn();

const mockSupabase = {
  from: (table: string) => ({
    select: () => ({
      eq: (col: string, val: unknown) => {
        mockEq(col, val);
        return Promise.resolve({ data: [], error: null });
      },
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => {
        if (table === "alertas_fraude") {
          return resolve({
            data: [{ id: "alerta-1", status: "Pendente" }],
            error: null
          });
        }
        return resolve({ data: [], error: null });
      }
    }),
    insert: (val: unknown) => {
      mockInsert(val);
      return Promise.resolve({ error: null });
    },
    update: (val: unknown) => {
      mockUpdate(val);
      return { eq: () => Promise.resolve({ error: null }) };
    }
  }),
  storage: {
    from: () => ({
      upload: mockUpload,
      getPublicUrl: () => ({ data: { publicUrl: "http://mock-url.jpg" } }),
    }),
  },
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

// ── Props Base ─────────────────────────────────────────────────────────────────
const defaultProps = {
  alertaId: "alerta-123",
  fiscalId: "fiscal-456",
  nomeCliente: "Maria da Graça",
  numeroContador: "C-12345",
};

describe("RelatorioInspecao.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mudar behavior padrão do navigator para estar "Online"
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true
    });
  });

  it("renderiza cabeçalho com nome do cliente corretamente", () => {
    render(<RelatorioInspecao {...defaultProps} />);
    expect(screen.getByText("Relatório de Inspeção")).toBeInTheDocument();
    expect(screen.getByText("Maria da Graça")).toBeInTheDocument();
  });

  it("permite selecionar um resultado e esconde 'Tipo Fraude' se não for Fraude Confirmada", () => {
    render(<RelatorioInspecao {...defaultProps} />);

    const fraudeConfirmadaLabel = screen.getByText("Fraude Confirmada");
    const anomaliaTecnicaLabel = screen.getByText("Anomalia Técnica");

    // Inicialmente o campo de tipo de fraude não deve estar visível
    expect(screen.queryByText("Tipo de Fraude")).not.toBeInTheDocument();

    // Clicar em Fraude Confirmada
    fireEvent.click(fraudeConfirmadaLabel);
    expect(screen.getByText("Tipo de Fraude")).toBeInTheDocument(); // Agora revela-se
    
    // Clicar em Anomalia
    fireEvent.click(anomaliaTecnicaLabel);
    expect(screen.queryByText("Tipo de Fraude")).not.toBeInTheDocument(); // Oculta
  });

  it("botão de Sincronizar fica inativo até ter resultado", () => {
    render(<RelatorioInspecao {...defaultProps} />);
    
    const syncBtn = screen.getByRole("button", { name: /Sincronizar Relatório/i });
    expect(syncBtn).toBeDisabled();

    // Clicar resultado
    fireEvent.click(screen.getByText("Falso Positivo"));
    expect(syncBtn).not.toBeDisabled();
  });

  it("comporta-se corretamente num cenário Offline alertando visualmente", () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true
    });

    render(<RelatorioInspecao {...defaultProps} />);
    
    // Verifica aviso amarelo
    expect(screen.getByText(/Sem ligação — será guardado/i)).toBeInTheDocument();
  });

  it("simula submissão do formulário chamando o Supabase", async () => {
    render(<RelatorioInspecao {...defaultProps} />);
    
    // Configura formulário
    fireEvent.click(screen.getByText("Falso Positivo"));
    fireEvent.change(screen.getByPlaceholderText(/Descreva o que encontrou/i), {
      target: { value: "Contador normal, poeiras no display." }
    });

    const syncBtn = screen.getByRole("button", { name: /Sincronizar Relatório/i });
    fireEvent.click(syncBtn);

    // Mostra loading state
    expect(screen.getByText(/A sincronizar/i)).toBeInTheDocument();

    // Verificação que as mocks Supabase foram chamadas
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        id_alerta: "alerta-123",
        id_fiscal: "fiscal-456",
        resultado: "Falso_Positivo",
        observacoes: "Contador normal, poeiras no display."
      }));
      expect(mockUpdate).toHaveBeenCalled();
    });

    // Mostra Ecrã de Sucesso
    await waitFor(() => {
      expect(screen.getByText("Relatório Submetido")).toBeInTheDocument();
      expect(screen.getByText("Sincronizado com sucesso.")).toBeInTheDocument();
    });
  });
});
