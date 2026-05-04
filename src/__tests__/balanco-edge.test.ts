/**
 * Tests for the pure helpers used by the balanco-energetico edge function
 * (supabase/functions/balanco-energetico/helpers.ts).
 *
 * These mirror the in-edge calculations exactly. The Deno-bound handler in
 * index.ts is left untested here — it is exercised end-to-end through
 * src/modules/balanco/hooks/useBalanco.ts integration.
 */
import { describe, it, expect } from "vitest";
import {
  buildMesesRange,
  classify,
  computeBalanco,
  shiftMesAno,
  type FaturacaoRow,
  type InjecaoRow,
} from "../../supabase/functions/balanco-energetico/helpers";

const SUB_A = { nome: "Sub A", ilha: "Santiago", zona_bairro: "Plateau" };
const SUB_B = { nome: "Sub B", ilha: "Santiago", zona_bairro: "Palmarejo" };
const SUB_C = { nome: "Sub C", ilha: "Sal", zona_bairro: "Espargos" };

const baseOpts = { tecnicoMaxPct: 8, precoCvePorKwh: 15 };

function inj(id: string, mes: string, kwh: number, sub = SUB_A): InjecaoRow {
  return {
    id_subestacao: id,
    mes_ano: mes,
    total_kwh_injetado: kwh,
    subestacoes: sub,
  };
}

function fat(
  subId: string,
  mes: string,
  kwh: number,
  tipoTarifa = "Residencial",
): FaturacaoRow {
  return {
    mes_ano: mes,
    kwh_faturado: kwh,
    clientes: { id_subestacao: subId, tipo_tarifa: tipoTarifa },
  };
}

describe("shiftMesAno", () => {
  it("subtracts months across a year boundary", () => {
    expect(shiftMesAno("2026-01", -1)).toBe("2025-12");
    expect(shiftMesAno("2026-03", -12)).toBe("2025-03");
    expect(shiftMesAno("2026-01", -13)).toBe("2024-12");
  });

  it("adds months", () => {
    expect(shiftMesAno("2025-11", 2)).toBe("2026-01");
    expect(shiftMesAno("2025-12", 1)).toBe("2026-01");
  });

  it("returns the same month when delta is zero", () => {
    expect(shiftMesAno("2025-06", 0)).toBe("2025-06");
  });

  it("pads single-digit months with a leading zero", () => {
    expect(shiftMesAno("2026-10", -3)).toBe("2026-07");
    expect(shiftMesAno("2026-12", 1)).toBe("2027-01");
  });
});

