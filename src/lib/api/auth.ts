import { createClient } from "@supabase/supabase-js";

/**
 * Verifica se o request tem uma API key válida.
 * As chaves são guardadas em configuracoes com prefixo "api_key_".
 *
 * Header esperado: Authorization: Bearer <key>
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

  const { data, error } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .like("chave", "api_key_%");

  if (error || !data) return null;

  const match = data.find((row) => row.valor === key);
  if (!match) return null;

  // Retorna o nome do cliente (ex: "api_key_electra" → "electra")
  return match.chave.replace("api_key_", "");
}
