/**
 * Teste de Paridade: engine.ts (Next.js) ↔ scoring-engine/pure.ts (Edge Function)
 *
 * Objetivo (point #1 da análise de pontos frágeis):
 *   "Adicionar teste Vitest que executa as duas implementações no mesmo input
 *    fixture e falha se divergirem."
 *
 * Cobre:
 *   1. PARIDADE DE CONSTANTES — todas as constantes de
 *      `src/modules/scoring/constants.ts` têm valor idêntico em
 *      `supabase/functions/_shared/scoring-constants.ts`. Se um lado mudar
 *      sem o outro, este teste falha.
 *
 *   2. PARIDADE DE SCORING — a função `calcularScore` (engine.ts) e
 *      `calcularScoreEdge` (pure.ts) produzem `score_final` idêntico em
 *      múltiplas fixtures (cliente normal, fraude clássica, slow bleed,
 *      pico histórico, reincidente, casa vazia, zona vermelha extrema).
 *
 * Atenção: as descrições/strings podem divergir (cosmético) mas os scores
 * NUNCA podem divergir — é isso que causa alertas inconsistentes em produção.
 */

import { describe, it, expect } from "vitest";

import * as constsCanonicas from "@/modules/scoring/constants";
import * as constsEdgeMirror from "../../supabase/functions/_shared/scoring-constants.ts";

import {
  calcularScore,
  type ClienteData,
  type ClusterInfo,
  type FaturacaoMensal,
  type Limiares,
} from "@/modules/scoring/rules/engine";
import {
  calcularScoreEdge,
  type ScoreInputEdge,
} from "../../supabase/functions/scoring-engine/pure.ts";

// ---------------------------------------------------------------------------
// 1. PARIDADE DE CONSTANTES
// ---------------------------------------------------------------------------

describe("scoring constants — paridade entre canónico e mirror Deno", () => {
  // Snapshot estável das chaves numéricas. Se alguém adicionar uma constante
  // só num lado, este array fica desactualizado e o teste de equality falha.
  const CHAVES_NUMERICAS = [
    "LIMIAR_QUEDA_PCT",
    "LIMIAR_CV_MAXIMO",
    "LIMIAR_MU_MINIMO",
    "LIMIAR_ZSCORE_CLUSTER",
    "LIMIAR_DIV_SAZONAL",
    "LIMIAR_SLOPE_TENDENCIA",
    "LIMIAR_RATIO_RACIO",
    "LIMIAR_PICO_RATIO",
    "LIMIAR_PERDA_ZONA_PCT",
    "R1_WINDOW_MAX",
    "R1_MIN_INDEX",
    "R1_PONTOS_MAX",
    "R1_FACTOR",
    "R2_WINDOW",
    "R2_PONTOS_MAX",
    "R3_PONTOS_MAX",
    "R3_FACTOR",
    "R4_PONTOS_MAX",
    "R4_FACTOR",
    "R5_WINDOW",
    "R5_MIN_MESES_CONSECUTIVOS",
    "R5_PONTOS_MAX",
    "R5_FACTOR",
    "R6_MIN_CLUSTER_SIZE",
    "R6_PONTOS_MAX",
    "R6_FACTOR",
    "R7_BONUS",
    "R7_LOOKBACK_MESES",
    "R8_MIN_INDEX",
    "R8_LOOKBACK_MAX",
    "R8_PONTOS_MAX",
    "R8_FACTOR",
    "R9_MULT_BASE",
    "R9_MULT_MAX_DELTA",
    "R9_MULT_FACTOR",
    "SCORE_MAX",
    "SCORE_LIMIAR_ALERTA",
    "TARIFA_FALLBACK_CVE_KWH",
  ] as const;

  // Constantes não-numéricas (arrays/objetos) — comparação deep
  const CHAVES_ESTRUTURADAS = ["RESULTADOS_REINCIDENCIA"] as const;

  it("ambos os ficheiros exportam exactamente as mesmas chaves", () => {
    const chavesCanonico = Object.keys(constsCanonicas).sort();
    const chavesEdge = Object.keys(constsEdgeMirror).sort();
    expect(chavesEdge).toEqual(chavesCanonico);
  });

  it("o conjunto de chaves corresponde à lista esperada (detecta esquecimentos)", () => {
    const chavesCanonico = Object.keys(constsCanonicas).sort();
    const esperadas = [...CHAVES_NUMERICAS, ...CHAVES_ESTRUTURADAS].sort();
    expect(chavesCanonico).toEqual(esperadas);
  });

  it.each(CHAVES_NUMERICAS)(
    "constante %s tem o mesmo valor em ambos os ficheiros",
    (chave) => {
      const v1 = (constsCanonicas as unknown as Record<string, number>)[chave];
      const v2 = (constsEdgeMirror as unknown as Record<string, number>)[chave];
      expect(v2).toBe(v1);
    }
  );

  it.each(CHAVES_ESTRUTURADAS)(
    "constante estruturada %s é deep-equal entre os dois ficheiros",
    (chave) => {
      const v1 = (constsCanonicas as Record<string, unknown>)[chave];
      const v2 = (constsEdgeMirror as Record<string, unknown>)[chave];
      expect(v2).toEqual(v1);
    }
  );
});

