/**
 * Helpers de cast para queries Supabase — Fiskix
 *
 * O TS gen do Supabase não infere bem os tipos quando:
 *   - O `select()` recebe uma string dinâmica (condicional por filtro)
 *   - Há joins com `!inner` e o gen produz `Array<X> | X | null` ambíguo
 *
 * Estes helpers documentam explicitamente o cast e centralizam o pattern,
 * permitindo no futuro inserir validação runtime (Zod, etc.) num ponto.
 *
 * **NÃO oferece type safety** — é um ponto de entrada nomeado para asserções
 * explícitas. Use só quando o select é dinâmico ou o gen falha.
 */

/** Cast de array Supabase quando o select é dinâmico/condicional. */
export function castRows<T>(rows: readonly unknown[] | null | undefined): T[] {
  return (rows ?? []) as unknown as T[];
}

/**
 * Normaliza um campo de join Supabase. Quando `!inner` é usado em FK 1:1, o
 * gen pode tipar como `Array<X> | X | null`. Este helper extrai o objeto
 * único (primeiro do array ou o próprio objeto) ou retorna null.
 */
export function joinedRow<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}
