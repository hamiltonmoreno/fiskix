/**
 * Cache-Control helpers para `/api/v1/` — Fiskix
 *
 * Estratégia: dados de **meses passados** são imutáveis após o mês fechar
 * (não há re-imports de faturação retroactiva). Aplicar `s-maxage` ao
 * Cloudflare/Vercel CDN reduz hits a Supabase em queries B2B repetidas.
 *
 * **Mês actual ou futuro**: `no-store` — pode haver imports parciais ou
 * re-runs de scoring no mês corrente, conteúdo muda.
 *
 * Source: https://nextjs.org/docs/app/guides/caching
 *         https://web.dev/articles/stale-while-revalidate
 */

/** YYYY-MM do mês corrente em UTC. */
function currentMesAno(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Header `Cache-Control` adequado a uma query parametrizada por mes_ano.
 *
 * - mes_ano ausente ou >= mês corrente → `no-store` (data live/parcial)
 * - mes_ano < mês corrente             → `public, s-maxage=300, stale-while-revalidate=60`
 *   (5 min CDN + revalida em background)
 */
export function cacheControlForMesAno(mesAno: string | undefined): string {
  if (!mesAno) return "no-store";
  if (mesAno >= currentMesAno()) return "no-store";
  return "public, s-maxage=300, stale-while-revalidate=60";
}
