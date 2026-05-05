import { createClient } from "@supabase/supabase-js";
import { sha256Hex } from "@/lib/security/constant-time";

/**
 * Verifica se o request tem uma API key válida.
 *
 * As chaves são guardadas em `configuracoes` com prefixo `api_key_`. Desde
 * a migration 017, o `valor` armazena o **hash SHA-256** da key (plaintext
 * fica só no cliente B2B). O servidor hasha o input e faz query indexed:
 *   - Se encontra row → key válida
 *   - Se não encontra → null
 *
 * Lookup é via índice na tabela; sem iteração em JS que possa expor timing.
 *
 * Header esperado: `Authorization: Bearer <key>`
 * Retorna o nome do cliente se válida, null se inválida.
 */
export async function verificarApiKey(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const key = authHeader.slice(7).trim();
  if (!key) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Hashar o input antes de qualquer DB call (consistente independentemente
  // da validade da key — sem early-exit baseado em conteúdo da key).
  const inputHash = await sha256Hex(key);

  // Aceita hash (preferido, post-migration 017) OU plaintext (legacy, pre-migration).
  // Transition window: enquanto não aplicarmos 017, valor em DB ainda é plaintext;
  // após apply, valor é hash. .in([hash, plaintext]) cobre ambos sem janela quebrada.
  // Após confirmação de migration aplicada, remover plaintext do `.in()`.
  const { data, error } = await supabase
    .from("configuracoes")
    .select("chave")
    .like("chave", "api_key_%")
    .in("valor", [inputHash, key])
    .maybeSingle();

  if (error || !data) return null;

  // Retorna o nome do cliente (ex: "api_key_electra" → "electra")
  return data.chave.replace("api_key_", "");
}
