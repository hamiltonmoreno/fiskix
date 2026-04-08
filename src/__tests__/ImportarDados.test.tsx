import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImportarDados } from "@/modules/ingestao/components/ImportarDados";

// ── Mocks ──────────────────────────────────────────────────────────────────────
const mockSupabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: { access_token: "mock-token-123" } },
    }),
  },
  from: () => ({
    select: () => ({
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  }),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Dados de histórico fictícios
const mockHistorico = [
  {
    id: "hist-1",
    tipo: "faturacao",
    nome_ficheiro: "faturacao_marco.csv",
    total_registos: 500,
    registos_sucesso: 498,
    registos_erro: 2,
    criado_em: "2026-03-01T10:00:00Z",
  },
  {
    id: "hist-2",
    tipo: "injecao",
    nome_ficheiro: "injecao_fevereiro.csv",
    total_registos: 24,
    registos_sucesso: 24,
    registos_erro: 0,
    criado_em: "2026-02-01T08:30:00Z",
  },
];

describe("ImportarDados.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Renderização Base ─────────────────────────────────────────────────────
  it("renderiza o cabeçalho e o seletor de tipo", () => {
    render(<ImportarDados historico={[]} />);

    expect(screen.getByText("Importar Dados")).toBeInTheDocument();
    expect(screen.getByText("CSV e Excel de faturação ou injeção")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Faturação de Clientes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Injeção de Energia" })).toBeInTheDocument();
  });

  it("exibe a zona de upload por defeito", () => {
    render(<ImportarDados historico={[]} />);
    expect(screen.getByText("Arrastar ficheiro ou clicar para selecionar")).toBeInTheDocument();
    expect(screen.getByText("CSV, XLS, XLSX até 10MB")).toBeInTheDocument();
  });

  it("mostra mensagem quando histórico está vazio", () => {
    render(<ImportarDados historico={[]} />);
    expect(screen.getByText("Nenhuma importação ainda")).toBeInTheDocument();
  });

  it("renderiza o histórico de importações quando tem dados", () => {
    render(<ImportarDados historico={mockHistorico} />);

    expect(screen.getByText("faturacao_marco.csv")).toBeInTheDocument();
    expect(screen.getByText("injecao_fevereiro.csv")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument(); // total_registos
    expect(screen.getByText("498")).toBeInTheDocument(); // sucesso
    expect(screen.getByText("2")).toBeInTheDocument(); // erros
  });

  // ── 2. Seletor de Tipo ───────────────────────────────────────────────────────
  it("muda as instruções de colunas ao trocar de tipo", () => {
    render(<ImportarDados historico={[]} />);

    // Por defeito: faturação
    expect(
      screen.getByText(/Colunas: numero_contador, mes_ano/)
    ).toBeInTheDocument();

    // Clicar em Injeção de Energia
    fireEvent.click(screen.getByRole("button", { name: "Injeção de Energia" }));

    expect(
      screen.getByText(/Colunas: subestacao_nome, mes_ano/)
    ).toBeInTheDocument();
  });

  // ── 3. Upload com Preview de Sucesso ─────────────────────────────────────────
  it("chama a API de preview ao selecionar um ficheiro CSV e mostra registos válidos", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        preview: [["numero_contador", "mes_ano", "kwh_faturado"], ["C-001", "2026-03", "120"]],
        total: 1,
        validos: 1,
        erros_count: 0,
        erros: [],
      }),
    });

    render(<ImportarDados historico={[]} />);

    // Ativar o input de ficheiro
    const input = document.querySelector("input[type='file']")!;
    const fakeFile = new File(["numero_contador,mes_ano,kwh_faturado\nC-001,2026-03,120"], "teste.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [fakeFile] } });

    // Preview aparece após resolução do fetch mockado
    await waitFor(() => {
      expect(screen.getByText(/Preview: teste.csv/)).toBeInTheDocument();
    });

    expect(screen.getAllByText(/1 registos/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 válidos/).length).toBeGreaterThan(0);

    // Botão de importar deve estar activo (1 válido)
    expect(screen.getByRole("button", { name: /Importar 1 registos válidos/i })).not.toBeDisabled();
  });

  // ── 4. Preview com Erros de Validação ────────────────────────────────────────
  it("exibe os erros de validação no preview quando a API os retorna", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        preview: [["numero_contador", "mes_ano", "kwh_faturado"]],
        total: 2,
        validos: 1,
        erros_count: 1,
        erros: [{ linha: 2, campo: "kwh_faturado", valor: "abc", motivo: "Valor não numérico" }],
      }),
    });

    render(<ImportarDados historico={[]} />);

    const input = document.querySelector("input[type='file']")!;
    const fakeFile = new File(["content"], "erros.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [fakeFile] } });

    await waitFor(() => {
      expect(screen.getByText("Erros de validação:")).toBeInTheDocument();
      expect(screen.getByText(/Linha 2 · kwh_faturado: Valor não numérico/)).toBeInTheDocument();
    });
  });

  // ── 5. Erro de rede (servidor retorna erro HTTP) ──────────────────────────────
  it("exibe erro de servidor quando a API retorna status não-ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Erro interno do servidor" }),
    });

    render(<ImportarDados historico={[]} />);

    const input = document.querySelector("input[type='file']")!;
    const fakeFile = new File(["content"], "falha.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [fakeFile] } });

    await waitFor(() => {
      expect(screen.getByText(/servidor/)).toBeInTheDocument();
      expect(screen.getByText(/Erro interno do servidor/)).toBeInTheDocument();
    });
  });

  // ── 6. Submissão Final ───────────────────────────────────────────────────────
  it("submete a importação, chama a API e exibe ecrã de resultado", async () => {
    // Chamada 1: preview
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        preview: [["numero_contador", "mes_ano"], ["C-001", "2026-03"]],
        total: 1, validos: 1, erros_count: 0, erros: [],
      }),
    });
    // Chamada 2: importação real
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ total: 1, sucesso: 1, erros: 0 }),
    });

    render(<ImportarDados historico={[]} />);

    const input = document.querySelector("input[type='file']")!;
    const fakeFile = new File(["content"], "import.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [fakeFile] } });

    // Esperar o preview
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Importar 1 registos válidos/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Importar 1 registos válidos/i }));

    // Resultado
    await waitFor(() => {
      expect(screen.getByText("Importação concluída")).toBeInTheDocument();
      expect(screen.getByText("1 inseridos · 0 erros")).toBeInTheDocument();
    });

    // fetch deve ter sido chamado 2x (preview + importação)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
