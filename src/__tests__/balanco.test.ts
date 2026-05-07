import { describe, it, expect } from "vitest";
import {
  buildMesesRange,
  calcularBalancoPorSubestacao,
  calcularEvolucaoMensal,
  agregarKPIs,
  shiftMesAno,
  topContribuidores,
  type InjecaoRow,
  type FaturacaoRow,
} from "@/modules/balanco/lib/balanco";

const SUB_A = { nome: "Sub A", ilha: "Santiago", zona_bairro: "Plateau" };
const SUB_B = { nome: "Sub B", ilha: "Santiago", zona_bairro: "Palmarejo" };
const SUB_C = { nome: "Sub C", ilha: "Sal", zona_bairro: "Espargos" };

function inj(id: string, mes: string, kwh: number, sub = SUB_A): InjecaoRow {
  return { id_subestacao: id, mes_ano: mes, total_kwh_injetado: kwh, subestacao: sub };
}

function fat(
  subId: string,
  mes: string,
  kwh: number,
  extra: { tipo_tarifa?: string; nome?: string; numero?: string; valorCve?: number; cliId?: string } = {},
): FaturacaoRow {
  return {
    mes_ano: mes,
    kwh_faturado: kwh,
    valor_cve: extra.valorCve ?? kwh * 15,
    cliente: {
      id: extra.cliId,
      id_subestacao: subId,
      tipo_tarifa: extra.tipo_tarifa ?? "Residencial",
      nome_titular: extra.nome ?? "Cliente",
      numero_contador: extra.numero ?? "0001",
    },
  };
}

