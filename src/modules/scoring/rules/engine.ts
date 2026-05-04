/**
 * Motor de Scoring v2 — 9 Regras Graduais
 * Fiskix PoC — Electra Cabo Verde
 *
 * Etapa A: Balanço Energético (Filtro Macro)
 * Etapa B: 9 Regras Graduais por cliente (Filtro Micro)
 */

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
  limiar_perda_pct = 15
): BalancoResult & { id_subestacao: string; mes_ano: string } {
  const perda_percentual =
    kwh_injetado > 0
      ? ((kwh_injetado - kwh_faturado_total) / kwh_injetado) * 100
      : 0;

  const zona_vermelha = perda_percentual > limiar_perda_pct;

  // R9: multiplicador = 1 + min(0.3, (perda_zona - 0.15) * 2)
  const multiplicador = zona_vermelha
    ? 1 + Math.min(0.3, ((perda_percentual / 100) - 0.15) * 2)
    : 1.0;

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
  limiar = 30
): RegraResultado {
  const sorted = [...faturacao].sort((a, b) =>
    a.mes_ano.localeCompare(b.mes_ano)
  );
  const idx = sorted.findIndex((f) => f.mes_ano === mesAtual);

  if (idx < 3) {
    return { regra: "R1", pontos: 0, descricao: "Dados insuficientes (< 3 meses)" };
  }

  // Janela adaptativa: 3-12 meses antes do mês atual
  const windowSize = Math.min(idx, 6);
  const historico = sorted.slice(idx - windowSize, idx);
  const media = historico.reduce((s, f) => s + f.kwh_faturado, 0) / historico.length;
  const atual = sorted[idx].kwh_faturado;

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

  const pontos = Math.min(25, Math.floor((delta - limiar) * 0.625));
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
  limiar_cv = 0.03,
  limiar_mu = 15
): RegraResultado {
  const sorted = [...faturacao].sort((a, b) =>
    a.mes_ano.localeCompare(b.mes_ano)
  );
  const idx = sorted.findIndex((f) => f.mes_ano === mesAtual);

  if (idx < 4) {
    return { regra: "R2", pontos: 0, descricao: "Dados insuficientes (< 4 meses)" };
  }

  const janela = sorted.slice(idx - 3, idx + 1).map((f) => f.kwh_faturado);
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
  const pontos = Math.min(15, Math.round((1 - cv / limiar_cv) * 15));
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
  limiar_zscore = -2
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
  const pontos = Math.min(20, Math.round(Math.abs(z - limiar_zscore) * 5));
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
  limiar = 20
): RegraResultado {
  const sorted = [...faturacao].sort((a, b) =>
    a.mes_ano.localeCompare(b.mes_ano)
  );
  const idx = sorted.findIndex((f) => f.mes_ano === mesAtual);

  if (idx < 2) {
    return { regra: "R4", pontos: 0, descricao: "Dados insuficientes" };
  }

  const atual = sorted[idx].kwh_faturado;
  const anterior = sorted[idx - 1].kwh_faturado;

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

  const pontos = Math.min(15, Math.round((divergencia - limiar) * 0.5));
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
  limiar_slope = -5
): RegraResultado {
  const sorted = [...faturacao].sort((a, b) =>
    a.mes_ano.localeCompare(b.mes_ano)
  );
  const idx = sorted.findIndex((f) => f.mes_ano === mesAtual);

  if (idx < 6) {
    return { regra: "R5", pontos: 0, descricao: "Dados insuficientes (< 6 meses)" };
  }

  const janela = sorted.slice(idx - 5, idx + 1);
  const n = janela.length;
  const xs = janela.map((_, i) => i);
  const ys = janela.map((f) => f.kwh_faturado);

  // Regressão linear simples
  const sumX = xs.reduce((s, x) => s + x, 0);
  const sumY = ys.reduce((s, y) => s + y, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Verificar se há 3+ meses consecutivos com queda
  let mesesConsecutivos = 0;
  for (let i = janela.length - 1; i > 0; i--) {
    if (janela[i].kwh_faturado < janela[i - 1].kwh_faturado) {
      mesesConsecutivos++;
    } else {
      break;
    }
  }

  if (slope >= limiar_slope || mesesConsecutivos < 3) {
    return {
      regra: "R5",
      pontos: 0,
      descricao: `Slope = ${slope.toFixed(1)} kWh/mês, ${mesesConsecutivos} meses consecutivos — sem padrão de queda`,
      valor: slope,
      threshold: limiar_slope,
    };
  }

  const pontos = Math.min(10, Math.round(Math.abs(slope - limiar_slope) * 0.8));
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
  limiar = 2
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

  const pontos = Math.min(5, Math.round((desvio - limiar) * 2));
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
    pontos: 5,
    descricao: `${alertasAnteriores} alerta(s) confirmado(s) nos últimos 12 meses (reincidente) (+5 pts bónus)`,
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
  limiar_ratio = 0.20
): RegraResultado {
  const sorted = [...faturacao].sort((a, b) =>
    a.mes_ano.localeCompare(b.mes_ano)
  );
  const idx = sorted.findIndex((f) => f.mes_ano === mesAtual);

  if (idx < 6) {
    return { regra: "R8", pontos: 0, descricao: "Histórico insuficiente (< 6 meses)" };
  }

  // Bound to last 24 months — avoids penalising customers who legitimately
  // downsized years ago (e.g. industrial site that became residential).
  const historico = sorted.slice(Math.max(0, idx - 24), idx);
  const picoHistorico = Math.max(...historico.map((f) => f.kwh_faturado));
  const atual = sorted[idx].kwh_faturado;

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

  const pontos = Math.min(5, Math.round((limiar_ratio - ratio) * 20));
  return {
    regra: "R8",
    pontos,
    descricao: `Atual é apenas ${(ratio * 100).toFixed(1)}% do pico histórico de ${picoHistorico} kWh (+${pontos} pts)`,
    valor: ratio,
    threshold: limiar_ratio,
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
  limiares: Limiares = {}
): ScoreResult {
  const {
    limiar_queda_pct = 30,
    limiar_cv_maximo = 0.03,
    limiar_mu_minimo = 15,
    limiar_zscore_cluster = -2,
    limiar_div_sazonal = 20,
    limiar_slope_tendencia = -5,
    limiar_ratio_racio = 2,
    limiar_pico_ratio = 0.2,
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
  ];

  const score_base = regras.reduce((sum, r) => sum + r.pontos, 0);

  // R9: Multiplicador de zona (já calculado no balanço energético)
  const score_final = Math.min(100, Math.round(score_base * multiplicadorZona));

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
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Calcula MAD (Median Absolute Deviation) */
export function mad(valores: number[], med?: number): number {
  const m = med ?? mediana(valores);
  return mediana(valores.map((v) => Math.abs(v - m)));
}
