import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "@/lib/observability/logger";

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("info emite JSON válido via console.info com level=info", () => {
    const log = logger({ service: "test" });
    log.info("evento.teste", { id: 1 });

    expect(console.info).toHaveBeenCalledOnce();
    const linha = JSON.parse((console.info as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(linha.level).toBe("info");
    expect(linha.event).toBe("evento.teste");
    expect(linha.service).toBe("test");
    expect(linha.id).toBe(1);
    expect(linha.ts).toBeTruthy();
  });

  it("warn emite via console.warn com level=warn", () => {
    const log = logger();
    log.warn("aviso.sistema", { detalhe: "x" });

    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.info).not.toHaveBeenCalled();
    const linha = JSON.parse((console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(linha.level).toBe("warn");
    expect(linha.event).toBe("aviso.sistema");
    expect(linha.detalhe).toBe("x");
  });

  it("error emite via console.error com level=error", () => {
    const log = logger({ req_id: "abc" });
    log.error("erro.critico", { code: 500 });

    expect(console.error).toHaveBeenCalledOnce();
    expect(console.info).not.toHaveBeenCalled();
    const linha = JSON.parse((console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(linha.level).toBe("error");
    expect(linha.event).toBe("erro.critico");
    expect(linha.req_id).toBe("abc");
    expect(linha.code).toBe(500);
  });

  it("contexto do logger é fundido com o payload do evento", () => {
    const log = logger({ service: "cron", version: "v1" });
    log.info("start", { mes_ano: "2026-03" });

    const linha = JSON.parse((console.info as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(linha.service).toBe("cron");
    expect(linha.version).toBe("v1");
    expect(linha.mes_ano).toBe("2026-03");
  });

  it("payload do evento sobrepõe contexto em caso de colisão de chave", () => {
    const log = logger({ version: "v1" });
    log.info("override", { version: "v2" });

    const linha = JSON.parse((console.info as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(linha.version).toBe("v2");
  });

  it("funciona sem contexto nem payload (mínimo viável)", () => {
    const log = logger();
    log.info("evento.simples");

    expect(console.info).toHaveBeenCalledOnce();
    const linha = JSON.parse((console.info as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(linha.level).toBe("info");
    expect(linha.event).toBe("evento.simples");
  });

  it("ts é um ISO timestamp válido", () => {
    const log = logger();
    log.info("check.ts");

    const linha = JSON.parse((console.info as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(() => new Date(linha.ts).toISOString()).not.toThrow();
    expect(new Date(linha.ts).getFullYear()).toBeGreaterThanOrEqual(2026);
  });
});
