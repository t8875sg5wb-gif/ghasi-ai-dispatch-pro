// P0.1 STORAGE — Server functions for persisted documents metadata + secure
// viewing/deletion.
//
// Key invariants:
// - Client DTOs never carry `storage_path`, `uploaded_by`, or delete metadata.
//   The row is projected to an explicit column whitelist and mapped through
//   `documentRowToClientDto` before it leaves the server.
// - `getDocumentSignedUrl` / `deleteDocument` are strictly id-based; the
//   browser can never nominate a storage path or bucket.
// - Deletion is idempotent and recovery-safe via a persistent `status`
//   column: `active` → `pending_delete` → (storage removed) → row removed.
//   A failure in `storage.remove` never returns success and can be retried.
// - `status = 'pending_delete'` rows are hidden from lists and cannot be
//   signed for viewing; the delete action re-runs cleanup on the same id.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  documentRowToClientDto,
  CLIENT_DOCUMENT_COLUMNS,
  type DocumentRow,
  type DokumentRecord,
} from "@/lib/documents-shared";

const SIGNED_URL_TTL_SECONDS = 600;

/** Generische Meldung – gibt niemals preis, ob ein fremdes Dokument existiert. */
const NICHT_VERFUEGBAR = "Dokument nicht gefunden oder kein Zugriff.";

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DokumentRecord[]> => {
    const { data, error } = await context.supabase
      .from("documents")
      .select(CLIENT_DOCUMENT_COLUMNS)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => documentRowToClientDto(r as unknown as DocumentRow));
  });

/**
 * Kurzlebige (≤ 600 s) signierte URL für ein Dokument. Autorisierung erfolgt
 * über die documents-Tabellen-RLS (nur admin/disposition/finanz); der Storage-
 * Pfad wird ausschließlich serverseitig aus der Zeile bezogen. `pending_delete`-
 * Dokumente sind nicht signierbar.
 */
export const getDocumentSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ url: string; expiresIn: number }> => {
    const { data: row, error } = await context.supabase
      .from("documents")
      .select("storage_path, status")
      .eq("id", data.id)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error(NICHT_VERFUEGBAR);
    const storagePath = (row as { storage_path: string }).storage_path;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (sErr || !signed?.signedUrl) {
      // Nur intern loggen, dem Client keine Detailmeldung geben.
      console.error("[documents] createSignedUrl failed", sErr?.message);
      throw new Error("Signierte URL konnte nicht erstellt werden.");
    }
    return { url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS };
  });

/**
 * Idempotenter, recovery-sicherer Löschvorgang.
 *
 * Ablauf:
 *  1. Zeile RLS-geprüft anhand der ID lesen (verrät nichts, wenn nicht
 *     berechtigt oder nicht existent).
 *  2. Zeile auf `pending_delete` markieren (mit Zeitstempel). Ist sie schon
 *     pending, wird derselbe Pfad erneut aufgeräumt.
 *  3. Storage-Objekt entfernen. Fehler werden persistiert (`delete_error`)
 *     und als 500 zurückgemeldet – nie stiller Erfolg.
 *  4. Nach nachgewiesenem Storage-Erfolg die Metadatenzeile löschen. Schlägt
 *     nur der Row-Delete fehl, bleibt die Zeile pending und ein erneuter
 *     Aufruf finalisiert.
 */
export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    // 1. Zugriff/Existenz über den user-scoped Client prüfen (RLS).
    const { data: row, error: selErr } = await context.supabase
      .from("documents")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error(NICHT_VERFUEGBAR);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 2. Auf pending_delete markieren und Storage-Pfad in derselben Abfrage lesen.
    const { data: pending, error: markErr } = await supabaseAdmin
      .from("documents")
      .update({
        status: "pending_delete",
        delete_attempted_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("storage_path")
      .single();
    if (markErr || !pending) {
      throw new Error("Löschen konnte nicht vorbereitet werden.");
    }
    const storagePath = (pending as { storage_path: string }).storage_path;

    // 3. Storage-Objekt tatsächlich entfernen.
    const { data: removed, error: remErr } = await supabaseAdmin.storage
      .from("documents")
      .remove([storagePath]);
    if (remErr) {
      await supabaseAdmin
        .from("documents")
        .update({ delete_error: remErr.message.slice(0, 300) })
        .eq("id", data.id);
      console.error("[documents] storage.remove failed", remErr.message);
      throw new Error("Datei konnte nicht entfernt werden. Bitte erneut versuchen.");
    }
    // remove() liefert leeres Array wenn das Objekt bereits fehlt – für
    // idempotente Wiederholungen wird dies ebenfalls als Erfolg gewertet.
    void removed;

    // 4. Metadatenzeile löschen. Fehler ≠ Erfolg – Retry finalisiert.
    const { error: delErr } = await supabaseAdmin.from("documents").delete().eq("id", data.id);
    if (delErr) {
      await supabaseAdmin
        .from("documents")
        .update({ delete_error: delErr.message.slice(0, 300) })
        .eq("id", data.id);
      console.error("[documents] row delete failed", delErr.message);
      throw new Error("Metadaten konnten nicht entfernt werden. Bitte erneut versuchen.");
    }

    return { ok: true };
  });
