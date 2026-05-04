/**
 * Offline sync flow for the fiscal PWA.
 *
 * Pending inspection reports are queued in IndexedDB while offline (camera
 * photo + GPS + result + observations). When the device comes back online,
 * `syncPendingReports` walks the queue, uploads the photo to Storage,
 * inserts the relatório, and flips the alerta status to `Inspecionado`.
 *
 * Failure modes:
 *   - photo upload fails    → bump retry_count, keep record (legal evidence is
 *                              required, so we never insert without the photo)
 *   - relatório insert fails → bump retry_count, keep record
 *   - retry_count >= MAX_SYNC_RETRIES → drop the record (prevents infinite
 *                              loops on permanent errors like RLS denial or
 *                              invalid enum values)
 */
import { openDB, type IDBPDatabase } from "idb";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RelatorioOffline } from "../types";

export const MAX_SYNC_RETRIES = 5;
export const FOTO_BUCKET = "fotos-inspecao";
export const DB_NAME = "fiskix-offline";
export const STORE_NAME = "relatorios";

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export interface SyncResult {
  synced: number;
  dropped: number;
  total: number;
}

/**
 * Open the offline IndexedDB store. Exported separately so callers can
 * substitute a fake in tests via the optional `db` parameter on
 * `syncPendingReports`.
 */
export async function openOfflineDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME, { keyPath: "alerta_id" });
    },
  });
}

export async function syncPendingReports(
  supabase: SupabaseClient,
  fiscalId: string,
  db?: IDBPDatabase,
): Promise<SyncResult> {
  let synced = 0;
  let dropped = 0;
  try {
    const database = db ?? (await openOfflineDB());
    const pending: RelatorioOffline[] = await database.getAll(STORE_NAME);

    for (const r of pending) {
      let fotoUrl: string | null = null;
      let fotoUploadFailed = false;

      // Try to upload the photo (data URL stored offline) before inserting
      // the relatório, otherwise the legal evidence would be lost.
      if (r.foto_data_url) {
        try {
          const blob = dataUrlToBlob(r.foto_data_url);
          const path = `${r.alerta_id}_${Date.now()}.jpg`;
          const { error: upErr } = await supabase.storage
            .from(FOTO_BUCKET)
            .upload(path, blob, { contentType: blob.type, upsert: true });
          if (upErr) {
            fotoUploadFailed = true;
          } else {
            const { data: pub } = supabase.storage
              .from(FOTO_BUCKET)
              .getPublicUrl(path);
            fotoUrl = pub.publicUrl;
          }
        } catch {
          fotoUploadFailed = true;
        }
      }

      if (fotoUploadFailed) {
        const next = { ...r, retry_count: (r.retry_count ?? 0) + 1 };
        if (next.retry_count >= MAX_SYNC_RETRIES) {
          await database.delete(STORE_NAME, r.alerta_id);
          dropped++;
          console.warn("Dropping offline relatório after max retries:", r.alerta_id);
        } else {
          await database.put(STORE_NAME, next);
        }
        continue;
      }

      const { error } = await supabase.from("relatorios_inspecao").insert({
        id_alerta: r.alerta_id,
        id_fiscal: fiscalId,
        resultado: r.resultado,
        tipo_fraude: (r.tipo_fraude ?? null) as
          | "Bypass"
          | "Contador_adulterado"
          | "Ligacao_vizinha"
          | "Ima"
          | "Outro"
          | null,
        foto_url: fotoUrl,
        foto_lat: r.foto_lat ?? null,
        foto_lng: r.foto_lng ?? null,
        observacoes: r.observacoes ?? null,
      });

      if (!error) {
        await supabase
          .from("alertas_fraude")
          .update({ status: "Inspecionado", resultado: r.resultado })
          .eq("id", r.alerta_id);
        await database.delete(STORE_NAME, r.alerta_id);
        synced++;
        continue;
      }

      // Permanent failure (e.g. invalid enum value, RLS denial). Bump retry;
      // drop after MAX_SYNC_RETRIES to prevent infinite loops.
      const next = { ...r, retry_count: (r.retry_count ?? 0) + 1 };
      if (next.retry_count >= MAX_SYNC_RETRIES) {
        await database.delete(STORE_NAME, r.alerta_id);
        dropped++;
        console.warn("Dropping offline relatório after max retries:", r.alerta_id, error);
      } else {
        await database.put(STORE_NAME, next);
      }
    }

    return { synced, dropped, total: pending.length };
  } catch {
    return { synced, dropped, total: 0 };
  }
}
