/**
 * Tests for the offline-sync flow used by the fiscal PWA
 * (src/modules/mobile/lib/sync-pending-reports.ts).
 *
 * IndexedDB and the Supabase client are both faked in-memory so the test
 * exercises the sync state machine end-to-end without I/O.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  syncPendingReports,
  dataUrlToBlob,
  MAX_SYNC_RETRIES,
  STORE_NAME,
} from "@/modules/mobile/lib/sync-pending-reports";
import type { RelatorioOffline } from "@/modules/mobile/types";

// ---------------------------------------------------------------------------
// In-memory fake of the subset of IDBPDatabase that syncPendingReports uses
// ---------------------------------------------------------------------------
function makeFakeDB(initial: RelatorioOffline[] = []) {
  const store = new Map<string, RelatorioOffline>(
    initial.map((r) => [r.alerta_id, { ...r }]),
  );
  return {
    getAll: vi.fn(async (_name: string) => Array.from(store.values())),
    put: vi.fn(async (_name: string, value: RelatorioOffline) => {
      store.set(value.alerta_id, { ...value });
      return value.alerta_id;
    }),
    delete: vi.fn(async (_name: string, key: string) => {
      store.delete(key);
    }),
    _store: store,
  };
}

// ---------------------------------------------------------------------------
// Supabase client mock — chainable storage / from API
// ---------------------------------------------------------------------------
interface SupabaseMockOptions {
  uploadError?: { message: string } | null;
  insertError?: { message: string } | null;
  publicUrl?: string;
}

function makeSupabase(opts: SupabaseMockOptions = {}) {
  const upload = vi.fn(async (_path: string, _blob: Blob, _options: unknown) => ({
    data: { path: "ok" },
    error: opts.uploadError ?? null,
  }));
  const getPublicUrl = vi.fn((_path: string) => ({
    data: { publicUrl: opts.publicUrl ?? "https://cdn.example/photo.jpg" },
  }));
  const insert = vi.fn(async (_row: Record<string, unknown>) => ({
    error: opts.insertError ?? null,
  }));
  const eq = vi.fn(async (_col: string, _val: unknown) => ({ error: null }));
  const update = vi.fn((_patch: Record<string, unknown>) => ({ eq }));

  const client = {
    storage: {
      from: vi.fn(() => ({ upload, getPublicUrl })),
    },
    from: vi.fn((table: string) => {
      if (table === "relatorios_inspecao") return { insert };
      if (table === "alertas_fraude") return { update };
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { client, upload, getPublicUrl, insert, update, eq };
}

// Minimal valid base64 PNG so dataUrlToBlob doesn't throw
const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=";

function makeReport(overrides: Partial<RelatorioOffline> = {}): RelatorioOffline {
  return {
    alerta_id: "alerta-1",
    resultado: "Fraude_Confirmada",
    tipo_fraude: "Bypass",
    observacoes: "obs",
    foto_data_url: TINY_PNG_DATA_URL,
    foto_lat: 14.91,
    foto_lng: -23.51,
    timestamp: 1_700_000_000_000,
    ...overrides,
  };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dataUrlToBlob", () => {
  it("decodes a base64 data URL into a typed Blob", () => {
    const blob = dataUrlToBlob(TINY_PNG_DATA_URL);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("falls back to image/jpeg when the MIME header doesn't match the expected pattern", () => {
    // The function only matches `data:<mime>;base64` — anything else falls back.
    const blob = dataUrlToBlob("malformed,AAAA");
    expect(blob.type).toBe("image/jpeg");
  });
});

describe("syncPendingReports", () => {
  // --------------------------------------------------------------------- //
  // Happy path                                                            //
  // --------------------------------------------------------------------- //

  it("returns zero counts when the queue is empty", async () => {
    const db = makeFakeDB([]);
    const { client } = makeSupabase();

    const res = await syncPendingReports(client as never, "fiscal-1", db as never);

    expect(res).toEqual({ synced: 0, dropped: 0, total: 0 });
    expect(client.storage.from).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("uploads the photo, inserts the relatório, flips the alerta, and removes the queue entry", async () => {
    const db = makeFakeDB([makeReport()]);
    const { client, upload, getPublicUrl, insert, update, eq } = makeSupabase();

    const res = await syncPendingReports(client as never, "fiscal-1", db as never);

    expect(res).toEqual({ synced: 1, dropped: 0, total: 1 });
    expect(upload).toHaveBeenCalledOnce();
    expect(getPublicUrl).toHaveBeenCalledOnce();

    expect(insert).toHaveBeenCalledOnce();
    const insertedRow = insert.mock.calls[0][0];
    expect(insertedRow).toMatchObject({
      id_alerta: "alerta-1",
      id_fiscal: "fiscal-1",
      resultado: "Fraude_Confirmada",
      tipo_fraude: "Bypass",
      foto_url: "https://cdn.example/photo.jpg",
      foto_lat: 14.91,
      foto_lng: -23.51,
      observacoes: "obs",
    });

    expect(update).toHaveBeenCalledWith({
      status: "Inspecionado",
      resultado: "Fraude_Confirmada",
    });
    expect(eq).toHaveBeenCalledWith("id", "alerta-1");

    expect(db.delete).toHaveBeenCalledWith(STORE_NAME, "alerta-1");
    expect(db._store.has("alerta-1")).toBe(false);
  });

  it("syncs reports without a photo (foto_url stays null)", async () => {
    // Fiscal can submit a report without a photo when the inspection is
    // remote (e.g. customer not present); the foto_data_url is undefined.
    const db = makeFakeDB([makeReport({ foto_data_url: undefined })]);
    const { client, upload, insert } = makeSupabase();

    const res = await syncPendingReports(client as never, "fiscal-1", db as never);

    expect(res.synced).toBe(1);
    expect(upload).not.toHaveBeenCalled();
    expect(insert.mock.calls[0][0].foto_url).toBeNull();
  });

  it("processes multiple reports independently", async () => {
    const db = makeFakeDB([
      makeReport({ alerta_id: "a1" }),
      makeReport({ alerta_id: "a2" }),
      makeReport({ alerta_id: "a3" }),
    ]);
    const { client, insert } = makeSupabase();

    const res = await syncPendingReports(client as never, "fiscal-1", db as never);

    expect(res).toEqual({ synced: 3, dropped: 0, total: 3 });
    expect(insert).toHaveBeenCalledTimes(3);
    expect(db._store.size).toBe(0);
  });

  // --------------------------------------------------------------------- //
  // Photo upload failure path                                             //
  // --------------------------------------------------------------------- //

  it("does NOT insert the relatório when the photo upload fails (preserves legal evidence)", async () => {
    const db = makeFakeDB([makeReport()]);
    const { client, insert } = makeSupabase({
      uploadError: { message: "Storage offline" },
    });

    const res = await syncPendingReports(client as never, "fiscal-1", db as never);

    expect(res).toEqual({ synced: 0, dropped: 0, total: 1 });
    expect(insert).not.toHaveBeenCalled();
    // Record stays in queue with retry_count bumped
    expect(db._store.size).toBe(1);
    expect(db._store.get("alerta-1")?.retry_count).toBe(1);
  });

  it("bumps retry_count on each failed upload", async () => {
    const db = makeFakeDB([makeReport({ retry_count: 2 })]);
    const { client } = makeSupabase({ uploadError: { message: "boom" } });

    await syncPendingReports(client as never, "fiscal-1", db as never);

    expect(db._store.get("alerta-1")?.retry_count).toBe(3);
  });

  it("drops the report after MAX_SYNC_RETRIES failed photo uploads", async () => {
    const db = makeFakeDB([
      makeReport({ retry_count: MAX_SYNC_RETRIES - 1 }),
    ]);
    const { client } = makeSupabase({ uploadError: { message: "boom" } });

    const res = await syncPendingReports(client as never, "fiscal-1", db as never);

    expect(res).toEqual({ synced: 0, dropped: 1, total: 1 });
    expect(db._store.has("alerta-1")).toBe(false);
  });

  it("treats a thrown upload error the same as an error response", async () => {
    const db = makeFakeDB([makeReport()]);
    const upload = vi.fn(async () => {
      throw new Error("Network down");
    });
    const client = {
      storage: { from: vi.fn(() => ({ upload, getPublicUrl: vi.fn() })) },
      from: vi.fn(),
    };

    const res = await syncPendingReports(client as never, "fiscal-1", db as never);

    expect(res).toEqual({ synced: 0, dropped: 0, total: 1 });
    expect(client.from).not.toHaveBeenCalled();
    expect(db._store.get("alerta-1")?.retry_count).toBe(1);
  });

  // --------------------------------------------------------------------- //
  // Insert failure path                                                   //
  // --------------------------------------------------------------------- //

  it("bumps retry_count when the relatório insert fails", async () => {
    const db = makeFakeDB([makeReport({ retry_count: 1 })]);
    const { client, update } = makeSupabase({
      insertError: { message: "RLS denial" },
    });

    const res = await syncPendingReports(client as never, "fiscal-1", db as never);

    expect(res).toEqual({ synced: 0, dropped: 0, total: 1 });
    // Alerta status NOT flipped when insert failed
    expect(update).not.toHaveBeenCalled();
    expect(db._store.get("alerta-1")?.retry_count).toBe(2);
  });

  it("drops the report after MAX_SYNC_RETRIES failed inserts (permanent error)", async () => {
    const db = makeFakeDB([
      makeReport({ retry_count: MAX_SYNC_RETRIES - 1 }),
    ]);
    const { client } = makeSupabase({
      insertError: { message: "invalid enum value" },
    });

    const res = await syncPendingReports(client as never, "fiscal-1", db as never);

    expect(res).toEqual({ synced: 0, dropped: 1, total: 1 });
    expect(db._store.has("alerta-1")).toBe(false);
  });

  // --------------------------------------------------------------------- //
  // Mixed batch                                                           //
  // --------------------------------------------------------------------- //

  it("handles mixed success/failure in a single batch", async () => {
    // a1 succeeds, a2 fails on upload (retry), a3 succeeds
    const db = makeFakeDB([
      makeReport({ alerta_id: "a1" }),
      makeReport({ alerta_id: "a2" }),
      makeReport({ alerta_id: "a3" }),
    ]);

    const upload = vi
      .fn()
      .mockResolvedValueOnce({ data: { path: "ok" }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "fail" } })
      .mockResolvedValueOnce({ data: { path: "ok" }, error: null });
    const getPublicUrl = vi.fn(() => ({
      data: { publicUrl: "https://cdn/photo.jpg" },
    }));
    const insert = vi.fn(async () => ({ error: null }));
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    const client = {
      storage: { from: vi.fn(() => ({ upload, getPublicUrl })) },
      from: vi.fn((table: string) => {
        if (table === "relatorios_inspecao") return { insert };
        if (table === "alertas_fraude") return { update };
        throw new Error(table);
      }),
    };

    const res = await syncPendingReports(client as never, "fiscal-1", db as never);

    expect(res).toEqual({ synced: 2, dropped: 0, total: 3 });
    expect(insert).toHaveBeenCalledTimes(2);
    expect(db._store.has("a1")).toBe(false);
    expect(db._store.has("a2")).toBe(true); // retried
    expect(db._store.get("a2")?.retry_count).toBe(1);
    expect(db._store.has("a3")).toBe(false);
  });

  // --------------------------------------------------------------------- //
  // Hard error (db open) returns zeroed counters instead of throwing      //
  // --------------------------------------------------------------------- //

  it("returns zero counters when getAll throws (no crash to caller)", async () => {
    const db = {
      getAll: vi.fn(async () => {
        throw new Error("IDB blocked");
      }),
      put: vi.fn(),
      delete: vi.fn(),
    };
    const { client } = makeSupabase();

    const res = await syncPendingReports(client as never, "fiscal-1", db as never);

    expect(res).toEqual({ synced: 0, dropped: 0, total: 0 });
  });
});
