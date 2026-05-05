/**
 * Lógica pura do Edge Function de Scoring — Fiskix
 *
 * Esta é a "implementação edge" das regras R1-R8 + R9 (multiplicador).
 * Existe como um ficheiro pure-TS (sem dependências Deno/Supabase) para que:
 *
 *   1. O Edge Function (`index.ts`) a chame depois de obter os dados de Supabase.
 *   2. O teste de paridade (`src/__tests__/scoring-parity.test.ts`) a execute
 *      no mesmo input que `engine.ts` e falhe se divergirem.
 *
 * MUDANÇAS AQUI: confirmar que `engine.ts` reflete a mesma alteração;
 * caso contrário a parity test bloqueia o merge.
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
  R6_MIN_CLUSTER_SIZE,
  R6_PONTOS_MAX,
  R6_FACTOR,
  R7_BONUS,
  R8_MIN_INDEX,
  R8_LOOKBACK_MAX,
  R8_PONTOS_MAX,
  R8_FACTOR,
  LIMIAR_DIVIDA_CVE,
  R10_PONTOS_MAX,
  R10_FACTOR,
  R11_MESES_MIN_ESTIMADA,
  R11_PONTOS,
  R12_THRESHOLD_PCT,
  R12_PONTOS_MAX,
  SCORE_MAX,
} from "../_shared/scoring-constants.ts";

// ============================================================
// TIPOS
// ============================================================

export interface FaturacaoMensalEdge {
  mes_ano: string;
  kwh_faturado: number;
  valor_cve: number;
}

export interface RegraResultadoEdge {
  regra: string;
  pontos: number;
  descricao: string;
  valor?: number;
  threshold?: number;
}

export interface ScoreInputEdge {
  /** Histórico completo de faturação (12+ meses recomendado) */
  faturacao: FaturacaoMensalEdge[];
  /** Mês alvo do scoring ("YYYY-MM") */
  mesAtual: string;
  /** Consumo do mês atual em kWh */
  kwhAtual: number;
  /** Valor faturado em CVE no mês atual */
  cveAtual: number;
  /** Mediana do cluster da mesma tarifa na subestação */
  medianaCluster: number;
  /** MAD do cluster */
  madCluster: number;
  /** Média do rácio CVE/kWh do cluster */
  mediaRacio: number;
  /** Sigma do rácio CVE/kWh do cluster (0 se cluster < R6_MIN_CLUSTER_SIZE) */
  sigmaRacio: number;
  /** Tamanho do cluster (clientes na mesma tarifa com faturação no mês) */
  clusterSize: number;
  /** Tendência mês-a-mês da subestação (% variação) */
  tendenciaSubestacao: number;
  /** Nº de alertas confirmados nos últimos 12 meses */
  alertasAnteriores: number;
  /** Multiplicador de zona já calculado a partir do balanço energético */
  multiplicadorZona: number;
  /** R10: saldo em dívida (CVE) extraído da fatura. Opcional. */
  saldoAtualCve?: number | null;
  /** R11: tipos de leitura ordenados (mais recente primeiro). Opcional. */
  tiposLeituraRecentes?: Array<"real" | "estimada" | "empresa" | "cliente" | null>;
  /** R12: potência contratada em watts. Opcional. */
  potenciaContratadaWatts?: number | null;
}

export interface ScoreOutputEdge {
  regras: RegraResultadoEdge[];
  score_base: number;
  score_final: number;
}

