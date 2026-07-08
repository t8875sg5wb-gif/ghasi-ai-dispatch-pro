// Server functions for persisted documents metadata.
// File bytes live in the private Supabase Storage bucket "documents"; these
// functions only manage the metadata rows (RLS enforces staff access).
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  rowToDokument,
  dokumentToRow,
  type DocumentRow,
  type DokumentRecord,
  type DokumentWrite,
} from "@/lib/documents-shared";

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

export const createDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: DokumentWrite) => {
    if (!data || typeof data.name !== "string" || !data.name.trim()) {
      throw new Error("name ist erforderlich");
    }
    if (!data.storagePath) throw new Error("storagePath ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<DokumentRecord> => {
    const { data: created, error } = await context.supabase
      .from("documents")
      .insert(dokumentToRow(data) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToDokument(created as unknown as DocumentRow);
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ ok: true; storagePath: string | null }> => {
    // Fetch the storage path so the caller can also delete the file object.
    const { data: row } = await context.supabase
      .from("documents")
      .select("storage_path")
      .eq("id", data.id)
      .single();
    const { error } = await context.supabase.from("documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, storagePath: (row as { storage_path: string } | null)?.storage_path ?? null };
  });
