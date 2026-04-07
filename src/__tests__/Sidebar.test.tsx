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
import { render, screen, fireEvent, within } from "@testing-library/react";
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

// ── Mock Supabase client ───────────────────────────────────────────────────────
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: vi.fn().mockResolvedValue({}),
    },
  }),
}));

// ── Helper — renderiza e retorna o <aside> do desktop ─────────────────────────
function renderSidebar(role: string) {
  const result = render(
    <Sidebar
      profile={{
        role,
        nome_completo: "Hamilton Teste",
        id_zona: "Praia_Centro",
      }}
    />
  );
  // O <aside> é único no DOM (só existe na versão desktop)
  const aside = result.container.querySelector("aside")!;
  return { ...result, aside };
}

beforeEach(() => {
  localStorage.clear();
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("Sidebar — Itens de navegação base", () => {
  it("exibe sempre Dashboard e Alertas", () => {
    renderSidebar("gestor_perdas");
    // Aparecem 2x (mobile + desktop) → getAllBy
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Alertas").length).toBeGreaterThan(0);
  });

  it("exibe o nome do utilizador no footer do aside desktop", () => {
    const { aside } = renderSidebar("gestor_perdas");
    expect(within(aside).getByText("Hamilton Teste")).toBeInTheDocument();
  });

  it("exibe o label 'Administrador' para role admin_fiskix", () => {
    const { aside } = renderSidebar("admin_fiskix");
    expect(within(aside).getByText("Administrador")).toBeInTheDocument();
  });

  it("exibe 'Gestor de Perdas' para role gestor_perdas", () => {
    const { aside } = renderSidebar("gestor_perdas");
    expect(within(aside).getByText("Gestor de Perdas")).toBeInTheDocument();
  });

  it("exibe as iniciais 'HT' do nome no avatar", () => {
    renderSidebar("diretor");
    // Existem 2 avatares (mobile + desktop)
    expect(screen.getAllByText("HT").length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("Sidebar — Controlo de acesso por Role", () => {
  it("admin_fiskix vê a secção Administração", () => {
    renderSidebar("admin_fiskix");
    // Aparece mobile + desktop → getAllBy
    expect(screen.getAllByText("Administração").length).toBeGreaterThan(0);
  });

  it("gestor_perdas vê a secção Administração", () => {
    renderSidebar("gestor_perdas");
    expect(screen.getAllByText("Administração").length).toBeGreaterThan(0);
  });

  it("diretor NÃO vê a secção Administração", () => {
    renderSidebar("diretor");
    expect(screen.queryByText("Administração")).not.toBeInTheDocument();
  });

  it("fiscal NÃO vê a secção Administração", () => {
    renderSidebar("fiscal");
    expect(screen.queryByText("Administração")).not.toBeInTheDocument();
  });

  it("supervisor NÃO vê a secção Administração", () => {
    renderSidebar("supervisor");
    expect(screen.queryByText("Administração")).not.toBeInTheDocument();
  });

  it("admin_fiskix vê Utilizadores e Configuração (superAdminOnly)", () => {
    renderSidebar("admin_fiskix");
    expect(screen.getAllByText("Utilizadores").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Configuração").length).toBeGreaterThan(0);
  });

  it("gestor_perdas NÃO vê Utilizadores nem Configuração", () => {
    renderSidebar("gestor_perdas");
    expect(screen.queryByText("Utilizadores")).not.toBeInTheDocument();
    expect(screen.queryByText("Configuração")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("Sidebar — Relatórios (visibilidade por role)", () => {
  it("admin_fiskix vê Relatórios", () => {
    renderSidebar("admin_fiskix");
    expect(screen.getAllByText("Relatórios").length).toBeGreaterThan(0);
  });

  it("diretor vê Relatórios", () => {
    renderSidebar("diretor");
    expect(screen.getAllByText("Relatórios").length).toBeGreaterThan(0);
  });

  it("gestor_perdas vê Relatórios", () => {
    renderSidebar("gestor_perdas");
    expect(screen.getAllByText("Relatórios").length).toBeGreaterThan(0);
  });

  it("fiscal NÃO vê Relatórios", () => {
    renderSidebar("fiscal");
    expect(screen.queryByText("Relatórios")).not.toBeInTheDocument();
  });

  it("supervisor NÃO vê Relatórios", () => {
    renderSidebar("supervisor");
    expect(screen.queryByText("Relatórios")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("Sidebar — Collapse com localStorage", () => {
  it("inicia expandida por omissão (sem localStorage)", () => {
    const { aside } = renderSidebar("gestor_perdas");
    expect(aside.className).toContain("w-60");
  });

  it("lê o estado collapsed do localStorage na montagem", () => {
    localStorage.setItem("sidebar-collapsed", "true");
    const { aside } = renderSidebar("gestor_perdas");
    expect(aside.className).toContain("w-16");
  });

  it("ao clicar no botão de recolher, persiste 'true' no localStorage", () => {
    const { aside } = renderSidebar("gestor_perdas");
    // within(aside) garante que apanhamos apenas o botão do desktop
    const collapseBtn = within(aside).getByTitle("Recolher menu");
    fireEvent.click(collapseBtn);
    expect(localStorage.getItem("sidebar-collapsed")).toBe("true");
  });
});
