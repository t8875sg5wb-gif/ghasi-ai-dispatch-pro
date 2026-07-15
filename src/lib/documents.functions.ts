// Server functions for persisted documents metadata + secure viewing/deletion.
// File bytes live in the private Supabase Storage bucket "documents".
// Uploads are handled by the /api/documents/upload server route.
// All access here is authenticated; storage.objects has no client policies,
// so signed URLs and deletions must go through this server layer.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  rowToDokument,
  type DocumentRow,
  type DokumentRecord,
} from "@/lib/documents-shared";

const SIGNED_URL_TTL_SECONDS = 600;

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DokumentRecord[]> => {
    const { data, error } = await context.supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToDokument(r as unknown as DocumentRow));
  });

/**
 * Erzeugt eine kurzlebige (≤ 600 s) signierte URL für ein Dokument.
 * Autorisierung erfolgt über die documents-Tabellen-RLS: ohne passende
 * Rolle liefert `.select` keine Zeile und wir liefern 404. Der Storage-Pfad
 * wird ausschließlich serverseitig aus der Dokumentzeile bezogen; ein
 * client-übergebener Pfad wird niemals akzeptiert.
 */
export const getDocumentSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ url: string; expiresIn: number }> => {
    const { data: row, error } = await context.supabase
      .from("documents")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Dokument nicht gefunden oder kein Zugriff.");
    const storagePath = (row as { storage_path: string }).storage_path;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (sErr || !signed?.signedUrl) {
      throw new Error(sErr?.message ?? "Signierte URL konnte nicht erstellt werden.");
    }
    return { url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS };
  });

/**
 * Löscht ein Dokument autorisiert per ID: RLS-geprüfte Zeilenlöschung
 * plus serverseitige Entfernung des Storage-Objekts (Admin-Client, weil
 * storage.objects keine Client-Policies mehr trägt). Der Client übergibt
 * niemals einen Storage-Pfad.
 */
export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: row, error: selErr } = await context.supabase
      .from("documents")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Dokument nicht gefunden oder kein Zugriff.");
    const storagePath = (row as { storage_path: string }).storage_path;

    const { error: delErr } = await context.supabase
      .from("documents")
      .delete()
      .eq("id", data.id);
    if (delErr) throw new Error(delErr.message);

    // Nach erfolgreicher Metadatenlöschung Storage-Objekt entfernen.
    // Fehler hier hinterlässt höchstens eine Waise; die reguläre
    // Orphan-Bereinigung (P0-Inventar) räumt diese auf.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from("documents").remove([storagePath]);

    return { ok: true };
  });
