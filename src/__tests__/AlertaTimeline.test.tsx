/**
 * Testes do AlertaTimeline — cronologia de eventos por alerta
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Mock supabase antes do import do componente
const mockMaybeSingle = vi.fn();
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => ({
            maybeSingle: mockMaybeSingle,
          })),
        })),
      })),
    })),
  })),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe("AlertaTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra evento 'Alerta detectado' com timestamp", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null });
    const { AlertaTimeline } = await import(
      "@/modules/alertas/components/AlertaTimeline"
    );
    render(
      <AlertaTimeline
        alertaId="alerta-1"
        criado_em="2026-04-15T10:30:00Z"
        status="Pendente"
        resultado={null}
      />
    );
    await waitFor(() =>
      expect(screen.getByText("Alerta detectado")).toBeInTheDocument()
    );
  });

  it("mostra 'SMS enviado' quando status=Notificado_SMS", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null });
    const { AlertaTimeline } = await import(
      "@/modules/alertas/components/AlertaTimeline"
    );
    render(
      <AlertaTimeline
        alertaId="alerta-2"
        criado_em="2026-04-15T10:30:00Z"
        status="Notificado_SMS"
        resultado={null}
      />
    );
    await waitFor(() => {
      expect(screen.getByText("SMS enviado")).toBeInTheDocument();
    });
  });

  it("mostra 'Ordem de inspeção criada' quando status=Pendente_Inspecao", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null });
    const { AlertaTimeline } = await import(
      "@/modules/alertas/components/AlertaTimeline"
    );
    render(
      <AlertaTimeline
        alertaId="alerta-3"
        criado_em="2026-04-15T10:30:00Z"
        status="Pendente_Inspecao"
        resultado={null}
      />
    );
    await waitFor(() => {
      expect(screen.getByText("Ordem de inspeção criada")).toBeInTheDocument();
    });
  });

  it("mostra 'Inspecionado no terreno' + nome do fiscal quando há relatório", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        criado_em: "2026-04-20T15:00:00Z",
        resultado: "Fraude_Confirmada",
        observacoes: "Contador adulterado",
        perfis: { nome: "João Silva" },
      },
    });
    const { AlertaTimeline } = await import(
      "@/modules/alertas/components/AlertaTimeline"
    );
    render(
      <AlertaTimeline
        alertaId="alerta-4"
        criado_em="2026-04-15T10:30:00Z"
        status="Inspecionado"
        resultado="Fraude_Confirmada"
      />
    );
    await waitFor(() => {
      expect(screen.getByText("Inspecionado no terreno")).toBeInTheDocument();
    });
    expect(screen.getByText("Por João Silva")).toBeInTheDocument();
    expect(screen.getByText("Contador adulterado")).toBeInTheDocument();
    expect(screen.getByText("Fraude confirmada")).toBeInTheDocument();
  });

  it("mostra 'Falso positivo' quando resultado=Falso_Positivo", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        criado_em: "2026-04-20T15:00:00Z",
        resultado: "Falso_Positivo",
        observacoes: null,
        perfis: null,
      },
    });
    const { AlertaTimeline } = await import(
      "@/modules/alertas/components/AlertaTimeline"
    );
    render(
      <AlertaTimeline
        alertaId="alerta-5"
        criado_em="2026-04-15T10:30:00Z"
        status="Inspecionado"
        resultado="Falso_Positivo"
      />
    );
    await waitFor(() => {
      expect(screen.getByText("Falso positivo")).toBeInTheDocument();
    });
  });
});
