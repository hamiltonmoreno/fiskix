/**
 * ML Model Auto-Promotion — Fiskix
 *
 * Função pura que decide se promover ou não `ml_modelo_ativo` de `heuristic_v1`
 * para `logistic_v1`, sem dependência directa do cliente Supabase. Recebe
 * funções de leitura/escrita injectadas para fácil teste.
 *
 * Promove apenas quando TODAS as condições se verificam:
 *   1. Modelo activo é `heuristic_v1` (idempotente — não re-promove)
 *   2. Pesos `ml_pesos_v1_logistic` existem em configuracoes (modelo treinado)
 *   3. Nº de inspeções confirmadas >= threshold configurável (default 100)
 *
 * Confirmadas = `Fraude_Confirmada` ∪ `Anomalia_Tecnica` (Falso_Positivo NÃO conta).
 */

export type AutoPromoteOutcome =
  | { promoted: true; from: "heuristic_v1"; to: "logistic_v1"; inspecoes: number; threshold: number }
  | { promoted: false; reason: "already_logistic" }
  | { promoted: false; reason: "no_logistic_weights" }
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

export async function attemptAutoPromote(deps: AutoPromoteDeps): Promise<AutoPromoteOutcome> {
  try {
    const modeloAtivo = (await deps.readConfig("ml_modelo_ativo")) ?? "heuristic_v1";
    if (modeloAtivo !== "heuristic_v1") {
      return { promoted: false, reason: "already_logistic" };
    }

    const pesosLogistic = await deps.readConfig("ml_pesos_v1_logistic");
    if (!pesosLogistic || pesosLogistic.trim() === "") {
      return { promoted: false, reason: "no_logistic_weights" };
    }

    // Validar JSON dos pesos — se for inválido, não promover
    try {
      const parsed = JSON.parse(pesosLogistic);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return { promoted: false, reason: "no_logistic_weights" };
      }
    } catch {
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
