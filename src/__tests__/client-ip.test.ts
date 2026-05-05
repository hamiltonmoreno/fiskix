import { describe, it, expect } from "vitest";
import { getClientIp } from "@/lib/api/client-ip";

function mkReq(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/v1/alertas", { headers });
}

describe("getClientIp", () => {
  it("extrai o primeiro IP de x-forwarded-for", () => {
    const r = mkReq({ "x-forwarded-for": "203.0.113.42, 10.0.0.1, 172.16.0.1" });
    expect(getClientIp(r)).toBe("203.0.113.42");
  });

  it("aceita x-forwarded-for com IP único", () => {
    const r = mkReq({ "x-forwarded-for": "198.51.100.7" });
    expect(getClientIp(r)).toBe("198.51.100.7");
  });

  it("recorre a x-real-ip quando x-forwarded-for está ausente", () => {
    const r = mkReq({ "x-real-ip": "192.0.2.99" });
    expect(getClientIp(r)).toBe("192.0.2.99");
  });

  it("retorna 'unknown' sem nenhum header", () => {
    expect(getClientIp(mkReq({}))).toBe("unknown");
  });

  it("trims whitespace nos IPs", () => {
    const r = mkReq({ "x-forwarded-for": "  203.0.113.5  ,  10.0.0.1" });
    expect(getClientIp(r)).toBe("203.0.113.5");
  });
});