// ---------------------------------------------------------------------------
// 2. PARIDADE DE SCORING — fixtures partilhadas
// ---------------------------------------------------------------------------

function genMeses(startMes: string, n: number): string[] {
  const [y, m] = startMes.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const month = ((m - 1 + i) % 12) + 1;
    const year = y + Math.floor((m - 1 + i) / 12);
    return `${year}-${String(month).padStart(2, "0")}`;
  });
}

function mkFaturacao(
  kwhValues: number[],
  pricePerKwh = 25,
  startMes = "2024-01"
): FaturacaoMensal[] {
  const meses = genMeses(startMes, kwhValues.length);
  return meses.map((mes_ano, i) => ({
    mes_ano,
    kwh_faturado: kwhValues[i],
    valor_cve: kwhValues[i] * pricePerKwh,
  }));
}

interface ParityFixture {
  nome: string;
  faturacao: FaturacaoMensal[];
  mesAtual: string;
  cluster: ClusterInfo;
  /** Tamanho do cluster (para R6_MIN_CLUSTER_SIZE no edge) */
  clusterSize: number;
  alertasAnteriores: number;
  multiplicadorZona: number;
  /** Limiares parciais para fazer override de defaults */
  limiares?: Limiares;
}

function buildEdgeInput(f: ParityFixture): ScoreInputEdge {
  const faturacaoAtual = f.faturacao.find((x) => x.mes_ano === f.mesAtual);
  if (!faturacaoAtual) {
    throw new Error(`fixture "${f.nome}": mês ${f.mesAtual} não existe`);
  }
  return {
    faturacao: f.faturacao,
    mesAtual: f.mesAtual,
    kwhAtual: faturacaoAtual.kwh_faturado,
    cveAtual: faturacaoAtual.valor_cve,
    medianaCluster: f.cluster.mediana,
    madCluster: f.cluster.mad,
    mediaRacio: f.cluster.media_racio_cve_kwh,
    sigmaRacio: f.cluster.sigma_racio_cve_kwh,
    clusterSize: f.clusterSize,
    tendenciaSubestacao: f.cluster.tendencia_subestacao_pct,
    alertasAnteriores: f.alertasAnteriores,
    multiplicadorZona: f.multiplicadorZona,
  };
}

function buildClienteEngine(f: ParityFixture): ClienteData {
  return {
    id: `parity-${f.nome}`,
    numero_contador: `CONT-${f.nome}`,
    nome_titular: f.nome,
    tipo_tarifa: "Residencial",
    id_subestacao: "sub-parity",
    faturacao: f.faturacao,
    alertas_anteriores: f.alertasAnteriores,
  };
}

