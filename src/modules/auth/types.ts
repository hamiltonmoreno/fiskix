import type { UserRole } from "@/types/database";

export interface Profile {
  id: string;
  role: UserRole;
  id_zona: string | null;
  nome_completo: string;
  ativo: boolean;
}

export interface AuthState {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  loading: boolean;
}
