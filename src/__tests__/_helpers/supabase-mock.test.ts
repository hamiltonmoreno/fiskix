import { describe, it, expect, vi } from "vitest";
import { createSupabaseMock } from "./supabase-mock";

describe("createSupabaseMock", () => {
  it("retorna data por defeito quando não há spec para a tabela", async () => {
    const sb = createSupabaseMock();
    const r = await sb.from("perfis").select("*");
    expect(r).toEqual({ data: null, error: null });
  });

  it("aplica spec por tabela em select chain", async () => {
    const sb = createSupabaseMock({
      from: {
        alertas_fraude: {
          select: { data: [{ id: "a1", score_risco: 80 }], error: null },
        },
      },
    });
    const r = await sb.from("alertas_fraude").select("id, score_risco");
    expect(r.data).toEqual([{ id: "a1", score_risco: 80 }]);
  });

  it("aceita chain longa sem partir (eq.in.gte.order.range)", async () => {
    const sb = createSupabaseMock({
      from: { alertas_fraude: { select: { data: [], error: null } } },
    });
    const r = await sb
      .from("alertas_fraude")
      .select("*")
      .eq("status", "Pendente")
      .in("mes_ano", ["2026-01", "2026-02"])
      .gte("score_risco", 50)
      .order("score_risco", { ascending: false })
      .range(0, 10);
    expect(r.data).toEqual([]);
  });

  it("single() retorna spec.single ou fallback para spec.select", async () => {
    const sb = createSupabaseMock({
      from: {
        perfis: {
          select: { data: [{ id: "u1" }], error: null },
          single: { data: { id: "u1", role: "admin_fiskix" }, error: null },
        },
      },
    });
    const r = await sb.from("perfis").select("*").eq("id", "u1").single();
    expect(r.data).toEqual({ id: "u1", role: "admin_fiskix" });
  });

  it("maybeSingle() devolve null quando data é null", async () => {
    const sb = createSupabaseMock({
      from: { configuracoes: { maybeSingle: { data: null, error: null } } },
    });
    const r = await sb.from("configuracoes").select("*").maybeSingle();
    expect(r.data).toBeNull();
  });

  it("auth.getUser resolve com user fornecido", async () => {
    const sb = createSupabaseMock({ auth: { user: { id: "u1", email: "e@x.com" } } });
    const r = await sb.auth.getUser();
    expect(r.data.user).toEqual({ id: "u1", email: "e@x.com" });
  });

  it("channel/removeChannel são funcionais (subscriptions Realtime)", () => {
    const sb = createSupabaseMock();
    const ch = sb.channel("test");
    ch.on("postgres_changes", {}, () => {}).subscribe();
    expect(sb.channel).toHaveBeenCalledWith("test");
    sb.removeChannel(ch);
    expect(sb.removeChannel).toHaveBeenCalled();
  });

  it("storage.from devolve bucket com upload + getPublicUrl", async () => {
    const sb = createSupabaseMock({
      storage: { publicUrl: "https://cdn.example/foto.jpg" },
    });
    const bucket = sb.storage.from("inspecoes");
    const up = await bucket.upload("path/foto.jpg", new Blob());
    expect(up.error).toBeNull();
    const url = bucket.getPublicUrl("path/foto.jpg");
    expect(url.data.publicUrl).toBe("https://cdn.example/foto.jpg");
  });

  it("permite inspecionar chain methods via spy", async () => {
    const sb = createSupabaseMock({
      from: { alertas_fraude: { select: { data: [], error: null } } },
    });
    const builder = sb.from("alertas_fraude");
    await builder.select("*").eq("id", "a1");
    expect(builder.select).toHaveBeenCalledWith("*");
    expect(builder.eq).toHaveBeenCalledWith("id", "a1");
  });
});
