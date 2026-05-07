/**
 * Constantes partilhadas do Motor de Scoring — Fiskix
 *
 * Fonte única de verdade consumida por:
 *   - src/modules/scoring/rules/engine.ts          (Next.js / Vitest)
 *   - supabase/functions/_shared/scoring-constants.ts  (mirror Deno)
 *
 * Qualquer alteração aqui DEVE ser replicada no mirror Deno.
 * O teste `src/__tests__/scoring-parity.test.ts` falha se os dois divergirem.
 */

import type { Database } from "@/types/database";

type InspecaoResultado = Database["public"]["Enums"]["inspecao_resultado"];

// ============================================================
// THRESHOLDS DAS REGRAS (defaults — sobreescrevíveis em `configuracoes`)
// ============================================================

export const LIMIAR_QUEDA_PCT = 30;            // R1: queda mínima %
export const LIMIAR_CV_MAXIMO = 0.03;          // R2: coeficiente de variação máximo
export const LIMIAR_MU_MINIMO = 15;            // R2: consumo médio mínimo (kWh)
export const LIMIAR_ZSCORE_CLUSTER = -2;       // R3: z-score máximo (negativo)
export const LIMIAR_DIV_SAZONAL = 20;          // R4: divergência sazonal mínima %
export const LIMIAR_SLOPE_TENDENCIA = -5;      // R5: declive negativo mínimo (kWh/mês)
export const LIMIAR_RATIO_RACIO = 2;           // R6: desvios-padrão acima da média
export const LIMIAR_PICO_RATIO = 0.20;         // R8: rácio atual/pico máximo
export const LIMIAR_PERDA_ZONA_PCT = 15;       // R9 / Balanço: % perda zona vermelha

// ============================================================
// SEVERIDADE DOS ALERTAS (UI + relatórios)
// ============================================================

export const SCORE_CRITICO = 75;               // score >= → CRÍTICO (vermelho)
export const SCORE_MEDIO = 50;                 // 50 <= score < 75 → MÉDIO (amarelo)

// ============================================================
// PARÂMETROS ESTRUTURAIS (não configuráveis — fazem parte da definição)
// ============================================================

// R1 — Queda Súbita Graduada
export const R1_WINDOW_MAX = 6;                // janela máxima do histórico
export const R1_MIN_INDEX = 3;                 // índice mínimo (>= 3 meses de histórico)
export const R1_PONTOS_MAX = 25;
export const R1_FACTOR = 0.625;                // pontos = floor((delta - limiar) * factor)

// R2 — Variância Zero
export const R2_WINDOW = 4;                    // últimos 4 meses incluindo atual
export const R2_PONTOS_MAX = 15;

// R3 — Desvio de Cluster
export const R3_PONTOS_MAX = 20;
export const R3_FACTOR = 5;                    // pontos = round(|z - limiar| * factor)

// R4 — Divergência Sazonal
export const R4_PONTOS_MAX = 15;
export const R4_FACTOR = 0.5;                  // pontos = round((div - limiar) * factor)

// R5 — Tendência Descendente
export const R5_WINDOW = 6;                    // 6 meses (incluindo o atual)
export const R5_MIN_MESES_CONSECUTIVOS = 3;
export const R5_PONTOS_MAX = 10;
export const R5_FACTOR = 0.8;

// R6 — Rácio CVE/kWh
export const R6_MIN_CLUSTER_SIZE = 3;          // mínimo 3 clientes na tarifa para sigma
export const R6_PONTOS_MAX = 5;
export const R6_FACTOR = 2;

// R7 — Reincidência
export const R7_BONUS = 5;
export const R7_LOOKBACK_MESES = 12;

// R8 — Pico Histórico
export const R8_MIN_INDEX = 6;
export const R8_LOOKBACK_MAX = 24;             // bound histórico para 24 meses
export const R8_PONTOS_MAX = 5;
export const R8_FACTOR = 20;

// R9 — Multiplicador de Zona
export const R9_MULT_BASE = 1.0;
export const R9_MULT_MAX_DELTA = 0.3;          // cap de 1.3x (1.0 + 0.3)
export const R9_MULT_FACTOR = 2;               // (perda_pct - limiar_pct) * factor

// R10 — Dívida Acumulada (incentivo financeiro para fraude)
export const LIMIAR_DIVIDA_CVE = 3000;         // saldo_atual_cve >= este → pontua
export const R10_PONTOS_MAX = 10;
export const R10_FACTOR = 0.001;               // pontos = (saldo - limiar) * factor

// R11 — Leitura Estimada Recorrente (recusa de acesso → fraude)
export const R11_MESES_MIN_ESTIMADA = 3;       // 3+ meses consecutivos estimados
export const R11_PONTOS = 5;                   // bónus fixo

// R12 — Subutilização de Potência Contratada (cliente "fantasma")
export const R12_THRESHOLD_PCT = 1;            // (kWh / capacidade) × 100 < 1% → pontua
export const R12_PONTOS_MAX = 5;

// Score final
export const SCORE_MAX = 100;
export const SCORE_LIMIAR_ALERTA = 50;

// ============================================================
// BALANÇO ENERGÉTICO
// ============================================================

/** Tarifa média (CVE/kWh) usada como fallback no cálculo de cve_perdido_estimado
 *  quando a subestação tem zero faturação. Configurável em
 *  `configuracoes.tarifa_fallback_cve_kwh` (default 15 — referência tarifa Electra residencial). */
export const TARIFA_FALLBACK_CVE_KWH = 15;

// ============================================================
// R7 — REINCIDÊNCIA: resultados que contam como reincidência
// ============================================================

/** Resultados de inspeção que contam como reincidência (R7).
 *  Falso_Positivo NÃO conta — apenas inspeções que confirmaram problema real.
 *  Tipado para que renomear o enum `inspecao_resultado` em
 *  `src/types/database.ts` quebre o build em vez de matar a regra silenciosamente. */
export const RESULTADOS_REINCIDENCIA = [
  "Fraude_Confirmada",
  "Anomalia_Tecnica",
] as const satisfies readonly InspecaoResultado[];

export type ResultadoReincidencia = typeof RESULTADOS_REINCIDENCIA[number];         // só insere alerta se score_final >= 50
