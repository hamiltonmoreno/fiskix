/**
 * Testes do componente Breadcrumb (src/components/Breadcrumb.tsx)
 *
 * Cobre:
 * - Não renderiza na raiz "/"
 * - Rota simples (/dashboard) → 1 crumb + ícone Home
 * - Rota composta (/admin/scoring) → 2 crumbs
 * - Rota profunda (/mobile/abc-123/report) → crumbs correctos
 * - IDs desconhecidos são mostrados sem tradução (fallback = seg original)
 * - Último crumb não é um link (apenas texto)
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Breadcrumb } from "@/components/Breadcrumb";

// ── Mocks Next.js ──────────────────────────────────────────────────────────────
let mockPathname = "/dashboard";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// ═══════════════════════════════════════════════════════════════════════════════
describe("Breadcrumb — Renderização condicional", () => {
  it("não renderiza nada na raíz /", () => {
    mockPathname = "/";
    const { container } = render(<Breadcrumb />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza o nav quando há segmentos", () => {
    mockPathname = "/dashboard";
    render(<Breadcrumb />);
    expect(screen.getByRole("navigation", { name: /breadcrumb/i })).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("Breadcrumb — Rota simples (/dashboard)", () => {
  it("mostra ícone Home com link para /dashboard", () => {
    mockPathname = "/dashboard";
    render(<Breadcrumb />);
    const homeLink = screen.getByRole("link", { name: /início/i });
    expect(homeLink).toHaveAttribute("href", "/dashboard");
  });

  it("o último segmento 'Dashboard' é exibido como texto (não link)", () => {
    mockPathname = "/dashboard";
    render(<Breadcrumb />);
    // O span final não é um <a>
    const dashboardText = screen.getByText("Dashboard");
    expect(dashboardText.tagName.toLowerCase()).toBe("span");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("Breadcrumb — Rota composta (/admin/scoring)", () => {
  it("mostra 'Administração' como link intermédio", () => {
    mockPathname = "/admin/scoring";
    render(<Breadcrumb />);
    const adminLink = screen.getByRole("link", { name: "Administração" });
    expect(adminLink).toHaveAttribute("href", "/admin");
  });

  it("mostra 'Motor de Scoring' como último crumb (sem link)", () => {
    mockPathname = "/admin/scoring";
    render(<Breadcrumb />);
    const lastCrumb = screen.getByText("Motor de Scoring");
    expect(lastCrumb.tagName.toLowerCase()).toBe("span");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("Breadcrumb — Rota profunda (/admin/utilizadores)", () => {
  it("mostra todos os crumbs correctos", () => {
    mockPathname = "/admin/utilizadores";
    render(<Breadcrumb />);
    expect(screen.getByRole("link", { name: "Administração" })).toBeInTheDocument();
    expect(screen.getByText("Utilizadores")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("Breadcrumb — Rota mobile (/mobile/abc-123/report)", () => {
  it("mostra 'Mobile' → ID do alerta → 'Relatório'", () => {
    mockPathname = "/mobile/abc-123/report";
    render(<Breadcrumb />);
    // "Mobile" aparece como link (não é o último)
    expect(screen.getByRole("link", { name: "Mobile" })).toBeInTheDocument();
    // ID sem tradução é exibido como-está
    expect(screen.getByRole("link", { name: "abc-123" })).toBeInTheDocument();
    // "Relatório" é o último crumb (span)
    expect(screen.getByText("Relatório")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("Breadcrumb — Rota /alertas", () => {
  it("mostra 'Alertas' como último crumb", () => {
    mockPathname = "/alertas";
    render(<Breadcrumb />);
    const alertasText = screen.getByText("Alertas");
    expect(alertasText.tagName.toLowerCase()).toBe("span");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe("Breadcrumb — Rota /relatorios", () => {
  it("mostra 'Relatórios' como último crumb", () => {
    mockPathname = "/relatorios";
    render(<Breadcrumb />);
    expect(screen.getByText("Relatórios")).toBeInTheDocument();
  });
});
