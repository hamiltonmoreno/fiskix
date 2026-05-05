/**
 * Logger estruturado — Fiskix
 *
 * API estável (`logger().info/warn/error`) baseada em transports plugáveis.
 * Por defeito escreve em stdout/stderr via console (Vercel coleta).
 *
 * Para enviar para Sentry/Datadog/etc., registar transport adicional num
 * arranque server (root layout / instrumentation.ts):
 *
 *     import { registerLogTransport } from "@/lib/observability/logger";
 *     import { sentryTransport } from "@/lib/observability/sentry-transport";
 *     if (process.env.NEXT_PUBLIC_SENTRY_DSN) registerLogTransport(sentryTransport);
 *
 * A API de transport é minimalista para evitar lock-in.
 */

export type LogLevel = "info" | "warn" | "error";
export type LogPayload = Record<string, unknown>;

export interface LogRecord {
  level: LogLevel;
  event: string;
  ts: string;
  payload: LogPayload;
}

export type LogTransport = (record: LogRecord) => void;

// ─── Console transport (default) ──────────────────────────────────────────────

const consoleTransport: LogTransport = (record) => {
  const line = JSON.stringify({
    level: record.level,
    event: record.event,
    ts: record.ts,
    ...record.payload,
  });
  if (record.level === "error") {
    console.error(line);
  } else if (record.level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
};

const transports: LogTransport[] = [consoleTransport];

/**
 * Regista um transport adicional. Chamadas ao logger fazem broadcast a todos
 * os transports registados. Erros num transport são isolados (não bloqueiam
 * outros transports).
 */
export function registerLogTransport(transport: LogTransport): void {
  transports.push(transport);
}

/** Apenas para testes — limpa transports e devolve só o default. */
export function _resetLogTransportsForTests(): void {
  transports.length = 0;
  transports.push(consoleTransport);
}

// ─── Public API ───────────────────────────────────────────────────────────────

function emit(level: LogLevel, event: string, payload: LogPayload = {}): void {
  const record: LogRecord = {
    level,
    event,
    ts: new Date().toISOString(),
    payload,
  };
  for (const transport of transports) {
    try {
      transport(record);
    } catch {
      // Um transport não pode partir a app — falhas silenciosas. Reportamos
      // apenas via console.error directo para evitar loop recursivo.
      // eslint-disable-next-line no-console
      console.error("[logger] transport falhou", { event });
    }
  }
}

export function logger(context: LogPayload = {}) {
  return {
    info: (event: string, payload: LogPayload = {}) =>
      emit("info", event, { ...context, ...payload }),
    warn: (event: string, payload: LogPayload = {}) =>
      emit("warn", event, { ...context, ...payload }),
    error: (event: string, payload: LogPayload = {}) =>
      emit("error", event, { ...context, ...payload }),
  };
}
