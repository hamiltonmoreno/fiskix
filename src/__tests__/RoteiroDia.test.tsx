/**
 * Testes do componente RoteiroDia (src/modules/mobile/components/RoteiroDia.tsx)
 *
 * Cobre:
 * - Estado de loading (skeletons animate-pulse)
 * - Estado vazio (sem ordens para hoje)
 * - Exibição de ordens (nome_titular, numero_contador, zona_bairro)
 * - Badge CRÍTICO vs MÉDIO baseado no score_risco
 * - Header com nome do fiscal e zona
 * - Banner de sincronização offline
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RoteiroDia } from "@/modules/mobile/components/RoteiroDia";

// ── Mocks Next.js ──────────────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// ── Mock idb (IndexedDB) ───────────────────────────────────────────────────────
vi.mock("idb", () => ({
  openDB: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockResolvedValue([]),
    delete: vi.fn(),
  }),
}));

// ── Mock Supabase ──────────────────────────────────────────────────────────────
let mockQueryData: unknown[] = [];

const mockOrder = vi.fn().mockImplementation(() => ({ data: mockQueryData }));
const mockEqStatus = vi.fn().mockReturnValue({ order: mockOrder });
const mockEqMes = vi.fn().mockReturnValue({ eq: mockEqStatus });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEqMes });
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
const mockSignOut = vi.fn().mockResolvedValue({});

const mockSupabase = {
  from: mockFrom,
  auth: { signOut: mockSignOut },
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

// ── Dados mock ─────────────────────────────────────────────────────────────────
const ordemCritica = {
  id: "ordem-critica-001",
  score_risco: 82,
  status: "Pendente_Inspecao",
  mes_ano: "2026-04",
  motivo: [
    { regra: "R1", pontos: 25 },
    { regra: "R3", pontos: 20 },
  ],
  clientes: {
    id: "cliente-001",
    numero_contador: "CV-12345",
    nome_titular: "João da Silva",
    morada: "Rua do Porto, 12, Praia",
    tipo_tarifa: "BT_Residencial",
    telemovel: "+2389912345",
    lat: 14.93,
    lng: -23.51,
    subestacoes: {
      nome: "Sub. Praia Centro",
      zona_bairro: "Praia_Centro",
    },
  },
};

const ordemMedia = {
  id: "ordem-media-002",
  score_risco: 60,
  status: "Pendente_Inspecao",
  mes_ano: "2026-04",
  motivo: [{ regra: "R2", pontos: 15 }],
  clientes: {
    id: "cliente-002",
    numero_contador: "CV-67890",
    nome_titular: "Maria Costa",
    morada: "Av. Amílcar Cabral, 5",
    tipo_tarifa: "BT_Residencial",
    telemovel: null,
    lat: null,
    lng: null,
    subestacoes: {
      nome: "Sub. Achada St. António",
      zona_bairro: "Achada_St_Antonio",
    },
  },
};

const ordemCache = {
  id: "ordem-cache-003",
  score_risco: 78,
  status: "Pendente_Inspecao",
  mes_ano: "2026-04",
  motivo: [{ regra: "R1", pontos: 25 }],
  cliente: {
    id: "cliente-cache-003",
    numero_contador: "CV-11223",
    nome_titular: "Paulo Lima",
    morada: "Palmarejo, Praia",
    tipo_tarifa: "BT_Residencial",
    telemovel: "+2389911122",
    lat: 14.92,
    lng: -23.52,
  },
  subestacao: {
    nome: "Sub. Palmarejo",
    zona_bairro: "Palmarejo",
  },
};

// ── Reset mocks antes de cada teste ───────────────────────────────────────────
beforeEach(() => {
  mockQueryData = [];
  mockOrder.mockImplementation(() => ({ data: mockQueryData }));
  mockFrom.mockClear();
  localStorage.clear();
  // navigator.onLine = true por omissão no jsdom
  Object.defineProperty(navigator, "onLine", { value: true, writable: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("RoteiroDia — Header e informação do fiscal", () => {
  it("mostra o nome do fiscal no header", async () => {
    render(
      <RoteiroDia fiscalId="fiscal-001" zona="Praia_Centro" nomeFiscal="Carlos Fonseca" />
    );
    await waitFor(() =>
      expect(screen.getByText("Carlos Fonseca")).toBeInTheDocument()
    );
  });

  it("mostra a zona do fiscal no banner azul", async () => {
    render(
      <RoteiroDia fiscalId="fiscal-001" zona="Praia_Centro" nomeFiscal="Carlos Fonseca" />
    );
    await waitFor(() =>
      expect(screen.getByText(/Zona:.*Praia Centro/)).toBeInTheDocument()
    );
  });

  it("não mostra zona quando id_zona é null", async () => {
    mockQueryData = [];
    render(
      <RoteiroDia fiscalId="fiscal-001" zona={null} nomeFiscal="Carlos Fonseca" />
    );
    await waitFor(() =>
      expect(screen.queryByText(/Zona:/)).not.toBeInTheDocument()
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("RoteiroDia — Estado vazio (sem ordens)", () => {
  it("mostra 'Sem ordens para hoje' quando não há alertas", async () => {
    mockQueryData = [];
    render(
      <RoteiroDia fiscalId="fiscal-001" zona="Praia_Centro" nomeFiscal="Carlos Fonseca" />
    );
    await waitFor(() =>
      expect(screen.getByText("Sem ordens para hoje")).toBeInTheDocument()
    );
  });

  it("mostra '0 ordem(s) para hoje' no contador", async () => {
    mockQueryData = [];
    render(
      <RoteiroDia fiscalId="fiscal-001" zona="Praia_Centro" nomeFiscal="Carlos Fonseca" />
    );
    await waitFor(() =>
      expect(screen.getByText("0 ordem(s) para hoje")).toBeInTheDocument()
    );
  });

  it("exibe o texto de instrução para atualizar", async () => {
    mockQueryData = [];
    render(
      <RoteiroDia fiscalId="fiscal-001" zona="Praia_Centro" nomeFiscal="Carlos Fonseca" />
    );
    await waitFor(() =>
      expect(
        screen.getByText(/Toque em atualizar para verificar novamente/i)
      ).toBeInTheDocument()
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("RoteiroDia — Listagem de ordens", () => {
  it("mostra o nome do titular quando há ordens", async () => {
    mockQueryData = [ordemCritica];
    render(
      <RoteiroDia fiscalId="fiscal-001" zona="Praia_Centro" nomeFiscal="Carlos Fonseca" />
    );
    await waitFor(() =>
      expect(screen.getByText("João da Silva")).toBeInTheDocument()
    );
  });

  it("mostra o número do contador", async () => {
    mockQueryData = [ordemCritica];
    render(
      <RoteiroDia fiscalId="fiscal-001" zona="Praia_Centro" nomeFiscal="Carlos Fonseca" />
    );
    await waitFor(() =>
      expect(screen.getByText("CV-12345")).toBeInTheDocument()
    );
  });

  it("mostra a morada do cliente", async () => {
    mockQueryData = [ordemCritica];
    render(
      <RoteiroDia fiscalId="fiscal-001" zona="Praia_Centro" nomeFiscal="Carlos Fonseca" />
    );
    await waitFor(() =>
      expect(screen.getByText("Rua do Porto, 12, Praia")).toBeInTheDocument()
    );
  });

  it("exibe badge CRÍTICO para score >= 75", async () => {
    mockQueryData = [ordemCritica]; // score 82
    render(
      <RoteiroDia fiscalId="fiscal-001" zona="Praia_Centro" nomeFiscal="Carlos Fonseca" />
    );
    await waitFor(() =>
      expect(screen.getByText("CRÍTICO")).toBeInTheDocument()
    );
  });

  it("exibe badge MÉDIO para score entre 50 e 74", async () => {
    mockQueryData = [ordemMedia]; // score 60
    render(
      <RoteiroDia fiscalId="fiscal-001" zona="Praia_Centro" nomeFiscal="Carlos Fonseca" />
    );
    await waitFor(() =>
      expect(screen.getByText("MÉDIO")).toBeInTheDocument()
    );
  });

  it("mostra o contador correto de ordens no banner", async () => {
    mockQueryData = [ordemCritica, ordemMedia];
    render(
      <RoteiroDia fiscalId="fiscal-001" zona="Praia_Centro" nomeFiscal="Carlos Fonseca" />
    );
    await waitFor(() =>
      expect(screen.getByText("2 ordem(s) para hoje")).toBeInTheDocument()
    );
  });

  it("gera link correto para a ficha de inteligência de cada ordem", async () => {
    mockQueryData = [ordemCritica];
    render(
      <RoteiroDia fiscalId="fiscal-001" zona="Praia_Centro" nomeFiscal="Carlos Fonseca" />
    );
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /João da Silva/i });
      expect(link).toHaveAttribute("href", "/mobile/ordem-critica-001");
    }, { timeout: 10000 });
  });

  it("mostra as regras pontuadas (R1, R3) em badges", async () => {
    mockQueryData = [ordemCritica];
    render(
      <RoteiroDia fiscalId="fiscal-001" zona="Praia_Centro" nomeFiscal="Carlos Fonseca" />
    );
    await waitFor(() => {
      expect(screen.getByText("R1")).toBeInTheDocument();
      expect(screen.getByText("R3")).toBeInTheDocument();
    });
  });

  it("mostra 'Abrir no Mapa' quando lat/lng existem", async () => {
    mockQueryData = [ordemCritica]; // tem lat/lng
    render(
      <RoteiroDia fiscalId="fiscal-001" zona="Praia_Centro" nomeFiscal="Carlos Fonseca" />
    );
    await waitFor(() =>
      expect(screen.getByText("Abrir no Mapa")).toBeInTheDocument()
    );
  });

  it("NÃO mostra 'Abrir no Mapa' quando lat/lng são null", async () => {
    mockQueryData = [ordemMedia]; // lat/lng null
    render(
      <RoteiroDia fiscalId="fiscal-001" zona="Praia_Centro" nomeFiscal="Carlos Fonseca" />
    );
    await waitFor(() =>
      expect(screen.queryByText("Abrir no Mapa")).not.toBeInTheDocument()
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("RoteiroDia — Estado de loading", () => {
  it("mostra skeletons animate-pulse enquanto carrega", () => {
    // Simular promise nunca resolvida para manter estado loading
    mockOrder.mockReturnValueOnce(new Promise(() => {}));
    const { container } = render(
      <RoteiroDia fiscalId="fiscal-001" zona="Praia_Centro" nomeFiscal="Carlos Fonseca" />
    );
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("RoteiroDia — Fluxo offline no arranque", () => {
  it("carrega ordens do cache local quando inicia offline", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });
    localStorage.setItem("fiskix_ordens", JSON.stringify([ordemCache]));

    render(
      <RoteiroDia fiscalId="fiscal-001" zona="Praia_Centro" nomeFiscal="Carlos Fonseca" />
    );

    await waitFor(() =>
      expect(screen.getByText("Paulo Lima")).toBeInTheDocument()
    );
    expect(screen.getByText("1 ordem(s) para hoje")).toBeInTheDocument();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("mostra aviso offline e remove aviso ao voltar online", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });

    render(
      <RoteiroDia fiscalId="fiscal-001" zona="Praia_Centro" nomeFiscal="Carlos Fonseca" />
    );

    await waitFor(() =>
      expect(screen.getByText(/Modo offline/i)).toBeInTheDocument()
    );

    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
    fireEvent(window, new Event("online"));

    await waitFor(() =>
      expect(screen.queryByText(/Modo offline/i)).not.toBeInTheDocument()
    );
  });
});
