/**
 * Motor de Scoring v2 — 9 Regras Graduais
 * Fiskix PoC — Electra Cabo Verde
 *
 * Etapa A: Balanço Energético (Filtro Macro)
 * Etapa B: 9 Regras Graduais por cliente (Filtro Micro)
 *
 * Constantes vêm de `src/modules/scoring/constants.ts` (fonte única partilhada
 * com a edge function via mirror em `supabase/functions/_shared/`).
 */

import {
  LIMIAR_QUEDA_PCT,
  LIMIAR_CV_MAXIMO,
  LIMIAR_MU_MINIMO,
  LIMIAR_ZSCORE_CLUSTER,
  LIMIAR_DIV_SAZONAL,
  LIMIAR_SLOPE_TENDENCIA,
  LIMIAR_RATIO_RACIO,
  LIMIAR_PICO_RATIO,
  LIMIAR_PERDA_ZONA_PCT,
  R1_WINDOW_MAX,
  R1_MIN_INDEX,
  R1_PONTOS_MAX,
  R1_FACTOR,
  R2_WINDOW,
  R2_PONTOS_MAX,
  R3_PONTOS_MAX,
  R3_FACTOR,
  R4_PONTOS_MAX,
  R4_FACTOR,
  R5_WINDOW,
  R5_MIN_MESES_CONSECUTIVOS,
  R5_PONTOS_MAX,
  R5_FACTOR,
  R6_PONTOS_MAX,
  R6_FACTOR,
  R7_BONUS,
  R8_MIN_INDEX,
  R8_LOOKBACK_MAX,
  R8_PONTOS_MAX,
  R8_FACTOR,
  R9_MULT_BASE,
  R9_MULT_MAX_DELTA,
  R9_MULT_FACTOR,
  LIMIAR_DIVIDA_CVE,
  R10_PONTOS_MAX,
  R10_FACTOR,
  R11_MESES_MIN_ESTIMADA,
  R11_PONTOS,
  R12_THRESHOLD_PCT,
  R12_PONTOS_MAX,
  SCORE_MAX,
} from "../constants";

export interface FaturacaoMensal {
  mes_ano: string;
  kwh_faturado: number;
  valor_cve: number;
}

export interface ClienteData {
  id: string;
  numero_contador: string;
  nome_titular: string;
  tipo_tarifa: string;
  id_subestacao: string;
  faturacao: FaturacaoMensal[];
  alertas_anteriores: number; // count de alertas != Falso_Positivo nos últimos 12 meses
  /** Potência contratada em watts (R12). Opcional — quando undefined, R12 retorna 0. */
  potencia_contratada_w?: number | null;
}

/** Meta-fatura usada por R10 + R11 (campos da fatura EDEC enriquecida). */
export interface MetaFatura {
  /** Saldo acumulado em CVE no fim do mês actual. R10 dispara em saldos altos. */
  saldo_atual_cve?: number | null;
  /** Tipo de leitura mês a mês — R11 dispara com 3+ meses consecutivos 'estimada'. */
  tipos_leitura_recentes?: Array<"real" | "estimada" | "empresa" | "cliente" | null>;
}

export interface RegraResultado {
  regra: string;
  pontos: number;
  descricao: string;
  valor?: number;
  threshold?: number;
}

export interface ScoreResult {
  id_cliente: string;
  score_base: number;
  score_final: number;
  multiplicador_zona: number;
  regras: RegraResultado[];
  mes_ano: string;
}

export interface BalancoResult {
  id_subestacao: string;
  mes_ano: string;
  kwh_injetado: number;
  kwh_faturado_total: number;
  perda_percentual: number;
  zona_vermelha: boolean;
  multiplicador: number;
}

// ============================================================
// ETAPA A: BALANÇO ENERGÉTICO (FILTRO MACRO)
// ============================================================

