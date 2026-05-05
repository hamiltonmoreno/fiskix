/**
 * Sentry transport para o logger Fiskix — placeholder.
 *
 * Para activar:
 *   1. `npm i @sentry/nextjs`
 *   2. `npx @sentry/wizard@latest -i nextjs` (configura DSN, source maps, etc.)
 *   3. Descomentar o bloco abaixo e adicionar `NEXT_PUBLIC_SENTRY_DSN` em env.
 *   4. Em `instrumentation.ts` ou no layout root:
 *
 *        import { registerLogTransport } from "@/lib/observability/logger";
 *        import { sentryTransport } from "@/lib/observability/sentry-transport";
 *        if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
 *          registerLogTransport(sentryTransport);
 *        }
 *
 * Este ficheiro é um stub para que a integração esteja preparada — não
 * adiciona dependência nem custo agora. Deletar este comentário após activar.
 */

import type { LogTransport } from "./logger";

export const sentryTransport: LogTransport = (record) => {
  // STUB — uncomment after `npm i @sentry/nextjs`:
  //
  // const Sentry = require("@sentry/nextjs");
  // if (record.level === "error") {
  //   Sentry.captureMessage(record.event, {
  //     level: "error",
  //     extra: record.payload,
  //     tags: { ts: record.ts },
  //   });
  // } else if (record.level === "warn") {
  //   Sentry.captureMessage(record.event, {
  //     level: "warning",
  //     extra: record.payload,
  //   });
  // }
  // // info: enviado apenas como breadcrumb (não evento)
  // Sentry.addBreadcrumb({
  //   message: record.event,
  //   level: record.level,
  //   data: record.payload,
  // });
  void record;
};
