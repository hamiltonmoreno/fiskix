/**
 * CORS allowlist — Fiskix /api/v1/
 *
 * As origins permitidas vivem em `configuracoes.api_v1_allowed_origins`
 * (CSV). Mudar a allowlist sem deploy via /admin/configuracao.
 *
 * Vazio → wildcard `*` (compat retroativa para PoC server-to-server).
 * Caso contrário, echo do `Origin` se estiver na lista, senão null
 * (browser bloqueia cross-site).
 *
 * Cache em memória 5 min para evitar hit DB por request.
 */

import { createClient } from "@supabase/supabase-js";

const CACHE_TTL_MS = 5 * 60 * 1000;
// null em origins = DB falhou e não há cache anterior (fail-closed)
// []   em origins = allowlist vazia intencionalmente (wildcard "*", compat PoC)
let _cache: { origins: string[] | null; expiresAt: number } | null = null;

async function loadAllowedOrigins(): Promise<string[] | null> {
  if (_cache && Date.now() < _cache.expiresAt) return _cache.origins;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    _cache = { origins: [], expiresAt: Date.now() + CACHE_TTL_MS };
    return [];
  }

  try {
    const supabase = createClient(url, key);
    const { data } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "api_v1_allowed_origins")
      .maybeSingle();

    const csv = (data?.valor ?? "").trim();
    const origins = csv
      ? csv
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];

    _cache = { origins, expiresAt: Date.now() + CACHE_TTL_MS };
    return origins;
  } catch {
    // DB inacessível — usar cache anterior; se não há cache anterior, fail-closed (null)
    // TTL curto em falha para re-tentar DB rapidamente após recuperação
    const fallback = _cache?.origins ?? null;
    _cache = { origins: fallback, expiresAt: Date.now() + CACHE_TTL_MS / 5 };
    return fallback;
  }
}

/** Apenas para testes — limpa o cache forçando re-load. */
export function _resetCorsCacheForTests(): void {
  _cache = null;
}

/**
 * Resolve o valor de `Access-Control-Allow-Origin` para o request:
 *   - allowlist vazia ⇒ "*"
 *   - origin presente na allowlist ⇒ echo do origin
 *   - senão ⇒ null
 */
export async function resolveAllowOrigin(request: Request): Promise<string | null> {
  const origins = await loadAllowedOrigins();
  if (origins === null) return null; // DB falhou e sem cache — fail-closed
  if (origins.length === 0) return "*"; // sem config → wildcard (PoC compat)
  const origin = request.headers.get("origin");
  if (!origin) return null;
  return origins.includes(origin) ? origin : null;
}

/** Constrói os headers CORS apropriados para este request. */
export async function corsHeadersFor(request: Request): Promise<Record<string, string>> {
  const allow = await resolveAllowOrigin(request);
  return {
    ...(allow ? { "Access-Control-Allow-Origin": allow, Vary: "Origin" } : {}),
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Cache-Control": "no-store",
  };
}
