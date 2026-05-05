/**
 * Testes do Motor de Scoring — 9 Regras
 * Cobertura: mediana, mad, calcularBalanco, calcularScore (R1–R9)
 */
import { describe, it, expect } from "vitest";
import {
  mediana,
  mad,
  calcularBalanco,
  calcularScore,
} from "@/modules/scoring/rules/engine";
import type {
  FaturacaoMensal,
  ClienteData,
  ClusterInfo,
} from "@/modules/scoring/rules/engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkf(mes_ano: string, kwh: number, pricePerKwh = 25): FaturacaoMensal {
  return { mes_ano, kwh_faturado: kwh, valor_cve: kwh * pricePerKwh };
}

/** Gera N meses consecutivos a partir de startMes ('YYYY-MM') */
function genMeses(startMes: string, n: number): string[] {
  const [y, m] = startMes.split("-").map(Number) as [number, number];
  return Array.from({ length: n }, (_, i) => {
    const month = ((m - 1 + i) % 12) + 1;
    const year = y + Math.floor((m - 1 + i) / 12);
    return `${year}-${String(month).padStart(2, "0")}`;
  });
}

/** Cliente base com N meses de faturação, todos com o mesmo kWh */
function makeCliente(
  kwhValues: number[],
  alertasAnteriores = 0,
  startMes = "2024-01",
  pricePerKwh = 25
): ClienteData {
  const meses = genMeses(startMes, kwhValues.length);
  return {
    id: "cli-001",
    numero_contador: "CONT-001",
    nome_titular: "Teste",
    tipo_tarifa: "Residencial",
    id_subestacao: "sub-001",
    faturacao: meses.map((m, i) => mkf(m, kwhValues[i]!, pricePerKwh)),
    alertas_anteriores: alertasAnteriores,
  };
}

/** ClusterInfo neutro — não dispara R3, R4, R6 quando consumo = referencia */
function clusterNeutro(
  referencia: number,
  tendenciaSubestacao = 0
): ClusterInfo {
  return {
    mediana: referencia,
    mad: 20,
    media_racio_cve_kwh: 25,
    sigma_racio_cve_kwh: 10,
    tendencia_subestacao_pct: tendenciaSubestacao,
  };
}

// ---------------------------------------------------------------------------
// mediana()
// ---------------------------------------------------------------------------