export interface LimiaresEdge {
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

// ============================================================
// SCORING — LÓGICA PURA EDGE
// ============================================================

export function calcularScoreEdge(
  input: ScoreInputEdge,
  limiares: LimiaresEdge = {}
): ScoreOutputEdge {
  const limiar_queda_pct = limiares.limiar_queda_pct ?? LIMIAR_QUEDA_PCT;
  const limiar_cv_maximo = limiares.limiar_cv_maximo ?? LIMIAR_CV_MAXIMO;
  const limiar_mu_minimo = limiares.limiar_mu_minimo ?? LIMIAR_MU_MINIMO;
  const limiar_zscore_cluster = limiares.limiar_zscore_cluster ?? LIMIAR_ZSCORE_CLUSTER;
  const limiar_div_sazonal = limiares.limiar_div_sazonal ?? LIMIAR_DIV_SAZONAL;
  const limiar_slope_tendencia = limiares.limiar_slope_tendencia ?? LIMIAR_SLOPE_TENDENCIA;
  const limiar_ratio_racio = limiares.limiar_ratio_racio ?? LIMIAR_RATIO_RACIO;
  const limiar_pico_ratio = limiares.limiar_pico_ratio ?? LIMIAR_PICO_RATIO;
  const limiar_divida_cve = limiares.limiar_divida_cve ?? LIMIAR_DIVIDA_CVE;
  const r12_threshold_pct = limiares.r12_threshold_pct ?? R12_THRESHOLD_PCT;

  const {
    faturacao,
    mesAtual,
    kwhAtual,
    cveAtual,
    medianaCluster,
    madCluster,
    mediaRacio,
    sigmaRacio,
    clusterSize,
    tendenciaSubestacao,
    alertasAnteriores,
    multiplicadorZona,
    saldoAtualCve,
    tiposLeituraRecentes,
    potenciaContratadaWatts,
  } = input;

  const sorted = [...faturacao].sort((a, b) =>
    a.mes_ano.localeCompare(b.mes_ano)
  );
  const idx = sorted.findIndex((f) => f.mes_ano === mesAtual);

  const regras: RegraResultadoEdge[] = [];
  let score_base = 0;

  // ---------------- R1: Queda Súbita ----------------
  {
    if (idx >= R1_MIN_INDEX) {
      const wSize = Math.min(idx, R1_WINDOW_MAX);
      const hist = sorted.slice(idx - wSize, idx);
      const media = hist.reduce((s, f) => s + f.kwh_faturado, 0) / hist.length;
      const atual = sorted[idx]!.kwh_faturado;
      if (media > 0) {
        const delta = ((media - atual) / media) * 100;
        if (delta >= limiar_queda_pct) {
          const pts = Math.min(
            R1_PONTOS_MAX,
            Math.floor((delta - limiar_queda_pct) * R1_FACTOR)
          );
          score_base += pts;
          regras.push({
            regra: "R1",
            pontos: pts,
            descricao: `Queda de ${delta.toFixed(1)}% vs média ${wSize} meses`,
            valor: delta,
            threshold: limiar_queda_pct,
          });
        } else {
          regras.push({
            regra: "R1",
            pontos: 0,
            descricao: `Queda de ${delta.toFixed(1)}% — normal`,
          });
        }
      }
    }
  }

  // ---------------- R2: Variância Zero ----------------
  {
    if (idx >= R2_WINDOW) {
      const janela = sorted
        .slice(idx - (R2_WINDOW - 1), idx + 1)
        .map((f) => f.kwh_faturado);
      const media = janela.reduce((s, v) => s + v, 0) / janela.length;
      if (media > limiar_mu_minimo) {
        const variancia =
          janela.reduce((s, v) => s + Math.pow(v - media, 2), 0) / janela.length;
        const cv = Math.sqrt(variancia) / media;
        if (cv < limiar_cv_maximo) {
          const pts = Math.min(
            R2_PONTOS_MAX,
            Math.round((1 - cv / limiar_cv_maximo) * R2_PONTOS_MAX)
          );
          score_base += pts;
          regras.push({
            regra: "R2",
            pontos: pts,
            descricao: `Contador anormalmente constante (CV=${cv.toFixed(4)})`,
            valor: cv,
            threshold: limiar_cv_maximo,
          });
        } else {
          regras.push({ regra: "R2", pontos: 0, descricao: "Variação normal" });
        }
      }
    }
  }

  // ---------------- R3: Desvio Cluster ----------------
  {
    if (madCluster > 0) {
      const z = (kwhAtual - medianaCluster) / madCluster;
      if (z < limiar_zscore_cluster) {
        const pts = Math.min(
          R3_PONTOS_MAX,
          Math.round(Math.abs(z - limiar_zscore_cluster) * R3_FACTOR)
        );
        score_base += pts;
        regras.push({
          regra: "R3",
          pontos: pts,
          descricao: `Z-score ${z.toFixed(2)} abaixo da mediana da tarifa`,
          valor: z,
          threshold: limiar_zscore_cluster,
        });
      } else {
        regras.push({
          regra: "R3",
          pontos: 0,
          descricao: `Z-score ${z.toFixed(2)} — normal`,
        });
      }
    }
  }

  // ---------------- R4: Divergência Sazonal ----------------
  {
    if (idx >= 2) {
      const atual = sorted[idx]!.kwh_faturado;
      const ant = sorted[idx - 1]!.kwh_faturado;
      if (ant > 0) {
        const tendCli = ((atual - ant) / ant) * 100;
        const div = tendenciaSubestacao - tendCli;
        if (div > limiar_div_sazonal) {
          const pts = Math.min(
            R4_PONTOS_MAX,
            Math.round((div - limiar_div_sazonal) * R4_FACTOR)
          );
          score_base += pts;
          regras.push({
            regra: "R4",
            pontos: pts,
            descricao: `Divergência sazonal ${div.toFixed(1)}%`,
            valor: div,
            threshold: limiar_div_sazonal,
          });
        } else {
          regras.push({
            regra: "R4",
            pontos: 0,
            descricao: `Divergência ${div.toFixed(1)}% — normal`,
          });
        }
      }
    }
  }

  // ---------------- R5: Tendência Descendente ----------------
  {
    if (idx >= R5_WINDOW) {
      const janela = sorted.slice(idx - (R5_WINDOW - 1), idx + 1);
      const n = janela.length;
      const xs = janela.map((_, i) => i);
      const ys = janela.map((f) => f.kwh_faturado);
      const sumX = xs.reduce((s, x) => s + x, 0);
      const sumY = ys.reduce((s, y) => s + y, 0);
      const sumXY = xs.reduce((s, x, i) => s + x * ys[i]!, 0);
      const sumX2 = xs.reduce((s, x) => s + x * x, 0);
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      let meses = 0;
      for (let i = janela.length - 1; i > 0; i--) {
        if (janela[i]!.kwh_faturado < janela[i - 1]!.kwh_faturado) meses++;
        else break;
      }
      if (slope < limiar_slope_tendencia && meses >= R5_MIN_MESES_CONSECUTIVOS) {
        const pts = Math.min(
          R5_PONTOS_MAX,
          Math.round(Math.abs(slope - limiar_slope_tendencia) * R5_FACTOR)
        );
        score_base += pts;
        regras.push({
          regra: "R5",
          pontos: pts,
          descricao: `Slow bleed: ${slope.toFixed(1)} kWh/mês por ${meses} meses`,
          valor: slope,
          threshold: limiar_slope_tendencia,
        });
      } else {
        regras.push({
          regra: "R5",
          pontos: 0,
          descricao: "Sem tendência descendente persistente",
        });
      }
    }
  }

  // ---------------- R6: Rácio CVE/kWh ----------------
  {
    // R6 só dispara se cluster tem >= R6_MIN_CLUSTER_SIZE clientes (sigma fiável)
    const sigmaValido = clusterSize >= R6_MIN_CLUSTER_SIZE && sigmaRacio > 0;
    if (kwhAtual > 0 && sigmaValido) {
      const racio = cveAtual / kwhAtual;
      const desvio = Math.abs(racio - mediaRacio) / sigmaRacio;
      if (desvio > limiar_ratio_racio) {
        const pts = Math.min(
          R6_PONTOS_MAX,
          Math.round((desvio - limiar_ratio_racio) * R6_FACTOR)
        );
        score_base += pts;
        regras.push({
          regra: "R6",
          pontos: pts,
          descricao: `Rácio CVE/kWh anómalo (${racio.toFixed(2)} vs ${mediaRacio.toFixed(2)})`,
          valor: desvio,
          threshold: limiar_ratio_racio,
        });
      } else {
        regras.push({
          regra: "R6",
          pontos: 0,
          descricao: "Rácio CVE/kWh normal",
        });
      }
    }
  }

  // ---------------- R7: Reincidência ----------------
  {
    if (alertasAnteriores > 0) {
      score_base += R7_BONUS;
      regras.push({
        regra: "R7",
        pontos: R7_BONUS,
        descricao: `${alertasAnteriores} alerta(s) anterior(es) confirmado(s) — reincidente`,
        valor: alertasAnteriores,
      });
    } else {
      regras.push({ regra: "R7", pontos: 0, descricao: "Sem reincidência" });
    }
  }

  // ---------------- R8: Pico Histórico vs Atual ----------------
  {
    if (idx >= R8_MIN_INDEX) {
      const hist = sorted.slice(Math.max(0, idx - R8_LOOKBACK_MAX), idx);
      const pico = Math.max(...hist.map((f) => f.kwh_faturado));
      const atual = sorted[idx]!.kwh_faturado;
      if (pico > 0) {
        const ratio = atual / pico;
        if (ratio < limiar_pico_ratio) {
          const pts = Math.min(
            R8_PONTOS_MAX,
            Math.round((limiar_pico_ratio - ratio) * R8_FACTOR)
          );
          score_base += pts;
          regras.push({
            regra: "R8",
            pontos: pts,
            descricao: `Atual é ${(ratio * 100).toFixed(1)}% do pico histórico (${pico} kWh)`,
            valor: ratio,
            threshold: limiar_pico_ratio,
          });
        } else {
          regras.push({
            regra: "R8",
            pontos: 0,
            descricao: `Atual é ${(ratio * 100).toFixed(1)}% do pico — normal`,
          });
        }
      }
    }
  }

  // ---------------- R10: Dívida Acumulada ----------------
  {
    if (saldoAtualCve == null || saldoAtualCve < limiar_divida_cve) {
      regras.push({
        regra: "R10",
        pontos: 0,
        descricao: saldoAtualCve == null
          ? "Sem dados de dívida"
          : `Dívida ${saldoAtualCve.toFixed(0)} CVE — abaixo do limiar (${limiar_divida_cve})`,
        valor: saldoAtualCve ?? undefined,
        threshold: limiar_divida_cve,
      });
    } else {
      const pts = Math.min(R10_PONTOS_MAX, Math.round((saldoAtualCve - limiar_divida_cve) * R10_FACTOR));
      score_base += pts;
      regras.push({
        regra: "R10",
        pontos: pts,
        descricao: `Dívida acumulada ${saldoAtualCve.toFixed(0)} CVE — incentivo financeiro elevado`,
        valor: saldoAtualCve,
        threshold: limiar_divida_cve,
      });
    }
  }

  // ---------------- R11: Leitura Estimada Recorrente ----------------
  {
    if (!tiposLeituraRecentes || tiposLeituraRecentes.length < R11_MESES_MIN_ESTIMADA) {
      regras.push({ regra: "R11", pontos: 0, descricao: "Sem histórico suficiente de tipos de leitura" });
    } else {
      let consecutivos = 0;
      for (const t of tiposLeituraRecentes) {
        if (t === "estimada") consecutivos++;
        else break;
      }
      if (consecutivos >= R11_MESES_MIN_ESTIMADA) {
        score_base += R11_PONTOS;
        regras.push({
          regra: "R11",
          pontos: R11_PONTOS,
          descricao: `${consecutivos} meses consecutivos com leitura estimada — possível recusa de acesso`,
          valor: consecutivos,
          threshold: R11_MESES_MIN_ESTIMADA,
        });
      } else {
        regras.push({
          regra: "R11",
          pontos: 0,
          descricao: `Apenas ${consecutivos} meses consecutivos estimados — abaixo do limiar`,
        });
      }
    }
  }

  // ---------------- R12: Subutilização de Potência ----------------
  {
    if (potenciaContratadaWatts == null || potenciaContratadaWatts <= 0) {
      regras.push({ regra: "R12", pontos: 0, descricao: "Sem dados de potência contratada" });
    } else {
      const potenciaKw = potenciaContratadaWatts / 1000;
      const capacidadeMensal = potenciaKw * 24 * 30;
      const usoPct = capacidadeMensal > 0 ? (kwhAtual / capacidadeMensal) * 100 : 0;
      if (usoPct >= r12_threshold_pct) {
        regras.push({
          regra: "R12",
          pontos: 0,
          descricao: `Uso ${usoPct.toFixed(2)}% da capacidade contratada — normal`,
          valor: usoPct,
          threshold: r12_threshold_pct,
        });
      } else {
        const pts = Math.min(R12_PONTOS_MAX, Math.round((r12_threshold_pct - usoPct) * 5));
        score_base += pts;
        regras.push({
          regra: "R12",
          pontos: pts,
          descricao: `Apenas ${usoPct.toFixed(2)}% da capacidade contratada (${potenciaKw.toFixed(1)} kW) — subutilização anormal`,
          valor: usoPct,
          threshold: r12_threshold_pct,
        });
      }
    }
  }

  // R9: multiplicador de zona (já calculado upstream a partir do balanço)
  const score_final = Math.min(SCORE_MAX, Math.round(score_base * multiplicadorZona));

  return { regras, score_base, score_final };
}
