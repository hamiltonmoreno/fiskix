import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  logger,
  registerLogTransport,
  _resetLogTransportsForTests,
  type LogRecord,
} from "@/lib/observability/logger";

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("logger", () => {
  beforeEach(() => {
    _resetLogTransportsForTests();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    _resetLogTransportsForTests();
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

  it("registerLogTransport recebe records de todos os níveis", () => {
    const records: LogRecord[] = [];
    registerLogTransport((r) => records.push(r));

    logger({ ctx: 1 }).info("a");
    logger().warn("b", { x: true });
    logger().error("c");

    expect(records.map((r) => r.event)).toEqual(["a", "b", "c"]);
    expect(records.map((r) => r.level)).toEqual(["info", "warn", "error"]);
    expect(records[0].payload.ctx).toBe(1);
    expect(records[1].payload.x).toBe(true);
  });

  it("transport que falha não interrompe outros transports", () => {
    const bom: LogRecord[] = [];
    registerLogTransport(() => {
      throw new Error("boom");
    });
    registerLogTransport((r) => bom.push(r));

    logger().info("evt");

    expect(bom).toHaveLength(1);
    expect(bom[0].event).toBe("evt");
    // erro do transport reportado via console.error directo (não loop)
    expect(console.error).toHaveBeenCalled();
  });
});