export function calcularBalanco(
  kwh_injetado: number,
  kwh_faturado_total: number,
  limiar_perda_pct = LIMIAR_PERDA_ZONA_PCT
): BalancoResult & { id_subestacao: string; mes_ano: string } {
  const perda_percentual =
    kwh_injetado > 0
      ? ((kwh_injetado - kwh_faturado_total) / kwh_injetado) * 100
      : 0;

  const zona_vermelha = perda_percentual > limiar_perda_pct;

  // R9: multiplicador = R9_MULT_BASE + min(R9_MULT_MAX_DELTA, (perda_zona - limiar) * R9_MULT_FACTOR)
  const multiplicador = zona_vermelha
    ? R9_MULT_BASE +
      Math.min(
        R9_MULT_MAX_DELTA,
        (perda_percentual / 100 - limiar_perda_pct / 100) * R9_MULT_FACTOR
      )
    : R9_MULT_BASE;

  return {
    id_subestacao: "",
    mes_ano: "",
    kwh_injetado,
    kwh_faturado_total,
    perda_percentual,
    zona_vermelha,
    multiplicador,
  };
}

// ============================================================
// ETAPA B: 9 REGRAS GRADUAIS (FILTRO MICRO)
// ============================================================

/**
 * R1: Queda Súbita Graduada (0-25 pts)
 * δ = (μ6m - Ct) / μ6m × 100
 * Score = min(25, floor((δ% - limiar) × 0.625))
 */
function r1QuedaSubitaGraduada(
  faturacao: FaturacaoMensal[],
  mesAtual: string,
  limiar = LIMIAR_QUEDA_PCT
): RegraResultado {
  const sorted = [...faturacao].sort((a, b) =>
    a.mes_ano.localeCompare(b.mes_ano)
  );
  const idx = sorted.findIndex((f) => f.mes_ano === mesAtual);

  if (idx < R1_MIN_INDEX) {
    return { regra: "R1", pontos: 0, descricao: "Dados insuficientes (< 3 meses)" };
  }

  // Janela adaptativa: 3-12 meses antes do mês atual
  const windowSize = Math.min(idx, R1_WINDOW_MAX);
  const historico = sorted.slice(idx - windowSize, idx);
  const media = historico.reduce((s, f) => s + f.kwh_faturado, 0) / historico.length;
  const atual = sorted[idx]!.kwh_faturado;

  if (media === 0) {
    return { regra: "R1", pontos: 0, descricao: "Média histórica zero" };
  }

  const delta = ((media - atual) / media) * 100;

  if (delta < limiar) {
    return {
      regra: "R1",
      pontos: 0,
      descricao: `Queda de ${delta.toFixed(1)}% — abaixo do limiar de ${limiar}%`,
      valor: delta,
      threshold: limiar,
    };
  }

  const pontos = Math.min(R1_PONTOS_MAX, Math.floor((delta - limiar) * R1_FACTOR));
  return {
    regra: "R1",
    pontos,
    descricao: `Queda de ${delta.toFixed(1)}% no consumo vs. média de ${windowSize} meses (+${pontos} pts)`,
    valor: delta,
    threshold: limiar,
  };
}

/**
 * R2: Variância Zero Contextualizada (0-15 pts)
 * CV = σ / μ dos últimos 4 meses
 * Gatilho: μ > limiar_mu AND CV < limiar_cv
 */
