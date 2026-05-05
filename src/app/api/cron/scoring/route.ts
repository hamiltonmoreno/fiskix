import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/observability/logger";
import { runPool } from "@/lib/concurrency";
import { verifyCronAuth } from "@/lib/security/cron-auth";

/**
 * Cron route: executa o motor de scoring para todas as subestações ativas.
 * Chamado automaticamente no dia 1 de cada mês às 02:00 UTC (via Vercel Cron).
 *
 * Protegido por CRON_SECRET — Vercel injeta o header Authorization automaticamente.
 *
 * Executa as subestações em paralelo com pool limitado (CONCURRENCY_LIMIT) para
 * evitar timeout do Vercel Cron: ceil(N/C) × timeout_por_sub em vez de N × timeout.
 * Exemplo: 20 subestações, C=5 → 4 rondas × 20s = ~80s em vez de 400s sequencial.
 */

const SCORING_ENGINE_TIMEOUT_MS = 20000;
const SCORING_ENGINE_MAX_ATTEMPTS = 3;
const CONCURRENCY_LIMIT = 5;

function withRequestId(body: unknown, status: number, requestId: string) {
  return NextResponse.json(body, {
    status,
    headers: { "x-request-id": requestId },
  });
}

async function invokeScoringEngineWithRetry(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  subestacaoId: string;
  mesAno: string;
  requestId: string;
}) {
  const { supabaseUrl, serviceRoleKey, subestacaoId, mesAno, requestId } = params;
  const log = logger({ request_id: requestId, subestacao_id: subestacaoId, mes_ano: mesAno });

  let lastError = "Unknown error";

  for (let attempt = 1; attempt <= SCORING_ENGINE_MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SCORING_ENGINE_TIMEOUT_MS);

      const response = await fetch(`${supabaseUrl}/functions/v1/scoring-engine`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
          "x-request-id": requestId,
        },
        body: JSON.stringify({ subestacao_id: subestacaoId, mes_ano: mesAno }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const payload = await response
        .json()
        .catch(() => ({ error: `Resposta inválida (HTTP ${response.status})` }));

      if (!response.ok) {
        lastError = String(payload?.error ?? `HTTP ${response.status}`);
        log.warn("cron.scoring_engine.http_error", {
          attempt,
          http_status: response.status,
          error: lastError,
        });
      } else {
        return payload;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Erro desconhecido";
      log.warn("cron.scoring_engine.exception", { attempt, error: lastError });
    }

    if (attempt < SCORING_ENGINE_MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }

  return { error: `Falha após ${SCORING_ENGINE_MAX_ATTEMPTS} tentativas: ${lastError}` };
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const log = logger({ request_id: requestId, route: "/api/cron/scoring" });
  const startedAt = Date.now();

  const cronSecret = process.env.CRON_SECRET;
  const authResult = verifyCronAuth(request, cronSecret);
  if (!authResult.ok) {
    if (authResult.reason === "missing_secret") {
      log.error("cron.config_missing", { missing: "CRON_SECRET" });
      return withRequestId(
        { error: "CRON_SECRET não configurado" },
        500,
        requestId
      );
    }
    log.warn("cron.scoring.unauthorized", {
      reason: authResult.reason,
      user_agent: request.headers.get("user-agent") ?? null,
    });
    return withRequestId({ error: "Unauthorized" }, authResult.status, requestId);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    log.error("cron.config_missing", { missing: "NEXT_PUBLIC_SUPABASE_URL" });
    return withRequestId(
      { error: "NEXT_PUBLIC_SUPABASE_URL não configurada" },
      500,
      requestId
    );
  }

  if (!serviceRoleKey) {
    log.error("cron.config_missing", { missing: "SUPABASE_SERVICE_ROLE_KEY" });
    return withRequestId(
      { error: "SUPABASE_SERVICE_ROLE_KEY não configurada" },
      500,
      requestId
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Calcular mês a ser processado (o mês que acabou de terminar)
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const mesAno = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  // Obter todas as subestações ativas
  const { data: subestacoes, error: subError } = await supabase
    .from("subestacoes")
    .select("id, nome")
    .eq("ativo", true);

  if (subError || !subestacoes) {
    log.error("cron.subestacoes_query_failed", { detail: subError?.message });
    return withRequestId(
      { error: "Erro ao obter subestações", detail: subError?.message },
      500,
      requestId
    );
  }

  // Chamar scoring-engine para cada subestação em paralelo (pool limitado)
  const resultados = await runPool(
    subestacoes,
    CONCURRENCY_LIMIT,
    async (sub) => {
      const data = await invokeScoringEngineWithRetry({
        supabaseUrl,
        serviceRoleKey,
        subestacaoId: sub.id,
        mesAno,
        requestId,
      });

      return {
        subestacao_id: sub.id,
        nome: sub.nome,
        alertas_gerados: data.alertas_gerados ?? 0,
        perda_pct: data.perda_pct as string | undefined,
        error: data.error as string | undefined,
      };
    }
  );

  const totalAlertas = resultados.reduce((s, r) => s + (r.alertas_gerados ?? 0), 0);
  const erros = resultados.filter((r) => r.error);

  log.info("cron.completed", {
    mes_ano: mesAno,
    subestacoes_processadas: subestacoes.length,
    total_alertas_gerados: totalAlertas,
    erros: erros.length,
    duration_ms: Date.now() - startedAt,
  });

  return withRequestId(
    {
      request_id: requestId,
      mes_ano: mesAno,
      subestacoes_processadas: subestacoes.length,
      total_alertas_gerados: totalAlertas,
      erros: erros.length,
      resultados,
    },
    200,
    requestId
  );
}
