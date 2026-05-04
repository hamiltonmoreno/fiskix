import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginForm } from "@/modules/auth/components/LoginForm";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockSignIn = vi.fn();
const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("@/modules/auth/hooks/useAuth", () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o formulário com campos de email e password", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });

  it("exibe mensagem de erro quando credenciais são inválidas", async () => {
    mockSignIn.mockResolvedValue({ error: { message: "Invalid credentials" } });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "wrong@test.cv" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "badpass" } });
    fireEvent.submit(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByText(/email ou password incorretos/i)).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("redireciona para /dashboard quando login tem sucesso", async () => {
    mockSignIn.mockResolvedValue({ error: null });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "gestor@electra.cv" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret123" } });
    fireEvent.submit(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("desabilita o botão e mostra 'A entrar...' durante o carregamento", async () => {
    // signIn demora para resolver
    mockSignIn.mockImplementation(() => new Promise((r) => setTimeout(() => r({ error: null }), 500)));

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.cv" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pass" } });
    fireEvent.submit(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /a entrar/i })).toBeDisabled();
    });
  });

  it("não exibe mensagem de erro no estado inicial", () => {
    render(<LoginForm />);
    expect(screen.queryByText(/email ou password/i)).not.toBeInTheDocument();
  });

  it("limpa o erro anterior ao fazer nova tentativa de login", async () => {
    // Primeira tentativa falhada
    mockSignIn.mockResolvedValueOnce({ error: { message: "fail" } });
    // Segunda tentativa bem-sucedida
    mockSignIn.mockResolvedValueOnce({ error: null });

    render(<LoginForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const btn = screen.getByRole("button", { name: /entrar/i });

    fireEvent.change(emailInput, { target: { value: "a@b.cv" } });
    fireEvent.change(passwordInput, { target: { value: "wrong" } });
    fireEvent.submit(btn);

    await waitFor(() => expect(screen.getByText(/email ou password incorretos/i)).toBeInTheDocument());

    fireEvent.submit(btn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });
});