function r2VarianciaZeroContextualizada(
  faturacao: FaturacaoMensal[],
  mesAtual: string,
  limiar_cv = LIMIAR_CV_MAXIMO,
  limiar_mu = LIMIAR_MU_MINIMO
): RegraResultado {
  const sorted = [...faturacao].sort((a, b) =>
    a.mes_ano.localeCompare(b.mes_ano)
  );
  const idx = sorted.findIndex((f) => f.mes_ano === mesAtual);

  if (idx < R2_WINDOW) {
    return { regra: "R2", pontos: 0, descricao: "Dados insuficientes (< 4 meses)" };
  }

  const janela = sorted
    .slice(idx - (R2_WINDOW - 1), idx + 1)
    .map((f) => f.kwh_faturado);
  const media = janela.reduce((s, v) => s + v, 0) / janela.length;

  if (media <= limiar_mu) {
    return { regra: "R2", pontos: 0, descricao: "Consumo médio muito baixo — possível casa vazia" };
  }

  const variancia =
    janela.reduce((s, v) => s + Math.pow(v - media, 2), 0) / janela.length;
  const sigma = Math.sqrt(variancia);
  const cv = sigma / media;

  if (cv >= limiar_cv) {
    return {
      regra: "R2",
      pontos: 0,
      descricao: `CV = ${cv.toFixed(4)} — variação normal`,
      valor: cv,
      threshold: limiar_cv,
    };
  }

  // Pontuação gradual: quanto menor o CV, maior a pontuação
  const pontos = Math.min(R2_PONTOS_MAX, Math.round((1 - cv / limiar_cv) * R2_PONTOS_MAX));
  return {
    regra: "R2",
    pontos,
    descricao: `Consumo anormalmente constante (CV=${cv.toFixed(4)}, possível contador travado) (+${pontos} pts)`,
    valor: cv,
    threshold: limiar_cv,
  };
}

/**
 * R3: Desvio de Cluster Segmentado (0-20 pts)
 * Z = (Ct - mediana_tarifa) / MAD_tarifa
 * Gatilho: Z < -2 (segmentado por tipo_tarifa na mesma subestação)
 */
function r3DesvioClusterSegmentado(
  consumoAtual: number,
  medianaCluster: number,
  madCluster: number,
  limiar_zscore = LIMIAR_ZSCORE_CLUSTER
): RegraResultado {
  if (madCluster === 0) {
    return { regra: "R3", pontos: 0, descricao: "MAD do cluster = 0 (sem variação no cluster)" };
  }

  const z = (consumoAtual - medianaCluster) / madCluster;

  if (z >= limiar_zscore) {
    return {
      regra: "R3",
      pontos: 0,
      descricao: `Z-score = ${z.toFixed(2)} — dentro do esperado para a tarifa`,
      valor: z,
      threshold: limiar_zscore,
    };
  }

  // Pontuação gradual: Z-score mais negativo = mais pontos
  const pontos = Math.min(R3_PONTOS_MAX, Math.round(Math.abs(z - limiar_zscore) * R3_FACTOR));
  return {
    regra: "R3",
    pontos,
    descricao: `Z-score = ${z.toFixed(2)} — consumo muito abaixo da mediana da tarifa (+${pontos} pts)`,
    valor: z,
    threshold: limiar_zscore,
  };
}

/**
 * R4: Divergência Sazonal Reforçada (0-15 pts)
 * Div = ΔSub% - ΔCli%
 * Gatilho: Div > limiar (subestação sobe, cliente desce)
 */
function r4DivergenciaSazonal(
  faturacao: FaturacaoMensal[],
  mesAtual: string,
  tendenciaSubestacao: number, // % variação da subestação vs mesmo período
  limiar = LIMIAR_DIV_SAZONAL
): RegraResultado {
  const sorted = [...faturacao].sort((a, b) =>
    a.mes_ano.localeCompare(b.mes_ano)
  );
  const idx = sorted.findIndex((f) => f.mes_ano === mesAtual);

  if (idx < 2) {
    return { regra: "R4", pontos: 0, descricao: "Dados insuficientes" };
  }

  const atual = sorted[idx]!.kwh_faturado;
  const anterior = sorted[idx - 1]!.kwh_faturado;

  if (anterior === 0) {
    return { regra: "R4", pontos: 0, descricao: "Consumo anterior zero" };
  }

  const tendenciaCliente = ((atual - anterior) / anterior) * 100;
  const divergencia = tendenciaSubestacao - tendenciaCliente;

  if (divergencia <= limiar) {
    return {
      regra: "R4",
      pontos: 0,
      descricao: `Divergência de ${divergencia.toFixed(1)}% — abaixo do limiar`,
      valor: divergencia,
      threshold: limiar,
    };
  }

  const pontos = Math.min(R4_PONTOS_MAX, Math.round((divergencia - limiar) * R4_FACTOR));
  return {
    regra: "R4",
    pontos,
    descricao: `Bairro subiu ${tendenciaSubestacao.toFixed(1)}%, cliente desceu ${Math.abs(tendenciaCliente).toFixed(1)}% (divergência +${divergencia.toFixed(1)}%) (+${pontos} pts)`,
    valor: divergencia,
    threshold: limiar,
  };
}

