/**
 * CORS helper compartilhado para Edge Functions — Fiskix
 *
 * Replica o pattern de `src/lib/api/cors.ts`: lê a allowlist em
 * `configuracoes.api_v1_allowed_origins` (CSV) e filtra o `Origin` do
 * request. Allowlist vazia ou ausente → wildcard `*` (compat retroativa
 * para tooling Server-to-Server e desenvolvimento).
 *
 * Edge functions são tipicamente chamadas server-to-server (Origin vazio),
 * mas algumas (ingest-data) também por browser de admin → CORS real importa.
 *
 * Compatibilidade: Deno + Supabase Edge runtime.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const STATIC_HEADERS_BASE = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Cache da allowlist em memória do worker (TTL 5 min). Reduz hits a
// configuracoes em chamadas concorrentes.
let cachedAllowlist: string[] | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadAllowlist(): Promise<string[]> {
  const now = Date.now();
  if (cachedAllowlist && now - cachedAt < CACHE_TTL_MS) {
    return cachedAllowlist;
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    cachedAllowlist = [];
    cachedAt = now;
    return [];
  }

  const supabase: SupabaseClient = createClient(url, key);
  const { data } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "api_v1_allowed_origins")
    .maybeSingle();

  const csv = data?.valor ?? "";
  const list = csv
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);

  cachedAllowlist = list;
  cachedAt = now;
  return list;
}

/** Headers CORS para o request, filtrados pela allowlist. */
export async function corsHeadersFor(req: Request): Promise<Record<string, string>> {
  const origin = req.headers.get("origin") ?? "";
  let allowOrigin = "*";

  try {
    const allowlist = await loadAllowlist();
    if (allowlist.length > 0) {
      // Modo restrito: só permite origins na lista; senão devolve "null"
      // (que browsers tratam como CORS bloqueado).
      allowOrigin = allowlist.includes(origin) ? origin : "null";
    }
  } catch {
    // Falha a ler configuracoes (DB down, permissões) → fail-open com "*".
    // Edge runtime tem isolamento — preferível responder do que crashar.
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    ...STATIC_HEADERS_BASE,
  };
}

/** Resposta 204 para preflight OPTIONS. */
export async function corsPreflight(req: Request): Promise<Response> {
  const headers = await corsHeadersFor(req);
  return new Response("ok", { headers });
}

/** Apenas para testes — limpa a cache. */
export function _resetCorsCacheForTests(): void {
  cachedAllowlist = null;
  cachedAt = 0;
}
