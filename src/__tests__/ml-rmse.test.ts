import { describe, it, expect } from "vitest";
import { calcularRMSE, type ParRMSE } from "../lib/ml/rmse";

describe("calcularRMSE", () => {
  it("returns null rmse and 0 amostras for empty array", () => {
    expect(calcularRMSE([])).toEqual({ rmse: null, n_amostras: 0 });
  });

  it("returns null rmse with nota for 1 sample (< 5)", () => {
    const pares: ParRMSE[] = [{ score_ml: 0.8, y_true: 1 }];
    expect(calcularRMSE(pares)).toEqual({
      rmse: null,
      n_amostras: 1,
      nota: "amostras_insuficientes",
    });
  });

  it("returns null rmse with nota for 4 samples (< 5)", () => {
    const pares: ParRMSE[] = [
      { score_ml: 0.8, y_true: 1 },
      { score_ml: 0.2, y_true: 0 },
      { score_ml: 0.6, y_true: 1 },
      { score_ml: 0.4, y_true: 0 },
    ];
    expect(calcularRMSE(pares)).toEqual({
      rmse: null,
      n_amostras: 4,
      nota: "amostras_insuficientes",
    });
  });

  it("returns rmse ≈ 0 for 5 perfect predictions (score=1.0, y=1)", () => {
    const pares: ParRMSE[] = Array(5).fill({ score_ml: 1.0, y_true: 1 as const });
    const result = calcularRMSE(pares);
    expect(result.n_amostras).toBe(5);
    expect(result.rmse).toBe(0);
  });

  it("returns rmse = 1.0 for all wrong predictions (score=1.0, y=0)", () => {
    const pares: ParRMSE[] = Array(5).fill({ score_ml: 1.0, y_true: 0 as const });
    const result = calcularRMSE(pares);
    expect(result.n_amostras).toBe(5);
    expect(result.rmse).toBe(1.0);
  });

  it("returns rmse = 1.0 for all wrong predictions (score=0.0, y=1)", () => {
    const pares: ParRMSE[] = Array(5).fill({ score_ml: 0.0, y_true: 1 as const });
    const result = calcularRMSE(pares);
    expect(result.n_amostras).toBe(5);
    expect(result.rmse).toBe(1.0);
  });

  it("returns correct rmse for mixed realistic sample", () => {
    // errors² = [0.01, 0.01, 0.04, 0.09, 0.16], mean = 0.062, rmse = sqrt(0.062) ≈ 0.2490
    const pares: ParRMSE[] = [
      { score_ml: 0.9, y_true: 1 },
      { score_ml: 0.1, y_true: 0 },
      { score_ml: 0.8, y_true: 1 },
      { score_ml: 0.3, y_true: 0 },
      { score_ml: 0.6, y_true: 1 },
    ];
    const result = calcularRMSE(pares);
    expect(result.n_amostras).toBe(5);
    expect(result.rmse).toBe(0.249);
  });

  it("returns rmse = 0.5 for 5 identical samples with score=0.5, y=1", () => {
    const pares: ParRMSE[] = Array(5).fill({ score_ml: 0.5, y_true: 1 as const });
    const result = calcularRMSE(pares);
    expect(result.n_amostras).toBe(5);
    expect(result.rmse).toBe(0.5);
  });
});
