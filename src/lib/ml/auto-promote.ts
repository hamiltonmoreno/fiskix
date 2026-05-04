/**
 * ML Model Auto-Promotion — Fiskix
 *
 * Função pura que decide se promover ou não `ml_modelo_ativo` de `heuristic_v1`
 * para `logistic_v1`, sem dependência directa do cliente Supabase. Recebe
 * funções de leitura/escrita injectadas para fácil teste.
 *
 * Promove apenas quando TODAS as condições se verificam:
 *   1. Modelo activo é `heuristic_v1` (idempotente — não re-promove)
 *   2. `ml_pesos_v1_logistic` existe E é uma estrutura válida com TODOS os 7
 *      keys requeridos (PESOS_LOGISTIC_REQUIRED_KEYS) como números finitos.
 *      Pesos vazios ou parciais (`{}` ou `{queda_pct: "x"}`) seriam aceites
 *      como "JSON válido" mas produziriam NaN no scoring → upserts falham →
 *      ML pára de pontuar até alguém intervir manualmente.
 *   3. Nº de inspeções confirmadas >= threshold configurável (default 100)
 *
 * Confirmadas = `Fraude_Confirmada` ∪ `Anomalia_Tecnica` (Falso_Positivo NÃO conta).
 */

/** Keys obrigatórios em `ml_pesos_v1_logistic`. Devem corresponder a PesosML
 *  em `supabase/functions/ml-scoring/index.ts` — drift entre os dois é bug
 *  silencioso (logistic seria ignorado e fallback heurístico seria usado).
 *  Não há ligação directa de tipos porque ml-scoring é Deno. */
export const PESOS_LOGISTIC_REQUIRED_KEYS = [
  "queda_pct",
  "cv",
  "zscore",
  "slope",
  "ratio_pico",
  "alertas_12m",
  "perda_zona",
] as const;

export type AutoPromoteOutcome =
  | { promoted: true; from: "heuristic_v1"; to: "logistic_v1"; inspecoes: number; threshold: number }
  | { promoted: false; reason: "already_logistic" }
  | { promoted: false; reason: "no_logistic_weights" }
  | { promoted: false; reason: "invalid_logistic_weights"; missing: string[]; non_finite: string[] }
  | { promoted: false; reason: "below_threshold"; inspecoes: number; threshold: number }
  | { promoted: false; reason: "error"; error: string };

export interface AutoPromoteDeps {
  /** Lê uma chave de configuracoes; null se não existe. */
  readConfig: (chave: string) => Promise<string | null>;
  /** Conta inspeções confirmadas (lifetime). */
  countInspecoesConfirmadas: () => Promise<number>;
  /** Atualiza/insere configuracoes.ml_modelo_ativo. */
  writeModeloAtivo: (valor: "heuristic_v1" | "logistic_v1") => Promise<void>;
}

const DEFAULT_THRESHOLD = 100;

/** Resultado da validação dos pesos logistic. Discrimina entre "não existem"
 *  (no-op silencioso) e "existem mas estão partidos" (precisa de atenção). */
type PesosValidationResult =
  | { ok: true }
  | { ok: false; reason: "missing" }
  | { ok: false; reason: "malformed" }
  | { ok: false; reason: "incomplete"; missing: string[]; non_finite: string[] };

function validatePesosLogistic(raw: string | null): PesosValidationResult {
  if (!raw || raw.trim() === "") {
    return { ok: false, reason: "missing" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: "malformed" };
  }

  const obj = parsed as Record<string, unknown>;
  const missing: string[] = [];
  const non_finite: string[] = [];

  for (const key of PESOS_LOGISTIC_REQUIRED_KEYS) {
    if (!(key in obj)) {
      missing.push(key);
      continue;
    }
    const v = obj[key];
    // Aceitar apenas finitos. NaN, Infinity, strings, null, etc. → reject.
    if (typeof v !== "number" || !Number.isFinite(v)) {
      non_finite.push(key);
    }
  }

  if (missing.length > 0 || non_finite.length > 0) {
    return { ok: false, reason: "incomplete", missing, non_finite };
  }

  return { ok: true };
}

export async function attemptAutoPromote(deps: AutoPromoteDeps): Promise<AutoPromoteOutcome> {
  try {
    const modeloAtivo = (await deps.readConfig("ml_modelo_ativo")) ?? "heuristic_v1";
    if (modeloAtivo !== "heuristic_v1") {
      return { promoted: false, reason: "already_logistic" };
    }

    const pesosLogisticRaw = await deps.readConfig("ml_pesos_v1_logistic");
    const validation = validatePesosLogistic(pesosLogisticRaw);

    if (!validation.ok) {
      if (validation.reason === "incomplete") {
        return {
          promoted: false,
          reason: "invalid_logistic_weights",
          missing: validation.missing,
          non_finite: validation.non_finite,
        };
      }
      // missing OR malformed → tratar como "ainda sem pesos treinados"
      return { promoted: false, reason: "no_logistic_weights" };
    }

    const thresholdRaw = await deps.readConfig("ml_inspecoes_promote_threshold");
    const threshold = thresholdRaw ? parseInt(thresholdRaw, 10) : DEFAULT_THRESHOLD;
    const thresholdFinal = Number.isFinite(threshold) && threshold > 0 ? threshold : DEFAULT_THRESHOLD;

    const inspecoes = await deps.countInspecoesConfirmadas();
    if (inspecoes < thresholdFinal) {
      return { promoted: false, reason: "below_threshold", inspecoes, threshold: thresholdFinal };
    }

    await deps.writeModeloAtivo("logistic_v1");

    return {
      promoted: true,
      from: "heuristic_v1",
      to: "logistic_v1",
      inspecoes,
      threshold: thresholdFinal,
    };
  } catch (err) {
    return {
      promoted: false,
      reason: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
