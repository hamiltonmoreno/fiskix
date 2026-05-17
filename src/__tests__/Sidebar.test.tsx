/**
 * Testes do componente Sidebar (src/components/Sidebar.tsx)
 *
 * Nota: O Sidebar renderiza o conteúdo 2x no DOM (mobile drawer + desktop aside).
 * Usamos `within(aside)` para queries scoped no desktop, e `getAllBy` onde
 * a duplicação é esperada.
 *
 * Cobre:
 * - Renderização de itens de navegação por role
 * - Visibilidade da secção Admin (admin_fiskix, gestor_perdas)
 * - Visibilidade de Relatórios (diretor, gestor_perdas, admin_fiskix)
 * - Funcionalidade de collapse com localStorage
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { Sidebar } from "@/components/Sidebar";

// ── Mocks Next.js ──────────────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mockar os componentes de acção que o Sidebar agora inclui na barra mobile.
// O teste foca-se na navegação e collapse — não nesses componentes.
vi.mock("@/components/mosaic/DropdownNotifications", () => ({
  DropdownNotifications: () => null,
}));
vi.mock("@/components/mosaic/DropdownProfile", () => ({
  DropdownProfile: () => null,
}));
vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => null,
}));
vi.mock("@/components/mosaic/ModalSearch", () => ({
  ModalSearch: () => null,
}));

// ── Mock Supabase client ───────────────────────────────────────────────────────
// O Sidebar subscreve a um canal de realtime para o badge `criticalCount`,
// pelo que o mock precisa expor `.channel()` com a chain on().subscribe()
// e `removeChannel()` para o cleanup do useEffect.
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};
const mockSupabase = {
  auth: {
    signOut: vi.fn().mockResolvedValue({}),
  },
  channel: vi.fn(() => mockChannel),
  removeChannel: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        gte: vi.fn().mockResolvedValue({ count: 0, data: [], error: null }),
      })),
    })),
  })),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

// ── Helper — renderiza e retorna o <aside> do desktop ─────────────────────────
// async + await act() para flush de microtasks do useEffect de realtime,
// evitando "not wrapped in act" warnings causados pelo mockResolvedValue assíncrono.
async function renderSidebar(role: string) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Sidebar
        profile={{
          role,
          nome_completo: "Hamilton Teste",
          id_zona: "Praia_Centro",
        }}
      />
    );
  });
  // O <aside> é único no DOM (só existe na versão desktop)
  const aside = result.container.querySelector("aside")!;
  return { ...result, aside };
}

beforeEach(() => {
  localStorage.clear();
  // O Sidebar lê o estado inicial de document.documentElement.classList,
  // não diretamente de localStorage — limpar entre testes para evitar contaminação.
  document.documentElement.classList.remove("sidebar-collapsed-init");
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("Sidebar — Itens de navegação base", () => {
  it("exibe sempre Dashboard e Alertas", async () => {
    await renderSidebar("gestor_perdas");
    // Aparecem 2x (mobile + desktop) → getAllBy
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Alertas").length).toBeGreaterThan(0);
  });

  it("exibe o nome do utilizador no footer do aside desktop", async () => {
    const { aside } = await renderSidebar("gestor_perdas");
    expect(within(aside).getByText("Hamilton Teste")).toBeInTheDocument();
  });

  it("exibe o label 'Administrador' para role admin_fiskix", async () => {
    const { aside } = await renderSidebar("admin_fiskix");
    expect(within(aside).getByText("Administrador")).toBeInTheDocument();
  });

  it("exibe 'Gestor de Perdas' para role gestor_perdas", async () => {
    const { aside } = await renderSidebar("gestor_perdas");
    expect(within(aside).getByText("Gestor de Perdas")).toBeInTheDocument();
  });

  it("exibe o label de role 'Diretor' no footer para role diretor", async () => {
    const { aside } = await renderSidebar("diretor");
    expect(within(aside).getByText("Diretor")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("Sidebar — Controlo de acesso por Role", () => {
  it("admin_fiskix vê a secção Configurações", async () => {
    await renderSidebar("admin_fiskix");
    // Aparece mobile + desktop → getAllBy
    expect(screen.getAllByText("Configurações").length).toBeGreaterThan(0);
  });

  it("gestor_perdas vê a secção Configurações", async () => {
    await renderSidebar("gestor_perdas");
    expect(screen.getAllByText("Configurações").length).toBeGreaterThan(0);
  });

  it("diretor NÃO vê a secção Configurações", async () => {
    await renderSidebar("diretor");
    expect(screen.queryByText("Configurações")).not.toBeInTheDocument();
  });

  it("fiscal NÃO vê a secção Configurações", async () => {
    await renderSidebar("fiscal");
    expect(screen.queryByText("Configurações")).not.toBeInTheDocument();
  });

  it("supervisor NÃO vê a secção Configurações", async () => {
    await renderSidebar("supervisor");
    expect(screen.queryByText("Configurações")).not.toBeInTheDocument();
  });

  it("admin_fiskix vê Utilizadores e Configuração (superAdminOnly)", async () => {
    await renderSidebar("admin_fiskix");
    expect(screen.getAllByText("Utilizadores").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Configuração").length).toBeGreaterThan(0);
  });

  it("gestor_perdas NÃO vê Utilizadores nem Configuração", async () => {
    await renderSidebar("gestor_perdas");
    expect(screen.queryByText("Utilizadores")).not.toBeInTheDocument();
    expect(screen.queryByText("Configuração")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("Sidebar — Relatórios (visibilidade por role)", () => {
  it("admin_fiskix vê Relatórios", async () => {
    await renderSidebar("admin_fiskix");
    expect(screen.getAllByText("Relatórios").length).toBeGreaterThan(0);
  });

  it("diretor vê Relatórios", async () => {
    await renderSidebar("diretor");
    expect(screen.getAllByText("Relatórios").length).toBeGreaterThan(0);
  });

  it("gestor_perdas vê Relatórios", async () => {
    await renderSidebar("gestor_perdas");
    expect(screen.getAllByText("Relatórios").length).toBeGreaterThan(0);
  });

  it("fiscal NÃO vê Relatórios", async () => {
    await renderSidebar("fiscal");
    expect(screen.queryByText("Relatórios")).not.toBeInTheDocument();
  });

  it("supervisor NÃO vê Relatórios", async () => {
    await renderSidebar("supervisor");
    expect(screen.queryByText("Relatórios")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("Sidebar — Collapse com localStorage", () => {
  it("inicia expandida por omissão (sem localStorage)", async () => {
    const { aside } = await renderSidebar("gestor_perdas");
    expect(aside.className).toContain("w-64");
  });

  it("lê o estado collapsed do localStorage na montagem", async () => {
    // O componente inicializa via document.documentElement.classList (script inline
    // no layout), não lendo localStorage diretamente — evita flicker de hidratação.
    document.documentElement.classList.add("sidebar-collapsed-init");
    const { aside } = await renderSidebar("gestor_perdas");
    expect(aside.className).toContain("w-16");
  });

  it("ao clicar no botão de recolher, persiste 'true' no localStorage", async () => {
    const { aside } = await renderSidebar("gestor_perdas");
    // within(aside) garante que apanhamos apenas o botão do desktop
    const collapseBtn = within(aside).getByRole("button", { name: "Recolher menu" });
    fireEvent.click(collapseBtn);
    expect(localStorage.getItem("sidebar-collapsed")).toBe("true");
  });
});