const FIXTURES: ParityFixture[] = [
  {
    nome: "cliente-normal-zona-verde",
    faturacao: mkFaturacao([100, 110, 95, 105, 100, 108, 102, 99, 101, 98, 103, 100]),
    mesAtual: "2024-12",
    cluster: {
      mediana: 100,
      mad: 15,
      media_racio_cve_kwh: 25,
      sigma_racio_cve_kwh: 5,
      tendencia_subestacao_pct: 2,
    },
    clusterSize: 20,
    alertasAnteriores: 0,
    multiplicadorZona: 1.0,
  },
  {
    nome: "fraude-classica-queda-subita",
    faturacao: mkFaturacao([
      150, 160, 155, 165, 158, 162, 160, 155, 161, 158, 162, 30,
    ]),
    mesAtual: "2024-12",
    cluster: {
      mediana: 150,
      mad: 20,
      media_racio_cve_kwh: 25,
      sigma_racio_cve_kwh: 5,
      tendencia_subestacao_pct: 5,
    },
    clusterSize: 15,
    alertasAnteriores: 0,
    multiplicadorZona: 1.2,
  },
  {
    nome: "slow-bleed-tendencia-descendente",
    faturacao: mkFaturacao([200, 180, 160, 140, 120, 100, 80, 60, 40, 30, 25, 20]),
    mesAtual: "2024-12",
    cluster: {
      mediana: 100,
      mad: 30,
      media_racio_cve_kwh: 25,
      sigma_racio_cve_kwh: 5,
      tendencia_subestacao_pct: 0,
    },
    clusterSize: 12,
    alertasAnteriores: 1,
    multiplicadorZona: 1.15,
  },
  {
    nome: "contador-travado-cv-zero",
    faturacao: mkFaturacao([
      100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
    ]),
    mesAtual: "2024-12",
    cluster: {
      mediana: 100,
      mad: 10,
      media_racio_cve_kwh: 25,
      sigma_racio_cve_kwh: 5,
      tendencia_subestacao_pct: 0,
    },
    clusterSize: 10,
    alertasAnteriores: 0,
    multiplicadorZona: 1.0,
  },
  {
    nome: "casa-vazia-consumo-baixo",
    faturacao: mkFaturacao([12, 10, 11, 13, 9, 12, 10, 11, 12, 10, 11, 12]),
    mesAtual: "2024-12",
    cluster: {
      mediana: 100,
      mad: 30,
      media_racio_cve_kwh: 25,
      sigma_racio_cve_kwh: 5,
      tendencia_subestacao_pct: 0,
    },
    clusterSize: 10,
    alertasAnteriores: 0,
    multiplicadorZona: 1.0,
  },
  {
    nome: "pico-historico-bypass-estabilizado",
    faturacao: mkFaturacao([400, 410, 395, 405, 400, 50, 45, 48, 50, 47, 49, 48]),
    mesAtual: "2024-12",
    cluster: {
      mediana: 100,
      mad: 30,
      media_racio_cve_kwh: 25,
      sigma_racio_cve_kwh: 5,
      tendencia_subestacao_pct: 0,
    },
    clusterSize: 15,
    alertasAnteriores: 0,
    multiplicadorZona: 1.0,
  },
  {
    nome: "reincidente-com-divergencia",
    faturacao: mkFaturacao([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 50]),
    mesAtual: "2024-12",
    cluster: {
      mediana: 100,
      mad: 20,
      media_racio_cve_kwh: 25,
      sigma_racio_cve_kwh: 5,
      tendencia_subestacao_pct: 30,
    },
    clusterSize: 18,
    alertasAnteriores: 3,
    multiplicadorZona: 1.3,
  },
  {
    nome: "zona-vermelha-extrema-mult-cap",
    faturacao: mkFaturacao([200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 10]),
    mesAtual: "2024-12",
    cluster: {
      mediana: 200,
      mad: 25,
      media_racio_cve_kwh: 25,
      sigma_racio_cve_kwh: 5,
      tendencia_subestacao_pct: 10,
    },
    clusterSize: 25,
    alertasAnteriores: 2,
    multiplicadorZona: 1.3, // cap máximo
  },
  {
    nome: "limiar-personalizado-via-configuracoes",
    faturacao: mkFaturacao([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 70]),
    mesAtual: "2024-12",
    cluster: {
      mediana: 100,
      mad: 15,
      media_racio_cve_kwh: 25,
      sigma_racio_cve_kwh: 5,
      tendencia_subestacao_pct: 0,
    },
    clusterSize: 12,
    alertasAnteriores: 0,
    multiplicadorZona: 1.1,
    limiares: {
      limiar_queda_pct: 25, // override mais sensível
      limiar_pico_ratio: 0.3,
    },
  },
  {
    nome: "historico-curto-3-meses",
    faturacao: mkFaturacao([100, 100, 50]),
    mesAtual: "2024-03",
    cluster: {
      mediana: 100,
      mad: 15,
      media_racio_cve_kwh: 25,
      sigma_racio_cve_kwh: 5,
      tendencia_subestacao_pct: 0,
    },
    clusterSize: 10,
    alertasAnteriores: 0,
    multiplicadorZona: 1.1,
  },
];

describe("scoring logic — paridade engine.ts ↔ pure.ts (edge function)", () => {
  it.each(FIXTURES)(
    "fixture '$nome': score_final é idêntico nas duas implementações",
    (fixture) => {
      const cliente = buildClienteEngine(fixture);
      const edgeInput = buildEdgeInput(fixture);

      const resultEngine = calcularScore(
        cliente,
        fixture.mesAtual,
        fixture.multiplicadorZona,
        fixture.cluster,
        fixture.limiares ?? {}
      );

      const resultEdge = calcularScoreEdge(edgeInput, fixture.limiares ?? {});

      expect(resultEdge.score_final).toBe(resultEngine.score_final);
      expect(resultEdge.score_base).toBe(resultEngine.score_base);
    }
  );

  it.each(FIXTURES)(
    "fixture '$nome': pontos por regra (R1-R8) são idênticos",
    (fixture) => {
      const cliente = buildClienteEngine(fixture);
      const edgeInput = buildEdgeInput(fixture);

      const resultEngine = calcularScore(
        cliente,
        fixture.mesAtual,
        fixture.multiplicadorZona,
        fixture.cluster,
        fixture.limiares ?? {}
      );
      const resultEdge = calcularScoreEdge(edgeInput, fixture.limiares ?? {});

      const pontosEngine = Object.fromEntries(
        resultEngine.regras.map((r) => [r.regra, r.pontos])
      );
      const pontosEdge = Object.fromEntries(
        resultEdge.regras.map((r) => [r.regra, r.pontos])
      );

      // O edge function omite regras quando dados são insuficientes (em vez de
      // emitir um item com pontos=0). Por isso comparamos só as regras presentes
      // em ambos. As omissões em si não alteram o score, que já é validado acima.
      const regrasEmComum = Object.keys(pontosEdge).filter(
        (r) => r in pontosEngine
      );
      for (const regra of regrasEmComum) {
        expect(pontosEdge[regra]).toBe(pontosEngine[regra]);
      }
    }
  );
});