describe("calcularBalancoPorSubestacao", () => {
  it("computes a row per substation with loss kWh and %", () => {
    const injecoes = [inj("A", "2026-01", 1000, SUB_A), inj("B", "2026-01", 500, SUB_B)];
    const faturacoes = [fat("A", "2026-01", 800), fat("B", "2026-01", 400)];

    const rows = calcularBalancoPorSubestacao(injecoes, faturacoes);

    expect(rows).toHaveLength(2);
    const a = rows.find((r) => r.id === "A")!;
    expect(a.kwh_injetado).toBe(1000);
    expect(a.kwh_faturado).toBe(800);
    expect(a.perda_kwh).toBe(200);
    expect(a.perda_pct).toBe(20);
    expect(a.cve_estimado).toBe(3000);
  });

  it("classifies losses into ok / atencao / critico", () => {
    const injecoes = [
      inj("OK", "2026-01", 1000),
      inj("ATEN", "2026-01", 1000),
      inj("CRIT", "2026-01", 1000),
    ];
    const faturacoes = [
      fat("OK", "2026-01", 950), // 5% loss → ok
      fat("ATEN", "2026-01", 800), // 20% loss → atencao
      fat("CRIT", "2026-01", 700), // 30% loss → critico
    ];

    const rows = calcularBalancoPorSubestacao(injecoes, faturacoes);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.OK!.classificacao).toBe("ok");
    expect(byId.ATEN!.classificacao).toBe("atencao");
    expect(byId.CRIT!.classificacao).toBe("critico");
  });

  it("splits losses into technical (≤8% of injected) and commercial (excess)", () => {
    const injecoes = [inj("A", "2026-01", 1000)];
    const faturacoes = [fat("A", "2026-01", 700)]; // 300 kWh loss = 30%
    const rows = calcularBalancoPorSubestacao(injecoes, faturacoes);
    const a = rows[0]!;
    expect(a.perda_tecnica_kwh).toBe(80); // 8% cap
    expect(a.perda_comercial_kwh).toBe(220); // remainder
  });

  it("when loss is below technical threshold, all loss is technical", () => {
    const injecoes = [inj("A", "2026-01", 1000)];
    const faturacoes = [fat("A", "2026-01", 970)]; // 3% loss
    const rows = calcularBalancoPorSubestacao(injecoes, faturacoes);
    expect(rows[0]!.perda_tecnica_kwh).toBe(30);
    expect(rows[0]!.perda_comercial_kwh).toBe(0);
  });

  it("never produces negative loss when faturado > injetado", () => {
    const injecoes = [inj("A", "2026-01", 100)];
    const faturacoes = [fat("A", "2026-01", 150)];
    const rows = calcularBalancoPorSubestacao(injecoes, faturacoes);
    expect(rows[0]!.perda_kwh).toBe(0);
    expect(rows[0]!.perda_pct).toBe(0);
  });

  it("filters by zona", () => {
    const injecoes = [inj("A", "2026-01", 100, SUB_A), inj("B", "2026-01", 200, SUB_B)];
    const faturacoes = [fat("A", "2026-01", 80), fat("B", "2026-01", 150)];
    const rows = calcularBalancoPorSubestacao(injecoes, faturacoes, { zona: "Plateau" });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe("A");
  });

  it("filters faturacao by tipoTarifa", () => {
    const injecoes = [inj("A", "2026-01", 1000)];
    const faturacoes = [
      fat("A", "2026-01", 600, { tipo_tarifa: "Residencial" }),
      fat("A", "2026-01", 200, { tipo_tarifa: "Comercial" }),
    ];
    const rows = calcularBalancoPorSubestacao(injecoes, faturacoes, { tipoTarifa: "Residencial" });
    expect(rows[0]!.kwh_faturado).toBe(600);
    expect(rows[0]!.perda_kwh).toBe(400);
  });

  it("sorts results by perda_kwh descending", () => {
    const injecoes = [inj("A", "2026-01", 100), inj("B", "2026-01", 1000), inj("C", "2026-01", 500)];
    const faturacoes = [fat("A", "2026-01", 90), fat("B", "2026-01", 500), fat("C", "2026-01", 300)];
    const rows = calcularBalancoPorSubestacao(injecoes, faturacoes);
    expect(rows.map((r) => r.id)).toEqual(["B", "C", "A"]);
  });

  it("respects custom tecnicoMaxPct", () => {
    const injecoes = [inj("A", "2026-01", 1000)];
    const faturacoes = [fat("A", "2026-01", 800)];
    const rows = calcularBalancoPorSubestacao(injecoes, faturacoes, { tecnicoMaxPct: 5 });
    expect(rows[0]!.perda_tecnica_kwh).toBe(50);
    expect(rows[0]!.perda_comercial_kwh).toBe(150);
  });

  it("uses custom precoCvePorKwh", () => {
    const injecoes = [inj("A", "2026-01", 1000)];
    const faturacoes = [fat("A", "2026-01", 800)];
    const rows = calcularBalancoPorSubestacao(injecoes, faturacoes, { precoCvePorKwh: 25 });
    expect(rows[0]!.cve_estimado).toBe(5000);
  });

  it("respects custom atencaoPct/criticoPct thresholds", () => {
    const injecoes = [inj("LOW", "2026-01", 1000), inj("MID", "2026-01", 1000), inj("HIGH", "2026-01", 1000)];
    const faturacoes = [
      fat("LOW", "2026-01", 950), // 5% loss
      fat("MID", "2026-01", 880), // 12% loss
      fat("HIGH", "2026-01", 800), // 20% loss
    ];
    const rows = calcularBalancoPorSubestacao(injecoes, faturacoes, {
      atencaoPct: 10,
      criticoPct: 18,
    });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.LOW!.classificacao).toBe("ok");
    expect(byId.MID!.classificacao).toBe("atencao"); // 12% > 10
    expect(byId.HIGH!.classificacao).toBe("critico"); // 20% > 18
  });

  it("returns empty array when no injecoes", () => {
    expect(calcularBalancoPorSubestacao([], [fat("A", "2026-01", 100)])).toEqual([]);
  });
});

