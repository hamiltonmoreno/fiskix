/**
 * Testes da função pura attemptAutoPromote — Fiskix
 *
 * Cobre os 4 caminhos:
 *   1. Já está em logistic_v1 → no-op
 *   2. Pesos logistic não existem → no-op
 *   3. Inspeções abaixo do threshold → no-op
 *   4. Tudo OK → promove e escreve config
 *   5. Erro nas dependências → reporta erro sem rebentar
 */

import { describe, it, expect, vi } from "vitest";
import { attemptAutoPromote, type AutoPromoteDeps } from "@/lib/ml/auto-promote";

const PESOS_VALIDOS = JSON.stringify({
  queda_pct: 0.4,
  cv: 0.18,
  zscore: 0.12,
  slope: 0.1,
  ratio_pico: 0.08,
  alertas_12m: 0.07,
  perda_zona: 0.05,
});

function buildDeps(overrides: Partial<AutoPromoteDeps> = {}): AutoPromoteDeps {
  return {
    readConfig: vi.fn(async () => null),
    countInspecoesConfirmadas: vi.fn(async () => 0),
    writeModeloAtivo: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("attemptAutoPromote", () => {
  it("não promove quando ml_modelo_ativo já é logistic_v1 (idempotente)", async () => {
    const writeModeloAtivo = vi.fn();
    const deps = buildDeps({
      readConfig: vi.fn(async (k) => (k === "ml_modelo_ativo" ? "logistic_v1" : null)),
      writeModeloAtivo,
    });

    const result = await attemptAutoPromote(deps);

    expect(result).toEqual({ promoted: false, reason: "already_logistic" });
    expect(writeModeloAtivo).not.toHaveBeenCalled();
  });

  it("não promove quando ml_pesos_v1_logistic não está definido", async () => {
    const writeModeloAtivo = vi.fn();
    const deps = buildDeps({
      readConfig: vi.fn(async (k) => {
        if (k === "ml_modelo_ativo") return "heuristic_v1";
        if (k === "ml_pesos_v1_logistic") return null;
        return null;
      }),
      countInspecoesConfirmadas: vi.fn(async () => 1000), // muitas inspeções, mas sem pesos
      writeModeloAtivo,
    });

    const result = await attemptAutoPromote(deps);

    expect(result).toEqual({ promoted: false, reason: "no_logistic_weights" });
    expect(writeModeloAtivo).not.toHaveBeenCalled();
  });

  it("não promove quando ml_pesos_v1_logistic é JSON inválido", async () => {
    const deps = buildDeps({
      readConfig: vi.fn(async (k) => {
        if (k === "ml_modelo_ativo") return "heuristic_v1";
        if (k === "ml_pesos_v1_logistic") return "not-json{";
        return null;
      }),
      countInspecoesConfirmadas: vi.fn(async () => 200),
    });

    const result = await attemptAutoPromote(deps);

    expect(result).toEqual({ promoted: false, reason: "no_logistic_weights" });
  });

  it("não promove quando ml_pesos_v1_logistic é array (devia ser objecto)", async () => {
    const deps = buildDeps({
      readConfig: vi.fn(async (k) => {
        if (k === "ml_modelo_ativo") return "heuristic_v1";
        if (k === "ml_pesos_v1_logistic") return "[1,2,3]";
        return null;
      }),
      countInspecoesConfirmadas: vi.fn(async () => 200),
    });

    const result = await attemptAutoPromote(deps);

    expect(result).toEqual({ promoted: false, reason: "no_logistic_weights" });
  });

  // Codex P1: Validação granular dos pesos. Antes destes testes, `{}` ou
  // pesos parciais promoviam silenciosamente para logistic_v1 e produziam
  // NaN no scoring → upserts falham → ML pára.

  it("não promove quando ml_pesos_v1_logistic é objecto vazio", async () => {
    const writeModeloAtivo = vi.fn();
    const deps = buildDeps({
      readConfig: vi.fn(async (k) => {
        if (k === "ml_modelo_ativo") return "heuristic_v1";
        if (k === "ml_pesos_v1_logistic") return "{}";
        return null;
      }),
      countInspecoesConfirmadas: vi.fn(async () => 200),
      writeModeloAtivo,
    });

    const result = await attemptAutoPromote(deps);

    expect(result.promoted).toBe(false);
    if (!result.promoted && result.reason === "invalid_logistic_weights") {
      expect(result.missing).toEqual(
        expect.arrayContaining([
          "queda_pct", "cv", "zscore", "slope", "ratio_pico", "alertas_12m", "perda_zona",
        ])
      );
      expect(result.non_finite).toEqual([]);
    } else {
      throw new Error(`Expected reason="invalid_logistic_weights", got ${JSON.stringify(result)}`);
    }
    expect(writeModeloAtivo).not.toHaveBeenCalled();
  });

  it("não promove quando ml_pesos_v1_logistic tem apenas alguns dos keys requeridos", async () => {
    const writeModeloAtivo = vi.fn();
    const deps = buildDeps({
      readConfig: vi.fn(async (k) => {
        if (k === "ml_modelo_ativo") return "heuristic_v1";
        if (k === "ml_pesos_v1_logistic")
          return JSON.stringify({ queda_pct: 0.4, cv: 0.18 }); // 5 em falta
        return null;
      }),
      countInspecoesConfirmadas: vi.fn(async () => 200),
      writeModeloAtivo,
    });

    const result = await attemptAutoPromote(deps);

    expect(result.promoted).toBe(false);
    if (!result.promoted && result.reason === "invalid_logistic_weights") {
      expect(result.missing).toEqual(
        expect.arrayContaining(["zscore", "slope", "ratio_pico", "alertas_12m", "perda_zona"])
      );
      expect(result.missing).not.toContain("queda_pct");
      expect(result.missing).not.toContain("cv");
    }
    expect(writeModeloAtivo).not.toHaveBeenCalled();
  });

  it("não promove quando algum peso é string em vez de número", async () => {
    const deps = buildDeps({
      readConfig: vi.fn(async (k) => {
        if (k === "ml_modelo_ativo") return "heuristic_v1";
        if (k === "ml_pesos_v1_logistic")
          return JSON.stringify({
            queda_pct: "x", // ← string
            cv: 0.18,
            zscore: 0.12,
            slope: 0.1,
            ratio_pico: 0.08,
            alertas_12m: 0.07,
            perda_zona: 0.05,
          });
        return null;
      }),
      countInspecoesConfirmadas: vi.fn(async () => 200),
    });

    const result = await attemptAutoPromote(deps);

    expect(result.promoted).toBe(false);
    if (!result.promoted && result.reason === "invalid_logistic_weights") {
      expect(result.non_finite).toContain("queda_pct");
      expect(result.missing).toEqual([]);
    }
  });

  it("não promove quando peso é null (typeof !== 'number')", async () => {
    const deps = buildDeps({
      readConfig: vi.fn(async (k) => {
        if (k === "ml_modelo_ativo") return "heuristic_v1";
        if (k === "ml_pesos_v1_logistic")
          return JSON.stringify({
            queda_pct: null,
            cv: 0.18,
            zscore: 0.12,
            slope: 0.1,
            ratio_pico: 0.08,
            alertas_12m: 0.07,
            perda_zona: 0.05,
          });
        return null;
      }),
      countInspecoesConfirmadas: vi.fn(async () => 200),
    });

    const result = await attemptAutoPromote(deps);

    expect(result.promoted).toBe(false);
    if (!result.promoted && result.reason === "invalid_logistic_weights") {
      expect(result.non_finite).toContain("queda_pct");
    }
  });

  it("promove quando todos os keys são números finitos (mesmo com keys extra forward-compat)", async () => {
    const writeModeloAtivo = vi.fn(async () => {});
    const deps = buildDeps({
      readConfig: vi.fn(async (k) => {
        if (k === "ml_modelo_ativo") return "heuristic_v1";
        if (k === "ml_pesos_v1_logistic")
          return JSON.stringify({
            queda_pct: 0.4,
            cv: 0.18,
            zscore: 0.12,
            slope: 0.1,
            ratio_pico: 0.08,
            alertas_12m: 0.07,
            perda_zona: 0.05,
            // Keys extra são permitidos (forward-compat para v2 do modelo)
            bias: -0.5,
            modelo_treino_data: "2026-04-01",
          });
        if (k === "ml_inspecoes_promote_threshold") return "100";
        return null;
      }),
      countInspecoesConfirmadas: vi.fn(async () => 100),
      writeModeloAtivo,
    });

    const result = await attemptAutoPromote(deps);

    expect(result).toMatchObject({ promoted: true, to: "logistic_v1" });
    expect(writeModeloAtivo).toHaveBeenCalledWith("logistic_v1");
  });

  it("não promove quando inspeções abaixo do threshold", async () => {
    const writeModeloAtivo = vi.fn();
    const deps = buildDeps({
      readConfig: vi.fn(async (k) => {
        if (k === "ml_modelo_ativo") return "heuristic_v1";
        if (k === "ml_pesos_v1_logistic") return PESOS_VALIDOS;
        if (k === "ml_inspecoes_promote_threshold") return "100";
        return null;
      }),
      countInspecoesConfirmadas: vi.fn(async () => 87),
      writeModeloAtivo,
    });

    const result = await attemptAutoPromote(deps);

    expect(result).toEqual({
      promoted: false,
      reason: "below_threshold",
      inspecoes: 87,
      threshold: 100,
    });
    expect(writeModeloAtivo).not.toHaveBeenCalled();
  });

  it("promove quando inspeções >= threshold E pesos válidos existem", async () => {
    const writeModeloAtivo = vi.fn(async () => {});
    const deps = buildDeps({
      readConfig: vi.fn(async (k) => {
        if (k === "ml_modelo_ativo") return "heuristic_v1";
        if (k === "ml_pesos_v1_logistic") return PESOS_VALIDOS;
        if (k === "ml_inspecoes_promote_threshold") return "100";
        return null;
      }),
      countInspecoesConfirmadas: vi.fn(async () => 100),
      writeModeloAtivo,
    });

    const result = await attemptAutoPromote(deps);

    expect(result).toEqual({
      promoted: true,
      from: "heuristic_v1",
      to: "logistic_v1",
      inspecoes: 100,
      threshold: 100,
    });
    expect(writeModeloAtivo).toHaveBeenCalledWith("logistic_v1");
    expect(writeModeloAtivo).toHaveBeenCalledTimes(1);
  });

  it("promove com threshold customizado da config", async () => {
    const writeModeloAtivo = vi.fn(async () => {});
    const deps = buildDeps({
      readConfig: vi.fn(async (k) => {
        if (k === "ml_modelo_ativo") return "heuristic_v1";
        if (k === "ml_pesos_v1_logistic") return PESOS_VALIDOS;
        if (k === "ml_inspecoes_promote_threshold") return "50";
        return null;
      }),
      countInspecoesConfirmadas: vi.fn(async () => 60),
      writeModeloAtivo,
    });

    const result = await attemptAutoPromote(deps);

    expect(result).toMatchObject({ promoted: true, threshold: 50, inspecoes: 60 });
  });

  it("usa default 100 quando threshold da config é inválido (zero, NaN, negativo)", async () => {
    const deps = buildDeps({
      readConfig: vi.fn(async (k) => {
        if (k === "ml_modelo_ativo") return "heuristic_v1";
        if (k === "ml_pesos_v1_logistic") return PESOS_VALIDOS;
        if (k === "ml_inspecoes_promote_threshold") return "0";
        return null;
      }),
      countInspecoesConfirmadas: vi.fn(async () => 99),
    });

    const result = await attemptAutoPromote(deps);

    expect(result).toEqual({
      promoted: false,
      reason: "below_threshold",
      inspecoes: 99,
      threshold: 100,
    });
  });

  it("retorna erro quando readConfig falha (sem rebentar)", async () => {
    const deps = buildDeps({
      readConfig: vi.fn(async () => {
        throw new Error("supabase down");
      }),
    });

    const result = await attemptAutoPromote(deps);

    expect(result).toEqual({
      promoted: false,
      reason: "error",
      error: "supabase down",
    });
  });

  it("retorna erro quando writeModeloAtivo falha (sem rebentar)", async () => {
    const deps = buildDeps({
      readConfig: vi.fn(async (k) => {
        if (k === "ml_modelo_ativo") return "heuristic_v1";
        if (k === "ml_pesos_v1_logistic") return PESOS_VALIDOS;
        return null;
      }),
      countInspecoesConfirmadas: vi.fn(async () => 200),
      writeModeloAtivo: vi.fn(async () => {
        throw new Error("rls denied");
      }),
    });

    const result = await attemptAutoPromote(deps);

    expect(result).toEqual({
      promoted: false,
      reason: "error",
      error: "rls denied",
    });
  });
});
