// P0.2 STORAGE — Server functions for persisted document metadata and secure
// viewing/deletion. Direct browser access to `public.documents` is revoked;
// EVERY caller must pass through:
//   1. `requireSupabaseAuth` (bearer token → context.userId)
//   2. `requireDocumentRole` (admin | disposition | finanz)
//   3. `supabaseAdmin` (RLS-bypassing service role)
//
// Invariants:
// - No client input can nominate a storage path, bucket, uploader,
//   status, or role. `id` is the only identifier the browser sends.
// - The client DTO NEVER carries `storage_path`, `uploaded_by`,
//   `hochgeladen_von`, delete metadata, or the internal status field.
// - Deletion is idempotent and recovery-safe via the P0.1 `status` column:
//   active → pending_delete → (storage removed) → row removed. A failure
//   in `storage.remove` never returns success.
// - Errors are surfaced as `throw new Response(status)` so 401/403/404/500
//   are visible to callers and runtime tests, not as unfiltered 500s.
// - Raw Postgres / storage messages never reach the browser and are only
//   logged with sanitised, path-less operation labels.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { documentAuthStatusMiddleware } from "@/lib/documents-auth.middleware";
import {
  parseDocumentClientRow,
  CLIENT_DOCUMENT_COLUMNS,
  type DokumentRecord,
} from "@/lib/documents-shared";

const SIGNED_URL_TTL_SECONDS = 600;

/** Nicht-enumerierende Meldung – gibt nie preis, ob ein fremdes Dokument existiert. */
const NICHT_VERFUEGBAR = "Dokument nicht gefunden oder kein Zugriff.";

async function serverGate(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { requireDocumentRole } = await import("@/lib/documents-security.server");
  const role = await requireDocumentRole(userId);
  return { supabaseAdmin, role };
}

/** Zod-freier ID-Validator: liefert bei ungültiger UUID kontrolliert 400. */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function parseIdInput(raw: unknown): { id: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Response("Ungültige Anfrage.", { status: 400 });
  }
  const id = (raw as { id?: unknown }).id;
  if (typeof id !== "string" || !UUID_REGEX.test(id)) {
    throw new Response("Ungültige Dokument-ID.", { status: 400 });
  }
  return { id };
}

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([documentAuthStatusMiddleware, requireSupabaseAuth])
  .handler(async ({ context }): Promise<DokumentRecord[]> => {
    const { supabaseAdmin } = await serverGate(context.userId);
    const { data, error } = await supabaseAdmin
      .from("documents")
      .select(CLIENT_DOCUMENT_COLUMNS)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[documents] list failed");
      throw new Response("Serverstörung.", { status: 500 });
    }
    try {
      return (data ?? []).map((r) => parseDocumentClientRow(r));
    } catch {
      console.error("[documents] list projection invalid");
      throw new Response("Serverstörung.", { status: 500 });
    }
  });


/**
 * Kurzlebige (≤ 600 s) signierte URL für ein Dokument. Autorisierung über
 * zentrales Role-Gate; der Storage-Pfad wird ausschließlich serverseitig
 * aus der `active`-Zeile bezogen. `pending_delete`-Dokumente sind nicht
 * signierbar; unbekannte, fremde und pending IDs erhalten dieselbe Antwort.
 */
export const getDocumentSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ url: string; expiresIn: number }> => {
    const { supabaseAdmin } = await serverGate(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("documents")
      .select("storage_path")
      .eq("id", data.id)
      .eq("status", "active")
      .maybeSingle();
    if (error) {
      console.error("[documents] sign read failed");
      throw new Response("Serverstörung.", { status: 500 });
    }
    if (!row) throw new Response(NICHT_VERFUEGBAR, { status: 404 });
    const storagePath = row.storage_path;

    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (sErr || !signed?.signedUrl) {
      console.error("[documents] createSignedUrl failed");
      throw new Response("Signierte URL konnte nicht erstellt werden.", { status: 500 });
    }
    return { url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS };
  });

