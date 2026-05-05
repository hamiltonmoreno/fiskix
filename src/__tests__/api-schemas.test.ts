import { describe, it, expect } from "vitest";
import {
  AlertasQuerySchema,
  AlertaIdParamSchema,
  BalancoQuerySchema,
  PredicoesQuerySchema,
  parseQuery,
  parseParams,
} from "@/lib/api/schemas";

function searchParams(obj: Record<string, string>): URLSearchParams {
  return new URLSearchParams(obj);
}

describe("AlertasQuerySchema", () => {
  it("aceita mes_ano YYYY-MM e coerces min_score para number", () => {
    const r = parseQuery(AlertasQuerySchema, searchParams({ mes_ano: "2026-04", min_score: "75" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.mes_ano).toBe("2026-04");
    expect(r.data.min_score).toBe(75);
  });

  it("rejeita mes_ano malformado", () => {
    const r = parseQuery(AlertasQuerySchema, searchParams({ mes_ano: "2026-13" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0].path).toBe("mes_ano");
  });

  it("rejeita min_score fora de 0-100", () => {
    const r = parseQuery(AlertasQuerySchema, searchParams({ min_score: "150" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0].path).toBe("min_score");
  });

  it("rejeita min_score=abc (não numérico — captura silent NaN bug)", () => {
    const r = parseQuery(AlertasQuerySchema, searchParams({ min_score: "abc" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0].path).toBe("min_score");
  });

  it("aceita status enum válido e rejeita inválido", () => {
    const ok = parseQuery(AlertasQuerySchema, searchParams({ status: "Pendente" }));
    expect(ok.ok).toBe(true);

    const ko = parseQuery(AlertasQuerySchema, searchParams({ status: "Inventado" }));
    expect(ko.ok).toBe(false);
  });

  it("aplica defaults page=1, limit=50 quando ausentes", () => {
    const r = parseQuery(AlertasQuerySchema, searchParams({}));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.page).toBe(1);
    expect(r.data.limit).toBe(50);
  });

  it("clampa limit a max 100", () => {
    const r = parseQuery(AlertasQuerySchema, searchParams({ limit: "999" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0].path).toBe("limit");
  });

  it("rejeita subestacao_id que não é UUID", () => {
    const r = parseQuery(AlertasQuerySchema, searchParams({ subestacao_id: "abc" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0].path).toBe("subestacao_id");
  });
});

describe("AlertaIdParamSchema", () => {
  it("aceita UUID válido", () => {
    const r = parseParams(AlertaIdParamSchema, { id: "550e8400-e29b-41d4-a716-446655440000" });
    expect(r.ok).toBe(true);
  });

  it("rejeita string não-UUID", () => {
    const r = parseParams(AlertaIdParamSchema, { id: "abc" });
    expect(r.ok).toBe(false);
  });
});

describe("BalancoQuerySchema", () => {
  it("rejeita request sem mes_ano (obrigatório)", () => {
    const r = parseQuery(BalancoQuerySchema, searchParams({}));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0].path).toBe("mes_ano");
  });

  it("aceita mes_ano + subestacao_id opcional UUID", () => {
    const r = parseQuery(BalancoQuerySchema, searchParams({ mes_ano: "2026-04" }));
    expect(r.ok).toBe(true);
  });
});

describe("PredicoesQuerySchema", () => {
  it("min_score_ml entre 0 e 1 (probabilidade)", () => {
    const ok = parseQuery(PredicoesQuerySchema, searchParams({ min_score_ml: "0.7" }));
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.data.min_score_ml).toBe(0.7);

    const ko = parseQuery(PredicoesQuerySchema, searchParams({ min_score_ml: "1.5" }));
    expect(ko.ok).toBe(false);
  });

  it("default min_score_ml=0 quando ausente", () => {
    const r = parseQuery(PredicoesQuerySchema, searchParams({}));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.min_score_ml).toBe(0);
  });
});
