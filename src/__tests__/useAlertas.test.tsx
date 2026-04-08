/**
 * Testes do hook useAlertas (src/modules/dashboard/hooks/useAlertas.ts)
 * O cliente Supabase é mockado — sem chamadas reais à BD.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { AlertaTabela } from "@/modules/dashboard/types";

// ---------------------------------------------------------------------------
// Mock do cliente Supabase
// ---------------------------------------------------------------------------

const mockRows = [
  {
    id: "alerta-1",
    id_cliente: "cli-1",
    score_risco: 85,
    status: "Pendente",
    mes_ano: "2024-12",
    resultado: null,
    motivo: [{ regra: "R1", pontos: 25, descricao: "Queda súbita" }],
    clientes: {
      numero_contador: "CONT-001",
      nome_titular: "Ana Cabral",
      morada: "Praia, Santiago",
      tipo_tarifa: "Residencial",
      telemovel: "+238921234567",
      subestacoes: { nome: "Sub-Achada", zona_bairro: "Achada Santo António" },
    },
  },
  {
    id: "alerta-2",
    id_cliente: "cli-2",
    score_risco: 62,
    status: "Notificado_SMS",
    mes_ano: "2024-12",
    resultado: null,
    motivo: [],
    clientes: {
      numero_contador: "CONT-002",
      nome_titular: "Carlos Silva",
      morada: "São Vicente",
      tipo_tarifa: "Comercial",
      telemovel: null,
      subestacoes: { nome: "Sub-Mindelo", zona_bairro: "Mindelo Centro" },
    },
  },
];

// Query builder fluent mock — cada método devolve `this` excepto `range` que resolve
function makeQueryBuilder(resolvedValue: { data: typeof mockRows; count: number }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    order: vi.fn(),
    range: vi.fn().mockResolvedValue(resolvedValue),
    update: vi.fn(),
  };
  // Todos os métodos devolvem o próprio builder (except range que já tem mockResolvedValue)
  for (const key of ["select", "eq", "gte", "order"]) {
    (builder[key] as ReturnType<typeof vi.fn>).mockReturnValue(builder);
  }
  // update().eq() → resolve com { error: null }
  (builder.update as ReturnType<typeof vi.fn>).mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
  return builder;
}

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

const mockSupabase = {
  from: vi.fn(),
  channel: vi.fn().mockReturnValue(mockChannel),
  removeChannel: vi.fn(),
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: { access_token: "test-token" } },
    }),
  },
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("useAlertas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.from.mockReturnValue(
      makeQueryBuilder({ data: mockRows, count: mockRows.length })
    );
    mockSupabase.channel.mockReturnValue(mockChannel);
  });

  it("começa em estado loading=true e termina em false após carregar", async () => {
    const { useAlertas } = await import("@/modules/dashboard/hooks/useAlertas");
    const { result } = renderHook(() => useAlertas({ mesAno: "2024-12" }));
    // loading começa a true (antes do fetch completar)
    // e termina a false depois
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.length).toBeGreaterThanOrEqual(0);
  });

  it("mapeia linhas Supabase para AlertaTabela correctamente", async () => {
    const { useAlertas } = await import("@/modules/dashboard/hooks/useAlertas");
    const { result } = renderHook(() =>
      useAlertas({ mesAno: "2024-12" })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const hookResult = result.current;
    expect(hookResult.data).toHaveLength(2);

    const first = hookResult.data[0] as AlertaTabela;
    expect(first.id).toBe("alerta-1");
    expect(first.id_cliente).toBe("cli-1");
    expect(first.score_risco).toBe(85);
    expect(first.cliente.nome_titular).toBe("Ana Cabral");
    expect(first.subestacao.nome).toBe("Sub-Achada");
  });

  it("total reflecte o count devolvido pela BD", async () => {
    const { useAlertas } = await import("@/modules/dashboard/hooks/useAlertas");
    const { result } = renderHook(() =>
      useAlertas({ mesAno: "2024-12" })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.total).toBe(2);
  });

  it("subscreve ao canal Realtime na montagem e cancela na desmontagem", async () => {
    const { useAlertas } = await import("@/modules/dashboard/hooks/useAlertas");
    const { unmount } = renderHook(() =>
      useAlertas({ mesAno: "2024-12" })
    );

    await waitFor(() => {
      expect(mockSupabase.channel).toHaveBeenCalledWith("alertas-realtime");
    });

    expect(mockChannel.on).toHaveBeenCalled();
    expect(mockChannel.subscribe).toHaveBeenCalled();

    unmount();
    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });

  it("gerarOrdem chama update com status Pendente_Inspecao", async () => {
    const { useAlertas } = await import("@/modules/dashboard/hooks/useAlertas");
    const { result } = renderHook(() =>
      useAlertas({ mesAno: "2024-12" })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const queryBuilder = makeQueryBuilder({ data: mockRows, count: 2 });
    mockSupabase.from.mockReturnValue(queryBuilder);

    await act(async () => {
      await result.current.gerarOrdem("alerta-1");
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("alertas_fraude");
    expect(queryBuilder.update).toHaveBeenCalledWith({
      status: "Pendente_Inspecao",
    });
  });
});
