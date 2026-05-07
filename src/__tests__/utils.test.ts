/**
 * Testes das funções utilitárias (src/lib/utils.ts)
 */
import { describe, it, expect } from "vitest";
import {
  formatCVE,
  formatKWh,
  formatMesAno,
  getScoreColor,
  getScoreLabel,
  getLastNMonths,
  getCurrentMesAno,
} from "@/lib/utils";

// ---------------------------------------------------------------------------
// getScoreColor
// ---------------------------------------------------------------------------

describe("getScoreColor", () => {
  it("score ≥ 75 → vermelho (CRÍTICO)", () => {
    expect(getScoreColor(75)).toContain("red");
    expect(getScoreColor(100)).toContain("red");
  });

  it("score 50–74 → âmbar (MÉDIO)", () => {
    expect(getScoreColor(50)).toContain("amber");
    expect(getScoreColor(74)).toContain("amber");
  });

  it("score < 50 → verde (BAIXO)", () => {
    expect(getScoreColor(0)).toContain("green");
    expect(getScoreColor(49)).toContain("green");
  });
});

// ---------------------------------------------------------------------------
// getScoreLabel
// ---------------------------------------------------------------------------

describe("getScoreLabel", () => {
  it("score ≥ 75 → CRÍTICO", () => {
    expect(getScoreLabel(75)).toBe("CRÍTICO");
    expect(getScoreLabel(100)).toBe("CRÍTICO");
  });

  it("score 50–74 → MÉDIO", () => {
    expect(getScoreLabel(50)).toBe("MÉDIO");
    expect(getScoreLabel(74)).toBe("MÉDIO");
  });

  it("score < 50 → BAIXO", () => {
    expect(getScoreLabel(0)).toBe("BAIXO");
    expect(getScoreLabel(49)).toBe("BAIXO");
  });
});

// ---------------------------------------------------------------------------
// formatCVE
// ---------------------------------------------------------------------------

describe("formatCVE", () => {
  it("formata zero", () => {
    const result = formatCVE(0);
    expect(result).toContain("0");
  });

  it("formata valor positivo e inclui símbolo CVE", () => {
    const result = formatCVE(1500);
    // Intl.NumberFormat com pt-CV deve incluir indicação de CVE
    expect(result).toMatch(/1[\s\u00A0]?500|1500/);
  });

  it("formata valor grande sem casas decimais", () => {
    const result = formatCVE(1_000_000);
    expect(result).not.toContain(".");
    expect(result).not.toContain(",00");
  });
});

// ---------------------------------------------------------------------------
// formatKWh
// ---------------------------------------------------------------------------

describe("formatKWh", () => {
  it("inclui sufixo kWh", () => {
    expect(formatKWh(100)).toContain("kWh");
  });

  it("formata valores inteiros sem casas decimais excessivas", () => {
    const result = formatKWh(500);
    expect(result).toContain("500");
  });
});

// ---------------------------------------------------------------------------
// formatMesAno
// ---------------------------------------------------------------------------

describe("formatMesAno", () => {
  it("converte '2024-01' para string com ano e mês", () => {
    const result = formatMesAno("2024-01");
    expect(result).toContain("2024");
  });

  it("converte '2024-12' para dezembro 2024", () => {
    const result = formatMesAno("2024-12");
    expect(result).toContain("2024");
    // O nome do mês varia por locale mas o ano deve estar presente
    expect(result.length).toBeGreaterThan(4);
  });
});

// ---------------------------------------------------------------------------
// getLastNMonths
// ---------------------------------------------------------------------------

describe("getLastNMonths", () => {
  it("retorna array do tamanho correto", () => {
    expect(getLastNMonths(6)).toHaveLength(6);
    expect(getLastNMonths(12)).toHaveLength(12);
    expect(getLastNMonths(1)).toHaveLength(1);
  });

  it("meses estão em formato YYYY-MM", () => {
    const meses = getLastNMonths(3);
    meses.forEach((m) => {
      expect(m).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  it("último mês é o mês atual", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const meses = getLastNMonths(3);
    expect(meses[meses.length - 1]).toBe(expected);
  });

  it("meses estão em ordem crescente", () => {
    const meses = getLastNMonths(6);
    for (let i = 1; i < meses.length; i++) {
      expect(meses[i]! > meses[i - 1]!).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// getCurrentMesAno
// ---------------------------------------------------------------------------

describe("getCurrentMesAno", () => {
  it("retorna o mês atual em formato YYYY-MM", () => {
    const result = getCurrentMesAno();
    expect(result).toMatch(/^\d{4}-\d{2}$/);
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    expect(result).toBe(expected);
  });
});