/**
 * Idempotenter, recovery-sicherer Löschvorgang.
 *
 * 1. Existenz-/Rollenprüfung (nur ID).
 * 2. Zeile auf `pending_delete` markieren (mit Zeitstempel).
 * 3. Storage-Objekt entfernen. Fehler → persistierter Fehlercode und 500.
 * 4. Metadatenzeile löschen. Fehler → persistierter Fehlercode und 500.
 *
 * Persistierte `delete_error`-Werte sind bewusst kontrollierte Codes
 * (`storage_remove_failed`, `metadata_delete_failed`); rohe Postgres-/
 * Storage-Meldungen verlassen den Server nicht.
 */
export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await serverGate(context.userId);

    // 1. Existenz prüfen (nur ID lesen).
    const { data: row, error: selErr } = await supabaseAdmin
      .from("documents")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (selErr) {
      console.error("[documents] delete select failed");
      throw new Response("Serverstörung.", { status: 500 });
    }
    if (!row) throw new Response(NICHT_VERFUEGBAR, { status: 404 });

    // 2. Pending markieren und Storage-Pfad lesen.
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
      console.error("[documents] mark pending failed");
      throw new Response("Löschen konnte nicht vorbereitet werden.", { status: 500 });
    }
    const storagePath = pending.storage_path;

    // 3. Storage-Objekt entfernen.
    const { data: removed, error: remErr } = await supabaseAdmin.storage
      .from("documents")
      .remove([storagePath]);
    if (remErr) {
      await supabaseAdmin
        .from("documents")
        .update({ delete_error: "storage_remove_failed" })
        .eq("id", data.id);
      console.error("[documents] storage.remove failed");
      throw new Response("Datei konnte nicht entfernt werden. Bitte erneut versuchen.", {
        status: 500,
      });
    }
    // remove() liefert leeres Array wenn das Objekt bereits fehlte – für
    // idempotente Wiederholungen wird dies als Erfolg gewertet.
    void removed;

    // 4. Metadatenzeile löschen.
    const { error: delErr } = await supabaseAdmin.from("documents").delete().eq("id", data.id);
    if (delErr) {
      await supabaseAdmin
        .from("documents")
        .update({ delete_error: "metadata_delete_failed" })
        .eq("id", data.id);
      console.error("[documents] row delete failed");
      throw new Response("Metadaten konnten nicht entfernt werden. Bitte erneut versuchen.", {
        status: 500,
      });
    }

    return { ok: true };
  });

/**
 * Best-effort Wiederholung offener Upload-Rollback-Cleanup-Jobs.
 * Streng begrenzt (max. 5 pro Aufruf); nur nach zentralem Role-Gate; nimmt
 * keine client-übergebenen Pfade an. Gibt nur einen numerischen Zähler
 * zurück – keine Pfade, keine Fehlerdetails.
 */
export const retryDocumentCleanup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ processed: number }> => {
    const { supabaseAdmin } = await serverGate(context.userId);
    const { data: jobs, error } = await supabaseAdmin
      .from("document_cleanup_jobs")
      .select("id, storage_path, versuche")
      .order("created_at", { ascending: true })
      .limit(5);
    if (error) {
      console.error("[documents] cleanup fetch failed");
      throw new Response("Serverstörung.", { status: 500 });
    }
    let processed = 0;
    for (const job of jobs ?? []) {
      const { error: remErr } = await supabaseAdmin.storage
        .from("documents")
        .remove([job.storage_path]);
      if (remErr) {
        await supabaseAdmin
          .from("document_cleanup_jobs")
          .update({
            versuche: (job.versuche ?? 0) + 1,
            letzter_versuch_am: new Date().toISOString(),
            fehler_code: "storage_remove_failed",
          })
          .eq("id", job.id);
        continue;
      }
      const { error: delErr } = await supabaseAdmin
        .from("document_cleanup_jobs")
        .delete()
        .eq("id", job.id);
      if (!delErr) processed += 1;
    }
    return { processed };
  });