describe("calcularEvolucaoMensal", () => {
  it("returns one row per requested month with computed loss", () => {
    const injecoes = [
      inj("A", "2026-01", 1000),
      inj("A", "2026-02", 1100),
      inj("A", "2026-03", 1200),
    ];
    const faturacoes = [
      fat("A", "2026-01", 900),
      fat("A", "2026-02", 950),
      fat("A", "2026-03", 1000),
    ];

    const evol = calcularEvolucaoMensal(injecoes, faturacoes, ["2026-01", "2026-02", "2026-03"]);

    expect(evol).toHaveLength(3);
    expect(evol[0]).toMatchObject({ mes_ano: "2026-01", perda_kwh: 100, perda_pct: 10 });
    expect(evol[1]).toMatchObject({ mes_ano: "2026-02", perda_pct: 13.64 });
    expect(evol[2]).toMatchObject({ mes_ano: "2026-03", perda_kwh: 200 });
  });

  it("returns 0% for months without injection data", () => {
    const evol = calcularEvolucaoMensal([], [], ["2026-01"]);
    expect(evol[0]).toMatchObject({ kwh_injetado: 0, perda_pct: 0 });
  });

  it("aggregates multiple substations within the same month", () => {
    const injecoes = [inj("A", "2026-01", 500), inj("B", "2026-01", 500)];
    const faturacoes = [fat("A", "2026-01", 400), fat("B", "2026-01", 400)];
    const evol = calcularEvolucaoMensal(injecoes, faturacoes, ["2026-01"]);
    expect(evol[0]!.kwh_injetado).toBe(1000);
    expect(evol[0]!.perda_kwh).toBe(200);
  });

  it("filters by zona at injection level", () => {
    const injecoes = [inj("A", "2026-01", 1000, SUB_A), inj("C", "2026-01", 800, SUB_C)];
    const faturacoes = [fat("A", "2026-01", 800), fat("C", "2026-01", 700)];
    const evol = calcularEvolucaoMensal(injecoes, faturacoes, ["2026-01"], { zona: "Plateau" });
    expect(evol[0]!.kwh_injetado).toBe(1000);
  });

  it("scopes faturação to the same zone as injection (regression: Codex P1)", () => {
    // Plateau: SUB_A injects 1000 kWh, bills 800 kWh → perda 200
    // Espargos: SUB_C injects 800 kWh, bills 700 kWh → perda 100
    // Without zone-scoping faturação the function would aggregate
    // 1000 inj (in zone) against 800+700=1500 fat (cross-zone) and report
    // perda_kwh=0, dramatically understating the loss.
    const injecoes = [inj("A", "2026-01", 1000, SUB_A), inj("C", "2026-01", 800, SUB_C)];
    const faturacoes = [fat("A", "2026-01", 800), fat("C", "2026-01", 700)];

    const evol = calcularEvolucaoMensal(injecoes, faturacoes, ["2026-01"], {
      zona: "Plateau",
    });

    expect(evol[0]!.kwh_injetado).toBe(1000);
    expect(evol[0]!.kwh_faturado).toBe(800); // only SUB_A's billing
    expect(evol[0]!.perda_kwh).toBe(200);
    expect(evol[0]!.perda_pct).toBe(20);
  });

  it("zone-scopes faturação from substations injecting in any month of the window", () => {
    // SUB_A only has injection in Jan, SUB_B (also Plateau zone) only in Feb.
    // Both should remain in the in-zone faturação set across the window.
    const SUB_A_PLATEAU = SUB_A; // Plateau
    const SUB_B_PLATEAU = { nome: "Sub B", ilha: "Santiago", zona_bairro: "Plateau" };
    const injecoes = [
      inj("A", "2026-01", 1000, SUB_A_PLATEAU),
      inj("B", "2026-02", 500, SUB_B_PLATEAU),
    ];
    const faturacoes = [
      fat("A", "2026-01", 700),
      fat("B", "2026-02", 400),
    ];
    const evol = calcularEvolucaoMensal(injecoes, faturacoes, ["2026-01", "2026-02"], {
      zona: "Plateau",
    });
    expect(evol[0]).toMatchObject({ kwh_injetado: 1000, kwh_faturado: 700, perda_kwh: 300 });
    expect(evol[1]).toMatchObject({ kwh_injetado: 500, kwh_faturado: 400, perda_kwh: 100 });
  });
});

describe("shiftMesAno", () => {
  it("shifts months back across a year boundary", () => {
    expect(shiftMesAno("2026-01", -1)).toBe("2025-12");
    expect(shiftMesAno("2026-03", -12)).toBe("2025-03");
  });

  it("shifts months forward", () => {
    expect(shiftMesAno("2025-12", 1)).toBe("2026-01");
  });

  it("returns the same month when delta is 0", () => {
    expect(shiftMesAno("2025-06", 0)).toBe("2025-06");
  });
});