describe("mediana", () => {
  it("retorna 0 para array vazio", () => {
    expect(mediana([])).toBe(0);
  });

  it("retorna o único elemento para array de tamanho 1", () => {
    expect(mediana([42])).toBe(42);
  });

  it("retorna o valor central para array ímpar", () => {
    // sorted: [1,1,3,4,5] → mid=2 → 3
    expect(mediana([3, 1, 4, 1, 5])).toBe(3);
  });

  it("retorna a média dos dois centrais para array par", () => {
    // sorted: [2,4,6,8] → (4+6)/2 = 5
    expect(mediana([4, 2, 6, 8])).toBe(5);
  });

  it("lida com valores todos iguais", () => {
    expect(mediana([7, 7, 7, 7])).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// mad()
// ---------------------------------------------------------------------------

describe("mad", () => {
  it("retorna 0 quando todos os valores são iguais", () => {
    expect(mad([5, 5, 5, 5])).toBe(0);
  });

  it("calcula MAD corretamente para [1,3,5,7]", () => {
    // mediana = 4, deviations = [3,1,1,3], mad = mediana([1,1,3,3]) = 2
    expect(mad([1, 3, 5, 7])).toBe(2);
  });

  it("aceita mediana pré-calculada", () => {
    // mediana = 4, passada externamente
    expect(mad([1, 3, 5, 7], 4)).toBe(2);
  });

  it("retorna 0 para array de 1 elemento", () => {
    expect(mad([10])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calcularBalanco()
// ---------------------------------------------------------------------------

describe("calcularBalanco", () => {
  it("zona verde: perda < limiar → multiplicador = 1.0", () => {
    // perda = (1000-880)/1000 * 100 = 12%
    const r = calcularBalanco(1000, 880);
    expect(r.perda_percentual).toBeCloseTo(12, 5);
    expect(r.zona_vermelha).toBe(false);
    expect(r.multiplicador).toBe(1.0);
  });

  it("zona vermelha simples → multiplicador correto", () => {
    // perda = 20%, limiar = 15%
    // multiplicador = 1 + min(0.3, (0.20 - 0.15) * 2) = 1.1
    const r = calcularBalanco(1000, 800);
    expect(r.perda_percentual).toBeCloseTo(20, 5);
    expect(r.zona_vermelha).toBe(true);
    expect(r.multiplicador).toBeCloseTo(1.1, 5);
  });

  it("zona vermelha com multiplicador máximo (cap 1.3)", () => {
    // perda = 45%, multiplicador = 1 + min(0.3, (0.45 - 0.15)*2) = 1 + min(0.3, 0.6) = 1.3
    const r = calcularBalanco(1000, 550);
    expect(r.zona_vermelha).toBe(true);
    expect(r.multiplicador).toBeCloseTo(1.3, 5);
  });

  it("injeção zero → perda = 0, zona verde", () => {
    const r = calcularBalanco(0, 500);
    expect(r.perda_percentual).toBe(0);
    expect(r.zona_vermelha).toBe(false);
    expect(r.multiplicador).toBe(1.0);
  });

  it("perda exactamente igual ao limiar → zona verde", () => {
    // perda = 15%, limiar padrão = 15% → NOT > 15 → zona verde
    const r = calcularBalanco(1000, 850);
    expect(r.perda_percentual).toBeCloseTo(15, 5);
    expect(r.zona_vermelha).toBe(false);
  });

  it("aceita limiar personalizado", () => {
    // perda = 12%, limiar = 10% → zona vermelha
    const r = calcularBalanco(1000, 880, 10);
    expect(r.zona_vermelha).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// R1: Queda Súbita Graduada (0–25 pts)
// ---------------------------------------------------------------------------

describe("calcularScore — R1 queda súbita", () => {
  // 12 meses estáveis em 100 kWh, mesAtual = 2024-12 (idx=11)
  // historico (6 meses) = [100,100,100,100,100,100], media = 100

  const mesAtual = "2024-12";

  it("pontos = 0 quando queda < limiar (20%)", () => {
    const cliente = makeCliente(
      [...Array(11).fill(100), 80] // delta = 20% < 30%
    );
    const result = calcularScore(cliente, mesAtual, 1.0, clusterNeutro(80));
    const r1 = result.regras.find((r) => r.regra === "R1")!;
    expect(r1.pontos).toBe(0);
  });

  it("pontos = 10 para queda de 46% (acima do limiar)", () => {
    // delta = (100-54)/100*100 = 46%
    // pontos = min(25, floor((46-30)*0.625)) = floor(10) = 10
    const cliente = makeCliente([...Array(11).fill(100), 54]);
    const result = calcularScore(cliente, mesAtual, 1.0, clusterNeutro(54));
    const r1 = result.regras.find((r) => r.regra === "R1")!;
    expect(r1.pontos).toBe(10);
  });

  it("pontos máximos = 25 para queda de 90%", () => {
    // delta = 90%, pontos = min(25, floor(60*0.625)) = 25
    const cliente = makeCliente([...Array(11).fill(100), 10]);
    const result = calcularScore(cliente, mesAtual, 1.0, clusterNeutro(10));
    const r1 = result.regras.find((r) => r.regra === "R1")!;
    expect(r1.pontos).toBe(25);
  });

  it("pontos = 0 quando dados insuficientes (< 3 meses)", () => {
    // idx=1 < 3 → dados insuficientes
    const cliente = makeCliente([100, 50]);
    const result = calcularScore(cliente, "2024-02", 1.0, clusterNeutro(50));
    const r1 = result.regras.find((r) => r.regra === "R1")!;
    expect(r1.pontos).toBe(0);
    expect(r1.descricao).toMatch(/insuficiente/i);
  });
});

// ---------------------------------------------------------------------------
// R2: Variância Zero Contextualizada (0–15 pts)
// ---------------------------------------------------------------------------

describe("calcularScore — R2 consumo constante", () => {
  it("pontos = 0 quando dados insuficientes (< 4 meses)", () => {
    const cliente = makeCliente([100, 100, 100]); // idx=2 < 4
    const result = calcularScore(cliente, "2024-03", 1.0, clusterNeutro(100));
    const r2 = result.regras.find((r) => r.regra === "R2")!;
    expect(r2.pontos).toBe(0);
  });

  it("pontos = 15 para consumo perfeitamente constante (CV=0)", () => {
    // 6 meses a 100 kWh, janela [2024-03..2024-06] = [100,100,100,100]
    // media=100, sigma=0, CV=0 → pontos=min(15, round(15)) = 15
    const cliente = makeCliente([...Array(6).fill(100)]);
    const result = calcularScore(cliente, "2024-06", 1.0, clusterNeutro(100));
    const r2 = result.regras.find((r) => r.regra === "R2")!;
    expect(r2.pontos).toBe(15);
  });

  it("pontos = 0 para consumo com variação normal (CV alto)", () => {
    // janela última 4 meses: [60,120,90,110] → CV ≈ 0.241 > 0.03
    const cliente = makeCliente([50, 80, 60, 120, 90, 110]);
    const result = calcularScore(cliente, "2024-06", 1.0, clusterNeutro(110));
    const r2 = result.regras.find((r) => r.regra === "R2")!;
    expect(r2.pontos).toBe(0);
  });

  it("pontos = 0 quando consumo médio ≤ 15 kWh (casa vazia)", () => {
    const cliente = makeCliente([...Array(6).fill(10)]); // media=10 ≤ 15
    const result = calcularScore(cliente, "2024-06", 1.0, clusterNeutro(10));
    const r2 = result.regras.find((r) => r.regra === "R2")!;
    expect(r2.pontos).toBe(0);
    expect(r2.descricao).toMatch(/muito baixo/i);
  });
});

// ---------------------------------------------------------------------------
// R3: Desvio de Cluster Segmentado (0–20 pts)
// ---------------------------------------------------------------------------

describe("calcularScore — R3 desvio de cluster", () => {
  const mesAtual = "2024-12";

  it("pontos = 0 quando MAD do cluster = 0", () => {
    const cliente = makeCliente([...Array(12).fill(100)]);
    const result = calcularScore(cliente, mesAtual, 1.0, {
      ...clusterNeutro(100),
      mad: 0,
    });
    const r3 = result.regras.find((r) => r.regra === "R3")!;
    expect(r3.pontos).toBe(0);
    expect(r3.descricao).toMatch(/MAD.*0/i);
  });

  it("pontos = 0 quando Z-score ≥ -2 (dentro do esperado)", () => {
    // consumo=90, mediana=100, mad=10 → z = -1 ≥ -2
    const cliente = makeCliente([...Array(11).fill(100), 90]);
    const result = calcularScore(cliente, mesAtual, 1.0, {
      ...clusterNeutro(100),
      mediana: 100,
      mad: 10,
    });
    const r3 = result.regras.find((r) => r.regra === "R3")!;
    expect(r3.pontos).toBe(0);
  });

  it("pontos = 15 quando Z-score = -5", () => {
    // consumo=50, mediana=100, mad=10 → z = -5
    // pontos = min(20, round(|-5-(-2)|*5)) = min(20, 15) = 15
    const cliente = makeCliente([...Array(11).fill(100), 50]);
    const result = calcularScore(cliente, mesAtual, 1.0, {
      ...clusterNeutro(100),
      mediana: 100,
      mad: 10,
    });
    const r3 = result.regras.find((r) => r.regra === "R3")!;
    expect(r3.pontos).toBe(15);
  });

  it("pontos máximos = 20 quando Z-score muito negativo", () => {
    // consumo=10, mediana=100, mad=10 → z = -9
    // pontos = min(20, round(7*5)) = 20
    const cliente = makeCliente([...Array(11).fill(100), 10]);
    const result = calcularScore(cliente, mesAtual, 1.0, {
      ...clusterNeutro(100),
      mediana: 100,
      mad: 10,
    });
    const r3 = result.regras.find((r) => r.regra === "R3")!;
    expect(r3.pontos).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// R4: Divergência Sazonal (0–15 pts)
// ---------------------------------------------------------------------------

describe("calcularScore — R4 divergência sazonal", () => {
  it("pontos = 0 com dados insuficientes (apenas 1 mês)", () => {
    const cliente = makeCliente([100]);
    const result = calcularScore(cliente, "2024-01", 1.0, clusterNeutro(100));
    const r4 = result.regras.find((r) => r.regra === "R4")!;
    expect(r4.pontos).toBe(0);
  });

  it("pontos = 0 quando divergência ≤ limiar", () => {
    // atual=100, anterior=90 → tendenciaCliente=+11.1%
    // tendenciaSubestacao=+15% → divergencia = 15-11.1 = 3.9 ≤ 20
    const cliente = makeCliente([90, 100]);
    const result = calcularScore(cliente, "2024-02", 1.0, {
      ...clusterNeutro(100),
      tendencia_subestacao_pct: 15,
    });
    const r4 = result.regras.find((r) => r.regra === "R4")!;
    expect(r4.pontos).toBe(0);
  });

  it("pontos = 15 (máximo) para grande divergência", () => {
    // 3 meses: [100, 100, 60] → mesAtual='2024-03' (idx=2 ≥ 2 ✓)
    // atual=60, anterior=100 → tendenciaCliente=-40%
    // tendenciaSubestacao=+30% → divergencia = 30-(-40) = 70 > 20
    // pontos = min(15, round((70-20)*0.5)) = min(15, 25) = 15
    const cliente = makeCliente([100, 100, 60]);
    const result = calcularScore(cliente, "2024-03", 1.0, {
      ...clusterNeutro(60),
      tendencia_subestacao_pct: 30,
    });
    const r4 = result.regras.find((r) => r.regra === "R4")!;
    expect(r4.pontos).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// R5: Tendência Descendente Persistente (0–10 pts)
// ---------------------------------------------------------------------------

describe("calcularScore — R5 tendência descendente", () => {
  it("pontos = 0 com dados insuficientes (< 6 meses)", () => {
    const cliente = makeCliente([100, 90, 80, 70, 60]); // idx=4 < 6
    const result = calcularScore(cliente, "2024-05", 1.0, clusterNeutro(60));
    const r5 = result.regras.find((r) => r.regra === "R5")!;
    expect(r5.pontos).toBe(0);
  });

  it("pontos = 0 sem padrão de queda (meses consecutivos < 3)", () => {
    // Valores oscilantes — sem tendência clara
    const cliente = makeCliente([100, 120, 90, 110, 80, 105, 100]);
    const result = calcularScore(cliente, "2024-07", 1.0, clusterNeutro(100));
    const r5 = result.regras.find((r) => r.regra === "R5")!;
    expect(r5.pontos).toBe(0);
  });

  it("pontos = 4 para tendência descendente persistente (slope = -10)", () => {
    // [100,90,80,70,60,50,40], janela = [90,80,70,60,50,40], slope = -10
    // mesesConsecutivos = 5 ≥ 3 ✓
    // pontos = min(10, round(|(-10)-(-5)|*0.8)) = min(10, 4) = 4
    const cliente = makeCliente([100, 90, 80, 70, 60, 50, 40]);
    const result = calcularScore(cliente, "2024-07", 1.0, {
      ...clusterNeutro(40),
      tendencia_subestacao_pct: -((40 - 50) / 50) * 100, // match client trend → no R4
    });
    const r5 = result.regras.find((r) => r.regra === "R5")!;
    expect(r5.pontos).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// R6: Rácio CVE/kWh anómalo (0–5 pts)
// ---------------------------------------------------------------------------

describe("calcularScore — R6 rácio CVE/kWh", () => {
  const mesAtual = "2024-12";

  it("pontos = 0 quando kwh_faturado = 0", () => {
    const cliente = makeCliente([...Array(11).fill(100), 0]);
    const result = calcularScore(cliente, mesAtual, 1.0, clusterNeutro(0));
    const r6 = result.regras.find((r) => r.regra === "R6")!;
    expect(r6.pontos).toBe(0);
  });

  it("pontos = 0 para rácio normal", () => {
    // kwh=100, valor_cve=2500 → rácio=25, media=25, sigma=10 → desvio=0
    const cliente = makeCliente([...Array(12).fill(100)], 0, "2024-01", 25);
    const result = calcularScore(cliente, mesAtual, 1.0, {
      ...clusterNeutro(100),
      media_racio_cve_kwh: 25,
      sigma_racio_cve_kwh: 10,
    });
    const r6 = result.regras.find((r) => r.regra === "R6")!;
    expect(r6.pontos).toBe(0);
  });

  it("pontos = 2 para rácio anómalo (desvio = 3)", () => {
    // kwh=100, valor_cve=4000 → rácio=40
    // mediaRacio=25, sigma=5 → desvio=|40-25|/5=3 > 2
    // pontos = min(5, round((3-2)*2)) = 2
    const cliente = makeCliente([...Array(11).fill(100), 100], 0, "2024-01", 40);
    const result = calcularScore(cliente, mesAtual, 1.0, {
      ...clusterNeutro(100),
      media_racio_cve_kwh: 25,
      sigma_racio_cve_kwh: 5,
    });
    const r6 = result.regras.find((r) => r.regra === "R6")!;
    expect(r6.pontos).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// R7: Reincidência (+5 pts bónus)
// ---------------------------------------------------------------------------

describe("calcularScore — R7 reincidência", () => {
  const mesAtual = "2024-12";

  it("pontos = 0 sem alertas anteriores", () => {
    const cliente = makeCliente([...Array(12).fill(100)], 0);
    const result = calcularScore(cliente, mesAtual, 1.0, clusterNeutro(100));
    const r7 = result.regras.find((r) => r.regra === "R7")!;
    expect(r7.pontos).toBe(0);
  });

  it("pontos = 5 com alertas anteriores confirmados", () => {
    const cliente = makeCliente([...Array(12).fill(100)], 2); // 2 alertas
    const result = calcularScore(cliente, mesAtual, 1.0, clusterNeutro(100));
    const r7 = result.regras.find((r) => r.regra === "R7")!;
    expect(r7.pontos).toBe(5);
    expect(r7.descricao).toMatch(/reincidente/i);
  });
});

// ---------------------------------------------------------------------------
// R8: Rácio Pico Histórico vs Atual (0–5 pts)
// ---------------------------------------------------------------------------

describe("calcularScore — R8 pico histórico", () => {
  it("pontos = 0 com histórico insuficiente (< 6 meses)", () => {
    const cliente = makeCliente([100, 80, 60, 40, 20]); // idx=4 < 6
    const result = calcularScore(cliente, "2024-05", 1.0, clusterNeutro(20));
    const r8 = result.regras.find((r) => r.regra === "R8")!;
    expect(r8.pontos).toBe(0);
  });

  it("pontos = 0 quando consumo atual ≥ 20% do pico", () => {
    // pico=100 (historico), atual=25 → ratio=0.25 ≥ 0.20
    const cliente = makeCliente([100, 90, 80, 70, 60, 50, 25]);
    const result = calcularScore(cliente, "2024-07", 1.0, clusterNeutro(25));
    const r8 = result.regras.find((r) => r.regra === "R8")!;
    expect(r8.pontos).toBe(0);
  });

  it("pontos = 2 quando consumo atual < 20% do pico (ratio=0.10)", () => {
    // pico=100, atual=10 → ratio=0.10 < 0.20
    // pontos = min(5, round((0.20-0.10)*20)) = min(5, 2) = 2
    const cliente = makeCliente([100, 90, 80, 70, 60, 50, 10]);
    const result = calcularScore(cliente, "2024-07", 1.0, clusterNeutro(10));
    const r8 = result.regras.find((r) => r.regra === "R8")!;
    expect(r8.pontos).toBe(2);
  });

  it("pontos = 4 quando consumo = 2% do pico", () => {
    // ratio=0.02 → pontos = min(5, round((0.20-0.02)*20)) = min(5, round(3.6)) = min(5, 4) = 4
    const cliente = makeCliente([100, 90, 80, 70, 60, 50, 2]);
    const result = calcularScore(cliente, "2024-07", 1.0, clusterNeutro(2));
    const r8 = result.regras.find((r) => r.regra === "R8")!;
    expect(r8.pontos).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// R9: Multiplicador de Zona e cap do score
// ---------------------------------------------------------------------------

describe("calcularScore — R9 multiplicador e limite 100", () => {
  const mesAtual = "2024-12";

  it("multiplicador 1.0 (zona verde) não altera score_base", () => {
    const cliente = makeCliente([...Array(12).fill(100)], 2); // só R7=5
    const result = calcularScore(cliente, mesAtual, 1.0, clusterNeutro(100));
    expect(result.score_base).toBe(result.score_final);
  });

  it("multiplicador zona vermelha (1.1) amplifica o score", () => {
    const cliente = makeCliente([...Array(12).fill(100)], 2); // R7=5
    const result = calcularScore(cliente, mesAtual, 1.1, clusterNeutro(100));
    // score_base=5, score_final=round(5*1.1)=6 (ou 5 dependendo de arredondamento)
    expect(result.score_final).toBeGreaterThanOrEqual(result.score_base);
    expect(result.multiplicador_zona).toBe(1.1);
  });

  it("score_final nunca excede 100", () => {
    // Criar cliente com score alto: R1=25 (queda 90%), R7=5, R3=20
    const cliente = makeCliente([...Array(11).fill(100), 10], 2);
    const result = calcularScore(cliente, mesAtual, 1.3, {
      ...clusterNeutro(100),
      mediana: 100,
      mad: 10,
    });
    expect(result.score_final).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// Casos extremos de calcularScore
// ---------------------------------------------------------------------------

describe("calcularScore — casos extremos", () => {
  it("retorna score 0 quando mês não existe na faturação", () => {
    const cliente = makeCliente([100, 100, 100]);
    const result = calcularScore(
      cliente,
      "2099-01", // mês que não existe
      1.0,
      clusterNeutro(100)
    );
    expect(result.score_base).toBe(0);
    expect(result.score_final).toBe(0);
    expect(result.regras).toHaveLength(0);
  });

  it("resultado contém sempre 8 regras (R1-R8) quando mês existe", () => {
    const cliente = makeCliente([...Array(12).fill(100)]);
    const result = calcularScore(
      cliente,
      "2024-12",
      1.0,
      clusterNeutro(100)
    );
    expect(result.regras).toHaveLength(8);
    const regrasNomes = result.regras.map((r) => r.regra);
    ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"].forEach((r) => {
      expect(regrasNomes).toContain(r);
    });
  });

  it("score_final = min(100, round(score_base * multiplicador))", () => {
    const cliente = makeCliente([...Array(12).fill(100)], 2);
    const multiplicador = 1.2;
    const result = calcularScore(
      cliente,
      "2024-12",
      multiplicador,
      clusterNeutro(100)
    );
    const expected = Math.min(
      100,
      Math.round(result.score_base * multiplicador)
    );
    expect(result.score_final).toBe(expected);
  });
});
