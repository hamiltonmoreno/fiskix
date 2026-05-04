import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/observability/logger";
import { runPool } from "@/lib/concurrency";
import { calcularRMSE, type ParRMSE, type ResultadoRMSE } from "@/lib/ml/rmse";

/**
 * Cron route: executa o motor ML para todas as subestações ativas.
 * Chamado automaticamente no dia 2 de cada mês às 03:00 UTC (via Vercel Cron).
 * Corre APÓS o cron de scoring (dia 1 às 02:00 UTC), que gera os alertas.
 *
 * Protegido por CRON_SECRET.
 */

const ML_SCORING_TIMEOUT_MS = 30000;
const ML_SCORING_MAX_ATTEMPTS = 2;
const CONCURRENCY_LIMIT = 5;

function withRequestId(body: unknown, status: number, requestId: string) {
  return NextResponse.json(body, { status, headers: { "x-request-id": requestId } });
}

async function invokeMLScoringWithRetry(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  subestacaoId: string;
  mesAno: string;
  requestId: string;
}) {
  const { supabaseUrl, serviceRoleKey, subestacaoId, mesAno, requestId } = params;
  const log = logger({ request_id: requestId, subestacao_id: subestacaoId, mes_ano: mesAno });

  let lastError = "Unknown error";

  for (let attempt = 1; attempt <= ML_SCORING_MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ML_SCORING_TIMEOUT_MS);

      const response = await fetch(`${supabaseUrl}/functions/v1/ml-scoring`, {
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

      const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));

      if (!response.ok) {
        lastError = String(payload?.error ?? `HTTP ${response.status}`);
        log.warn("cron.ml_scoring.http_error", { attempt, http_status: response.status, error: lastError });
      } else {
        return payload;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Erro desconhecido";
      log.warn("cron.ml_scoring.exception", { attempt, error: lastError });
    }

    if (attempt < ML_SCORING_MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }

  return { error: `Falha após ${ML_SCORING_MAX_ATTEMPTS} tentativas: ${lastError}` };
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const log = logger({ request_id: requestId, route: "/api/cron/ml" });
  const startedAt = Date.now();

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    log.error("cron.config_missing", { missing: "CRON_SECRET" });
    return withRequestId({ error: "CRON_SECRET não configurado" }, 500, requestId);
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    log.warn("cron.ml.unauthorized");
    return withRequestId({ error: "Unauthorized" }, 401, requestId);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    log.error("cron.config_missing", { missing: "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY" });
    return withRequestId({ error: "Variáveis de ambiente em falta" }, 500, requestId);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Mês a processar: o que acabou de terminar (dia 2 → mês anterior)
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const mesAno = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const { data: subestacoes, error: subError } = await supabase
    .from("subestacoes")
    .select("id, nome")
    .eq("ativo", true);

  if (subError || !subestacoes) {
    log.error("cron.ml.subestacoes_query_failed", { detail: subError?.message });
    return withRequestId({ error: "Erro ao obter subestações" }, 500, requestId);
  }

  const resultados = await runPool(
    subestacoes,
    CONCURRENCY_LIMIT,
    async (sub) => {
      const data = await invokeMLScoringWithRetry({
        supabaseUrl,
        serviceRoleKey,
        subestacaoId: sub.id,
        mesAno,
        requestId,
      });
      return {
        subestacao_id: sub.id,
        nome: sub.nome,
        scored: data.scored ?? 0,
        error: data.error as string | undefined,
      };
    }
  );

  const totalScored = resultados.reduce((s, r) => s + (r.scored ?? 0), 0);
  const erros = resultados.filter((r) => r.error);

  let rmseResult: ResultadoRMSE | null = null;
  let rmseError: string | undefined;

  try {
    const { data: predicoes } = await supabase
      .from("ml_predicoes")
      .select("id_cliente, score_ml")
      .eq("mes_ano", mesAno)
      .eq("modelo_versao", "heuristic_v1");

    const { data: relatorios } = await supabase
      .from("relatorios_inspecao")
      .select("resultado, alertas_fraude!inner(id_cliente, mes_ano)")
      .eq("alertas_fraude.mes_ano", mesAno);

    const { data: alertasResolvidos } = await supabase
      .from("alertas_fraude")
      .select("id_cliente, resultado")
      .eq("mes_ano", mesAno)
      .not("resultado", "in", '("Pendente","Pendente_Inspecao")');

    const POSITIVO = new Set(["Fraude_Confirmada", "Anomalia_Tecnica"]);
    const NEGATIVO = new Set(["Sem_Anomalia", "Falso_Positivo"]);

    const groundTruth = new Map<string, 0 | 1>();

    for (const alerta of alertasResolvidos ?? []) {
      if (POSITIVO.has(alerta.resultado)) groundTruth.set(alerta.id_cliente, 1);
      else if (NEGATIVO.has(alerta.resultado)) groundTruth.set(alerta.id_cliente, 0);
    }

    for (const rel of relatorios ?? []) {
      const af = rel.alertas_fraude as unknown as { id_cliente: string; mes_ano: string };
      if (POSITIVO.has(rel.resultado)) groundTruth.set(af.id_cliente, 1);
      else if (NEGATIVO.has(rel.resultado)) groundTruth.set(af.id_cliente, 0);
    }

    const pares: ParRMSE[] = [];
    for (const pred of predicoes ?? []) {
      const yTrue = groundTruth.get(pred.id_cliente);
      if (yTrue !== undefined) {
        pares.push({ score_ml: pred.score_ml, y_true: yTrue });
      }
    }

    rmseResult = calcularRMSE(pares);

    const { data: configRow } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "ml_rmse_historico")
      .single();

    const historico: Array<{ mes_ano: string; rmse: number | null; n_amostras: number; nota?: string }> =
      configRow?.valor ? JSON.parse(configRow.valor) : [];

    const idx = historico.findIndex((h) => h.mes_ano === mesAno);
    const entry = {
      mes_ano: mesAno,
      rmse: rmseResult.rmse,
      n_amostras: rmseResult.n_amostras,
      ...(rmseResult.nota ? { nota: rmseResult.nota } : {}),
    };
    if (idx >= 0) historico[idx] = entry;
    else historico.push(entry);

    await supabase
      .from("configuracoes")
      .upsert({ chave: "ml_rmse_historico", valor: JSON.stringify(historico) }, { onConflict: "chave" });
  } catch (err) {
    rmseError = err instanceof Error ? err.message : String(err);
    log.warn("cron.ml.rmse_failed", { error: rmseError });
  }

  log.info("cron.ml.completed", {
    mes_ano: mesAno,
    subestacoes_processadas: subestacoes.length,
    total_scored: totalScored,
    erros: erros.length,
    rmse: rmseResult?.rmse ?? null,
    duration_ms: Date.now() - startedAt,
  });

  return withRequestId(
    {
      request_id: requestId,
      mes_ano: mesAno,
      subestacoes_processadas: subestacoes.length,
      total_scored: totalScored,
      erros: erros.length,
      resultados,
      rmse: rmseResult ?? null,
      ...(rmseError ? { rmse_error: rmseError } : {}),
    },
    200,
    requestId
  );
}