/**
 * R5: Tendência Descendente Persistente (0-10 pts) — NOVA
 * Regressão linear dos últimos 6 meses
 * Gatilho: slope < -5 kWh/mês por 3+ meses consecutivos
 */
function r5TendenciaDescendente(
  faturacao: FaturacaoMensal[],
  mesAtual: string,
  limiar_slope = LIMIAR_SLOPE_TENDENCIA
): RegraResultado {
  const sorted = [...faturacao].sort((a, b) =>
    a.mes_ano.localeCompare(b.mes_ano)
  );
  const idx = sorted.findIndex((f) => f.mes_ano === mesAtual);

  if (idx < R5_WINDOW) {
    return { regra: "R5", pontos: 0, descricao: "Dados insuficientes (< 6 meses)" };
  }

  const janela = sorted.slice(idx - (R5_WINDOW - 1), idx + 1);
  const n = janela.length;
  const xs = janela.map((_, i) => i);
  const ys = janela.map((f) => f.kwh_faturado);

  // Regressão linear simples
  const sumX = xs.reduce((s, x) => s + x, 0);
  const sumY = ys.reduce((s, y) => s + y, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i]!, 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Verificar se há 3+ meses consecutivos com queda
  let mesesConsecutivos = 0;
  for (let i = janela.length - 1; i > 0; i--) {
    if (janela[i]!.kwh_faturado < janela[i - 1]!.kwh_faturado) {
      mesesConsecutivos++;
    } else {
      break;
    }
  }

  if (slope >= limiar_slope || mesesConsecutivos < R5_MIN_MESES_CONSECUTIVOS) {
    return {
      regra: "R5",
      pontos: 0,
      descricao: `Slope = ${slope.toFixed(1)} kWh/mês, ${mesesConsecutivos} meses consecutivos — sem padrão de queda`,
      valor: slope,
      threshold: limiar_slope,
    };
  }

  const pontos = Math.min(R5_PONTOS_MAX, Math.round(Math.abs(slope - limiar_slope) * R5_FACTOR));
  return {
    regra: "R5",
    pontos,
    descricao: `Tendência de ${slope.toFixed(1)} kWh/mês por ${mesesConsecutivos} meses consecutivos (slow bleed) (+${pontos} pts)`,
    valor: slope,
    threshold: limiar_slope,
  };
}

/**
 * R6: Rácio CVE/kWh (0-5 pts) — NOVA
 * Anomalia no custo unitário
 * Gatilho: |ratio - média_tarifa| / σ_tarifa > limiar
 */
function r6RacioCVEkWh(
  faturacao: FaturacaoMensal[],
  mesAtual: string,
  mediaRacioTarifa: number,
  sigmaRacioTarifa: number,
  limiar = LIMIAR_RATIO_RACIO
): RegraResultado {
  const f = faturacao.find((f) => f.mes_ano === mesAtual);

  if (!f || f.kwh_faturado === 0 || sigmaRacioTarifa === 0) {
    return { regra: "R6", pontos: 0, descricao: "Dados insuficientes" };
  }

  const racio = f.valor_cve / f.kwh_faturado;
  const desvio = Math.abs(racio - mediaRacioTarifa) / sigmaRacioTarifa;

  if (desvio <= limiar) {
    return {
      regra: "R6",
      pontos: 0,
      descricao: `Rácio CVE/kWh = ${racio.toFixed(2)} — dentro do esperado`,
      valor: desvio,
      threshold: limiar,
    };
  }

  const pontos = Math.min(R6_PONTOS_MAX, Math.round((desvio - limiar) * R6_FACTOR));
  return {
    regra: "R6",
    pontos,
    descricao: `Rácio CVE/kWh anómalo (${racio.toFixed(2)} vs média ${mediaRacioTarifa.toFixed(2)}) (+${pontos} pts)`,
    valor: desvio,
    threshold: limiar,
  };
}