describe("buildMesesRange", () => {
  it("returns n months ending at the anchor (chronological order)", () => {
    expect(buildMesesRange("2026-03", 3)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
  });

  it("returns a single month when n=1", () => {
    expect(buildMesesRange("2026-05", 1)).toEqual(["2026-05"]);
  });

  it("crosses year boundaries", () => {
    expect(buildMesesRange("2026-02", 4)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("returns an empty array for n=0", () => {
    expect(buildMesesRange("2026-03", 0)).toEqual([]);
  });
});

describe("classify", () => {
  it("classifies losses by percentage thresholds", () => {
    expect(classify(0)).toBe("ok");
    expect(classify(14.9)).toBe("ok");
    expect(classify(15)).toBe("atencao");
    expect(classify(24.9)).toBe("atencao");
    expect(classify(25)).toBe("critico");
    expect(classify(99)).toBe("critico");
  });
});

describe("computeBalanco", () => {
  it("computes injected/invoiced/loss per substation and sorts by perda_kwh desc", () => {
    const injecoes = [inj("A", "2026-04", 1000, SUB_A), inj("B", "2026-04", 500, SUB_B)];
    const faturacoes = [fat("A", "2026-04", 600), fat("B", "2026-04", 480)];

    const rows = computeBalanco(injecoes, faturacoes, baseOpts);

    // Sorted by perda_kwh: A (400) before B (20)
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe("A");
    expect(rows[0]).toMatchObject({
      kwh_injetado: 1000,
      kwh_faturado: 600,
      perda_kwh: 400,
      perda_pct: 40,
      cve_estimado: 6000, // 400 * 15
    });
    expect(rows[1].id).toBe("B");
    expect(rows[1].perda_kwh).toBe(20);
  });

  it("classifies substations by loss percentage", () => {
    const injecoes = [
      inj("ok", "2026-04", 1000, SUB_A),
      inj("at", "2026-04", 1000, SUB_B),
      inj("cr", "2026-04", 1000, SUB_C),
    ];
    const faturacoes = [
      fat("ok", "2026-04", 950), // 5% perda
      fat("at", "2026-04", 800), // 20% perda
      fat("cr", "2026-04", 600), // 40% perda
    ];

    const rows = computeBalanco(injecoes, faturacoes, baseOpts);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.classificacao]));

    expect(byId).toEqual({ ok: "ok", at: "atencao", cr: "critico" });
  });

  it("splits losses into technical (≤ tecnicoMaxPct) and commercial (excess)", () => {
    // 1000 kWh injected, 800 kWh invoiced → 200 kWh loss = 20%
    // tecnicoMaxPct=8 → técnica capped at 80 kWh, comercial = 120 kWh
    const rows = computeBalanco(
      [inj("X", "2026-04", 1000)],
      [fat("X", "2026-04", 800)],
      baseOpts,
    );
    expect(rows[0]).toMatchObject({
      perda_kwh: 200,
      perda_tecnica_kwh: 80,
      perda_comercial_kwh: 120,
    });
  });

  it("treats all loss as technical when below tecnicoMaxPct threshold", () => {
    // 5% loss < 8% threshold → 100% técnica
    const rows = computeBalanco(
      [inj("X", "2026-04", 1000)],
      [fat("X", "2026-04", 950)],
      baseOpts,
    );
    expect(rows[0]).toMatchObject({
      perda_kwh: 50,
      perda_tecnica_kwh: 50,
      perda_comercial_kwh: 0,
    });
  });

  it("aggregates multiple injection rows per substation", () => {
    const rows = computeBalanco(
      [inj("X", "2026-04", 600), inj("X", "2026-04", 400)],
      [fat("X", "2026-04", 500)],
      baseOpts,
    );
    expect(rows[0].kwh_injetado).toBe(1000);
    expect(rows[0].perda_kwh).toBe(500);
  });

  it("aggregates multiple invoicing rows per substation", () => {
    const rows = computeBalanco(
      [inj("X", "2026-04", 1000)],
      [fat("X", "2026-04", 300), fat("X", "2026-04", 400)],
      baseOpts,
    );
    expect(rows[0].kwh_faturado).toBe(700);
    expect(rows[0].perda_kwh).toBe(300);
  });

  it("filters by tipoTarifa before aggregating invoicing", () => {
    const rows = computeBalanco(
      [inj("X", "2026-04", 1000)],
      [fat("X", "2026-04", 600, "Residencial"), fat("X", "2026-04", 200, "Comercial")],
      { ...baseOpts, tipoTarifa: "Residencial" },
    );
    expect(rows[0].kwh_faturado).toBe(600);
  });

  it("filters by zona after aggregation", () => {
    const rows = computeBalanco(
      [inj("A", "2026-04", 1000, SUB_A), inj("B", "2026-04", 800, SUB_B)],
      [fat("A", "2026-04", 700), fat("B", "2026-04", 500)],
      { ...baseOpts, zona: SUB_A.zona_bairro },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("A");
  });

  it("clamps loss to 0 when invoicing exceeds injection (data anomaly)", () => {
    // Defensive: if billing data is mis-imported and exceeds injection,
    // the loss should not go negative.
    const rows = computeBalanco(
      [inj("X", "2026-04", 500)],
      [fat("X", "2026-04", 700)],
      baseOpts,
    );
    expect(rows[0].perda_kwh).toBe(0);
    expect(rows[0].perda_pct).toBe(0);
    expect(rows[0].perda_tecnica_kwh).toBe(0);
    expect(rows[0].perda_comercial_kwh).toBe(0);
  });

  it("returns 0% loss and zero CVE when injection is 0", () => {
    const rows = computeBalanco(
      [inj("X", "2026-04", 0)],
      [],
      baseOpts,
    );
    expect(rows[0]).toMatchObject({
      kwh_injetado: 0,
      perda_kwh: 0,
      perda_pct: 0,
      cve_estimado: 0,
    });
  });

  it("ignores invoicing rows missing id_subestacao", () => {
    const rows = computeBalanco(
      [inj("X", "2026-04", 1000)],
      [
        fat("X", "2026-04", 400),
        { mes_ano: "2026-04", kwh_faturado: 999, clientes: null },
      ],
      baseOpts,
    );
    expect(rows[0].kwh_faturado).toBe(400);
  });

  it("falls back to placeholders when subestacoes embed is missing", () => {
    const rows = computeBalanco(
      [{ id_subestacao: "X", mes_ano: "2026-04", total_kwh_injetado: 100 }],
      [],
      baseOpts,
    );
    expect(rows[0]).toMatchObject({
      nome: "Desconhecida",
      ilha: "—",
      zona_bairro: "—",
    });
  });

  it("uses configurable price for cve_estimado", () => {
    const rows = computeBalanco(
      [inj("X", "2026-04", 1000)],
      [fat("X", "2026-04", 800)],
      { ...baseOpts, precoCvePorKwh: 20 },
    );
    expect(rows[0].cve_estimado).toBe(4000); // 200 kWh * 20 CVE
  });

  it("returns an empty array when no injection rows are provided", () => {
    expect(computeBalanco([], [fat("X", "2026-04", 100)], baseOpts)).toEqual([]);
  });
});
