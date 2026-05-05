/**
 * Zod schemas para `/api/v1/` — Fiskix
 *
 * Validação nas fronteiras do sistema (regra `.claude/rules/api-conventions.md`).
 * Antes destes schemas: parse manual via `parseInt`/regex; produzia NaN
 * silencioso em inputs malformados.
 *
 * Padrão: cada endpoint expõe `<Endpoint>QuerySchema`. Usar `parseQuery()`
 * para extrair + validar; em falha retorna 400 estruturado via `apiError()`.
 */

import { z } from "zod";

// ─── Tipos partilhados ────────────────────────────────────────────────────────

const MesAnoSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "mes_ano deve ser YYYY-MM");

const UuidSchema = z.string().uuid("UUID inválido");

const PaginacaoSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ─── Schemas por endpoint ─────────────────────────────────────────────────────

export const AlertaStatusEnum = z.enum([
  "Pendente",
  "Notificado_SMS",
  "Pendente_Inspecao",
  "Inspecionado",
]);

export const AlertasQuerySchema = PaginacaoSchema.extend({
  mes_ano: MesAnoSchema.optional(),
  status: AlertaStatusEnum.optional(),
  min_score: z.coerce.number().int().min(0).max(100).optional(),
  subestacao_id: UuidSchema.optional(),
});

export const AlertaIdParamSchema = z.object({
  id: UuidSchema,
});

export const BalancoQuerySchema = z.object({
  mes_ano: MesAnoSchema,
  subestacao_id: UuidSchema.optional(),
});

export const PredicoesQuerySchema = PaginacaoSchema.extend({
  mes_ano: MesAnoSchema.optional(),
  min_score_ml: z.coerce.number().min(0).max(1).default(0),
});

// ─── Helper: parseQuery ───────────────────────────────────────────────────────

export type ParseError = { path: string; message: string };

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: ParseError[] };

function toErrors(issues: z.ZodIssue[]): ParseError[] {
  return issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

/**
 * Aplica schema a `URLSearchParams` e devolve resultado normalizado.
 * Usa `z.output<S>` para inferir o tipo *após* coerção/defaults aplicados —
 * crítico para schemas com `.default()` em que o input é optional mas o
 * output é always-defined.
 */
export function parseQuery<S extends z.ZodTypeAny>(
  schema: S,
  searchParams: URLSearchParams,
): ParseResult<z.output<S>> {
  const obj: Record<string, string> = {};
  for (const [k, v] of searchParams.entries()) obj[k] = v;

  const result = schema.safeParse(obj);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, errors: toErrors(result.error.issues) };
}

/** Igual a `parseQuery` mas para route params (`{ id: ... }`). */
export function parseParams<S extends z.ZodTypeAny>(
  schema: S,
  params: unknown,
): ParseResult<z.output<S>> {
  const result = schema.safeParse(params);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, errors: toErrors(result.error.issues) };
}
