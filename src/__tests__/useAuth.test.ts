import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAuth } from "@/modules/auth/hooks/useAuth";

// ── Controlo dos mocks ─────────────────────────────────────────────────────────
const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();
const mockUnsubscribe = vi.fn();

// Callback guardada para simular mudanças de sessão
let authChangeCallback: ((event: string, session: unknown) => void) | null = null;

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }),
  }),
}));

const mockProfile = {
  id: "user-123",
  nome: "Ana Fiscal",
  email: "ana@electra.cv",
  role: "fiscal",
};

describe("useAuth.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authChangeCallback = null;
  });

  it("começa com loading: true e profile: null", () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { result } = renderHook(() => useAuth());

    // Estado inicial antes de qualquer resolução
    expect(result.current.loading).toBe(true);
    expect(result.current.profile).toBeNull();
  });

  it("retorna profile: null quando não há user autenticado", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toBeNull();
  });

  it("carrega e devolve o perfil quando há user autenticado", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "ana@electra.cv" } },
    });
    mockSingle.mockResolvedValue({ data: mockProfile, error: null });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toEqual(mockProfile);
    expect(result.current.profile?.nome).toBe("Ana Fiscal");
    expect(result.current.profile?.role).toBe("fiscal");
  });

  it("chama signInWithPassword com as credenciais corretas", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockSignInWithPassword.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const res = await result.current.signIn("ana@electra.cv", "senha123");
      expect(res.error).toBeNull();
    });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "ana@electra.cv",
      password: "senha123",
    });
  });

  it("chama signInWithPassword e propaga erros de credenciais inválidas", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const mockError = { message: "Invalid login credentials" };
    mockSignInWithPassword.mockResolvedValue({ error: mockError });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const res = await result.current.signIn("errado@email.cv", "errada");
      expect(res.error).toEqual(mockError);
    });
  });

  it("chama signOut corretamente", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockSignOut.mockResolvedValue({});

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it("limpa o perfil quando a sessão expira (onAuthStateChange sem session)", async () => {
    // Começa com user autenticado
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    });
    mockSingle.mockResolvedValue({ data: mockProfile, error: null });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.profile).toEqual(mockProfile);
    });

    // Simular expiração de sessão
    await act(async () => {
      authChangeCallback?.("SIGNED_OUT", null);
    });

    expect(result.current.profile).toBeNull();
  });

  it("cancela a subscription ao ser desmontado (cleanup)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { unmount } = renderHook(() => useAuth());
    await waitFor(() => {}); // aguarda mount

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });
});