/**
 * R7: Reincidência Histórica (+5 pts bónus) — NOVA
 * Clientes com alertas anteriores não falso-positivos nos últimos 12 meses
 */
function r7Reincidencia(alertasAnteriores: number): RegraResultado {
  if (alertasAnteriores === 0) {
    return { regra: "R7", pontos: 0, descricao: "Sem histórico de alertas" };
  }

  return {
    regra: "R7",
    pontos: R7_BONUS,
    descricao: `${alertasAnteriores} alerta(s) confirmado(s) nos últimos 12 meses (reincidente) (+${R7_BONUS} pts bónus)`,
    valor: alertasAnteriores,
  };
}

/**
 * R8: Rácio Pico Histórico vs Atual (0-5 pts) — NOVA
 * Fraudes estabilizadas — bypass há meses, média recente já absorveu a queda
 * Gatilho: atual < 20% do máximo histórico AND meses > 6
 */
function r8PicoHistoricoVsAtual(
  faturacao: FaturacaoMensal[],
  mesAtual: string,
  limiar_ratio = LIMIAR_PICO_RATIO
): RegraResultado {
  const sorted = [...faturacao].sort((a, b) =>
    a.mes_ano.localeCompare(b.mes_ano)
  );
  const idx = sorted.findIndex((f) => f.mes_ano === mesAtual);

  if (idx < R8_MIN_INDEX) {
    return { regra: "R8", pontos: 0, descricao: "Histórico insuficiente (< 6 meses)" };
  }

  // Bound to last R8_LOOKBACK_MAX months — avoids penalising customers who
  // legitimately downsized years ago (e.g. industrial site → residential).
  const historico = sorted.slice(Math.max(0, idx - R8_LOOKBACK_MAX), idx);
  const picoHistorico = Math.max(...historico.map((f) => f.kwh_faturado));
  const atual = sorted[idx]!.kwh_faturado;

  if (picoHistorico === 0) {
    return { regra: "R8", pontos: 0, descricao: "Pico histórico zero" };
  }

  const ratio = atual / picoHistorico;

  if (ratio >= limiar_ratio) {
    return {
      regra: "R8",
      pontos: 0,
      descricao: `Atual é ${(ratio * 100).toFixed(1)}% do pico histórico — normal`,
      valor: ratio,
      threshold: limiar_ratio,
    };
  }

  const pontos = Math.min(R8_PONTOS_MAX, Math.round((limiar_ratio - ratio) * R8_FACTOR));
  return {
    regra: "R8",
    pontos,
    descricao: `Atual é apenas ${(ratio * 100).toFixed(1)}% do pico histórico de ${picoHistorico} kWh (+${pontos} pts)`,
    valor: ratio,
    threshold: limiar_ratio,
  };
}

/**
 * R10: Dívida Acumulada (0–10 pts)
 *
 * Cliente com saldo em dívida elevado tem incentivo financeiro directo para
 * fraudar o contador (atraso prolongado de pagamento). Sinal extraído da
 * fatura EDEC: `saldo_atual_cve` da última faturação.
 *
 * Pontuação linear acima do limiar configurável (default 3000 CVE), capped
 * em R10_PONTOS_MAX. Sem dado → 0 pontos (compat retroativa).
 */
function r10DividaAcumulada(saldoAtualCve: number | null | undefined, limiar = LIMIAR_DIVIDA_CVE): RegraResultado {
  if (saldoAtualCve == null || saldoAtualCve < limiar) {
    return {
      regra: "R10",
      pontos: 0,
      descricao: saldoAtualCve == null
        ? "Sem dados de dívida"
        : `Dívida ${saldoAtualCve.toFixed(0)} CVE — abaixo do limiar (${limiar})`,
      valor: saldoAtualCve ?? undefined,
      threshold: limiar,
    };
  }
  const pontos = Math.min(R10_PONTOS_MAX, Math.round((saldoAtualCve - limiar) * R10_FACTOR));
  return {
    regra: "R10",
    pontos,
    descricao: `Dívida acumulada ${saldoAtualCve.toFixed(0)} CVE — incentivo financeiro elevado (+${pontos} pts)`,
    valor: saldoAtualCve,
    threshold: limiar,
  };
}

