import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cacheControlForMesAno } from "@/lib/api/cache";

describe("cacheControlForMesAno", () => {
  beforeEach(() => {
    // Fixar "agora" em 2026-05-15 UTC para testes determinísticos
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 15, 12, 0, 0))); // mês 5 (May)
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna no-store quando mes_ano é undefined", () => {
    expect(cacheControlForMesAno(undefined)).toBe("no-store");
  });

  it("retorna no-store quando mes_ano é o mês corrente", () => {
    expect(cacheControlForMesAno("2026-05")).toBe("no-store");
  });

  it("retorna no-store quando mes_ano é futuro", () => {
    expect(cacheControlForMesAno("2026-06")).toBe("no-store");
    expect(cacheControlForMesAno("2027-01")).toBe("no-store");
  });

  it("retorna cache CDN para mes_ano passado (mesmo ano)", () => {
    expect(cacheControlForMesAno("2026-04")).toBe(
      "public, s-maxage=300, stale-while-revalidate=60"
    );
    expect(cacheControlForMesAno("2026-01")).toBe(
      "public, s-maxage=300, stale-while-revalidate=60"
    );
  });

  it("retorna cache CDN para mes_ano de ano anterior", () => {
    expect(cacheControlForMesAno("2025-12")).toBe(
      "public, s-maxage=300, stale-while-revalidate=60"
    );
    expect(cacheControlForMesAno("2020-01")).toBe(
      "public, s-maxage=300, stale-while-revalidate=60"
    );
  });
});
