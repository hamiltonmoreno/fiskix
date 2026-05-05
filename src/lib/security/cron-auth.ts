/**
 * Verificação de auth de cron routes (Vercel Cron) — Fiskix.
 *
 * Defesas combinadas:
 *
 * 1. **Timing-safe `Authorization: Bearer ${CRON_SECRET}`** (A1):
 *    `===` é early-exit; usamos constantTimeEqual para evitar leak.
 *
 * 2. **User-agent check** (A4): Vercel Cron envia `vercel-cron/1.0` no UA.
 *    Em produção, exigimos esse prefixo OU header `x-vercel-cron: 1`.
 *    Em dev/test, aceitamos qualquer UA (para curl manual).
 *    Defence-in-depth: se CRON_SECRET vazar, atacante externo não consegue
 *    forjar UA Vercel (Vercel strips/normalizes incoming UA headers de
 *    requests externos).
 */

import { constantTimeEqual } from "./constant-time";

export type CronAuthResult =
  | { ok: true }
  | { ok: false; reason: "missing_secret" | "unauthorized" | "invalid_caller"; status: number };

/** Verifica auth de cron. Retorna OK ou estrutura com motivo + HTTP status. */
export function verifyCronAuth(request: Request, cronSecret: string | undefined): CronAuthResult {
  if (!cronSecret) {
    return { ok: false, reason: "missing_secret", status: 500 };
  }

  // A1: timing-safe Authorization header check
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;
  if (!constantTimeEqual(authHeader, expected)) {
    return { ok: false, reason: "unauthorized", status: 401 };
  }

  // A4: user-agent check (defence-in-depth)
  // Skip em dev/test para permitir curl manual
  if (process.env.NODE_ENV === "production") {
    const userAgent = request.headers.get("user-agent") ?? "";
    const vercelCronHeader = request.headers.get("x-vercel-cron") ?? "";
    const isVercelCron =
      userAgent.startsWith("vercel-cron/") || vercelCronHeader === "1";
    if (!isVercelCron) {
      return { ok: false, reason: "invalid_caller", status: 401 };
    }
  }

  return { ok: true };
}