/**
 * R11: Leitura Estimada Recorrente (0 ou 5 pts)
 *
 * `tipos_leitura_recentes` é uma lista cronológica (mais recente primeiro)
 * dos tipos de leitura dos últimos meses. 3+ meses consecutivos a partir do
 * mais recente com tipo='estimada' indica recusa de acesso ao contador —
 * pattern clássico de fraude (cliente bloqueia inspecção).
 */
function r11LeituraEstimadaRecorrente(tipos: Array<"real" | "estimada" | "empresa" | "cliente" | null> | undefined): RegraResultado {
  if (!tipos || tipos.length < R11_MESES_MIN_ESTIMADA) {
    return { regra: "R11", pontos: 0, descricao: "Sem histórico suficiente de tipos de leitura" };
  }
  let consecutivos = 0;
  for (const t of tipos) {
    if (t === "estimada") consecutivos++;
    else break;
  }
  if (consecutivos >= R11_MESES_MIN_ESTIMADA) {
    return {
      regra: "R11",
      pontos: R11_PONTOS,
      descricao: `${consecutivos} meses consecutivos com leitura estimada — possível recusa de acesso (+${R11_PONTOS} pts)`,
      valor: consecutivos,
      threshold: R11_MESES_MIN_ESTIMADA,
    };
  }
  return { regra: "R11", pontos: 0, descricao: `Apenas ${consecutivos} meses consecutivos estimados — abaixo do limiar` };
}

/**
 * R12: Subutilização de Potência Contratada (0–5 pts)
 *
 * Cliente com potência contratada significativa (ex: 6.6 kW) mas consumo
 * muito baixo (< 1% da capacidade teórica do mês) sugere by-pass do
 * contador para a maior parte do consumo real.
 *
 * capacidade_kwh_mes = potencia_kw * 24h * 30d
 * uso_pct = (kwh_atual / capacidade_kwh_mes) * 100
 * Se uso_pct < threshold → pontua linearmente até R12_PONTOS_MAX.
 */
function r12SubutilizacaoPotencia(
  kwhAtual: number,
  potenciaWatts: number | null | undefined,
  threshold = R12_THRESHOLD_PCT,
): RegraResultado {
  if (potenciaWatts == null || potenciaWatts <= 0) {
    return { regra: "R12", pontos: 0, descricao: "Sem dados de potência contratada" };
  }
  const potenciaKw = potenciaWatts / 1000;
  const capacidadeMensal = potenciaKw * 24 * 30;
  const usoPct = capacidadeMensal > 0 ? (kwhAtual / capacidadeMensal) * 100 : 0;
  if (usoPct >= threshold) {
    return {
      regra: "R12",
      pontos: 0,
      descricao: `Uso ${usoPct.toFixed(2)}% da capacidade contratada — normal`,
      valor: usoPct,
      threshold,
    };
  }
  const pontos = Math.min(R12_PONTOS_MAX, Math.round((threshold - usoPct) * 5));
  return {
    regra: "R12",
    pontos,
    descricao: `Apenas ${usoPct.toFixed(2)}% da capacidade contratada (${potenciaKw.toFixed(1)} kW) — subutilização anormal (+${pontos} pts)`,
    valor: usoPct,
    threshold,
  };
}

// ============================================================
// MOTOR PRINCIPAL
// ============================================================

export interface Limiares {
  limiar_queda_pct?: number;
  limiar_cv_maximo?: number;
  limiar_mu_minimo?: number;
  limiar_zscore_cluster?: number;
  limiar_div_sazonal?: number;
  limiar_slope_tendencia?: number;
  limiar_ratio_racio?: number;
  limiar_pico_ratio?: number;
  limiar_divida_cve?: number;
  r12_threshold_pct?: number;
}