describe("buildMesesRange", () => {
  it("returns N months ending at the anchor in chronological order", () => {
    expect(buildMesesRange("2026-03", 3)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("anchors the window at the selected month, not 'now' (regression: Codex P2)", () => {
    // Even if the anchor is well in the past, we want a full N-month window
    // so trend / YoY computations don't silently truncate.
    expect(buildMesesRange("2024-08", 12)).toEqual([
      "2023-09",
      "2023-10",
      "2023-11",
      "2023-12",
      "2024-01",
      "2024-02",
      "2024-03",
      "2024-04",
      "2024-05",
      "2024-06",
      "2024-07",
      "2024-08",
    ]);
  });

  it("returns an empty array when N is 0", () => {
    expect(buildMesesRange("2026-03", 0)).toEqual([]);
  });
});

describe("agregarKPIs", () => {
  it("sums injection, invoicing and losses across substations", () => {
    const rows = calcularBalancoPorSubestacao(
      [inj("A", "2026-01", 1000), inj("B", "2026-01", 500)],
      [fat("A", "2026-01", 800), fat("B", "2026-01", 350)],
    );
    const kpis = agregarKPIs(rows);

    expect(kpis.totalInjetado).toBe(1500);
    expect(kpis.totalFaturado).toBe(1150);
    expect(kpis.perdaKwh).toBe(350);
    expect(kpis.perdaPct).toBe(23.3);
    expect(kpis.cveEstimado).toBe(5250);
  });

  it("counts critical substations (>=25% loss)", () => {
    const rows = calcularBalancoPorSubestacao(
      [inj("OK", "2026-01", 1000), inj("CRIT1", "2026-01", 1000), inj("CRIT2", "2026-01", 1000)],
      [fat("OK", "2026-01", 950), fat("CRIT1", "2026-01", 700), fat("CRIT2", "2026-01", 600)],
    );
    expect(agregarKPIs(rows).subestacoesCriticas).toBe(2);
  });

  it("returns zeros for empty input", () => {
    const kpis = agregarKPIs([]);
    expect(kpis).toMatchObject({ totalInjetado: 0, totalFaturado: 0, perdaKwh: 0, perdaPct: 0, subestacoesCriticas: 0 });
  });
});

describe("topContribuidores", () => {
  it("returns top N customers by kWh and computes share against injection", () => {
    const faturacoes = [
      fat("A", "2026-01", 500, { cliId: "c1", nome: "Maria" }),
      fat("A", "2026-01", 200, { cliId: "c2", nome: "João" }),
      fat("A", "2026-01", 100, { cliId: "c3", nome: "Ana" }),
      fat("A", "2026-01", 50, { cliId: "c4", nome: "Pedro" }),
    ];
    const top = topContribuidores(faturacoes, "A", 1000, 3);
    expect(top).toHaveLength(3);
    expect(top[0]).toMatchObject({ id_cliente: "c1", kwh_faturado: 500, share_pct: 50 });
    expect(top[1]!.id_cliente).toBe("c2");
    expect(top[2]!.id_cliente).toBe("c3");
  });

  it("aggregates multiple invoices per same customer", () => {
    const faturacoes = [
      fat("A", "2026-01", 100, { cliId: "c1" }),
      fat("A", "2026-02", 200, { cliId: "c1" }),
      fat("A", "2026-01", 50, { cliId: "c2" }),
    ];
    const top = topContribuidores(faturacoes, "A", 1000);
    expect(top[0]).toMatchObject({ id_cliente: "c1", kwh_faturado: 300 });
  });

  it("ignores rows from other substations", () => {
    const faturacoes = [
      fat("A", "2026-01", 100, { cliId: "c1" }),
      fat("B", "2026-01", 9999, { cliId: "c2" }),
    ];
    const top = topContribuidores(faturacoes, "A", 1000);
    expect(top).toHaveLength(1);
    expect(top[0]!.id_cliente).toBe("c1");
  });

  it("returns share_pct = 0 when injetado is 0", () => {
    const faturacoes = [fat("A", "2026-01", 100, { cliId: "c1" })];
    const top = topContribuidores(faturacoes, "A", 0);
    expect(top[0]!.share_pct).toBe(0);
  });
});