export interface ClusterInfo {
  mediana: number;
  mad: number;
  media_racio_cve_kwh: number;
  sigma_racio_cve_kwh: number;
  tendencia_subestacao_pct: number;
}

export function calcularScore(
  cliente: ClienteData,
  mesAtual: string,
  multiplicadorZona: number,
  clusterInfo: ClusterInfo,
  limiares: Limiares = {},
  metaFatura: MetaFatura = {},
): ScoreResult {
  const {
    limiar_queda_pct = LIMIAR_QUEDA_PCT,
    limiar_cv_maximo = LIMIAR_CV_MAXIMO,
    limiar_mu_minimo = LIMIAR_MU_MINIMO,
    limiar_zscore_cluster = LIMIAR_ZSCORE_CLUSTER,
    limiar_div_sazonal = LIMIAR_DIV_SAZONAL,
    limiar_slope_tendencia = LIMIAR_SLOPE_TENDENCIA,
    limiar_ratio_racio = LIMIAR_RATIO_RACIO,
    limiar_pico_ratio = LIMIAR_PICO_RATIO,
    limiar_divida_cve = LIMIAR_DIVIDA_CVE,
    r12_threshold_pct = R12_THRESHOLD_PCT,
  } = limiares;

  const faturacaoAtual = cliente.faturacao.find((f) => f.mes_ano === mesAtual);
  if (!faturacaoAtual) {
    return {
      id_cliente: cliente.id,
      score_base: 0,
      score_final: 0,
      multiplicador_zona: multiplicadorZona,
      regras: [],
      mes_ano: mesAtual,
    };
  }

  const regras: RegraResultado[] = [
    r1QuedaSubitaGraduada(cliente.faturacao, mesAtual, limiar_queda_pct),
    r2VarianciaZeroContextualizada(
      cliente.faturacao,
      mesAtual,
      limiar_cv_maximo,
      limiar_mu_minimo
    ),
    r3DesvioClusterSegmentado(
      faturacaoAtual.kwh_faturado,
      clusterInfo.mediana,
      clusterInfo.mad,
      limiar_zscore_cluster
    ),
    r4DivergenciaSazonal(
      cliente.faturacao,
      mesAtual,
      clusterInfo.tendencia_subestacao_pct,
      limiar_div_sazonal
    ),
    r5TendenciaDescendente(cliente.faturacao, mesAtual, limiar_slope_tendencia),
    r6RacioCVEkWh(
      cliente.faturacao,
      mesAtual,
      clusterInfo.media_racio_cve_kwh,
      clusterInfo.sigma_racio_cve_kwh,
      limiar_ratio_racio
    ),
    r7Reincidencia(cliente.alertas_anteriores),
    r8PicoHistoricoVsAtual(cliente.faturacao, mesAtual, limiar_pico_ratio),
    r10DividaAcumulada(metaFatura.saldo_atual_cve, limiar_divida_cve),
    r11LeituraEstimadaRecorrente(metaFatura.tipos_leitura_recentes),
    r12SubutilizacaoPotencia(faturacaoAtual.kwh_faturado, cliente.potencia_contratada_w, r12_threshold_pct),
  ];

  const score_base = regras.reduce((sum, r) => sum + r.pontos, 0);

  // R9: Multiplicador de zona (já calculado no balanço energético)
  const score_final = Math.min(SCORE_MAX, Math.round(score_base * multiplicadorZona));

  return {
    id_cliente: cliente.id,
    score_base,
    score_final,
    multiplicador_zona: multiplicadorZona,
    regras,
    mes_ano: mesAtual,
  };
}

/** Calcula mediana de um array */
export function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const sorted = [...valores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Calcula MAD (Median Absolute Deviation) */
export function mad(valores: number[], med?: number): number {
  const m = med ?? mediana(valores);
  return mediana(valores.map((v) => Math.abs(v - m)));
}
