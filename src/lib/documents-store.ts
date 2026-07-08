// Browser store for persisted documents. File bytes go to the private
// Supabase Storage bucket "documents" via the authenticated browser client
// (storage RLS applies); metadata rows are managed by server functions.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { listDocuments, createDocument, deleteDocument } from "@/lib/documents.functions";
import {
  formatVonDatei,
  type DokumentRecord,
  type DokumentWrite,
} from "@/lib/documents-shared";
import type { DokumentKategorie, DokumentBezug } from "@/lib/documents";

export const DOCUMENTS_QUERY_KEY = ["documents"] as const;
const BUCKET = "documents";

export function useDocuments() {
  const fetchDocuments = useServerFn(listDocuments);
  return useQuery({
    queryKey: DOCUMENTS_QUERY_KEY,
    queryFn: () => fetchDocuments(),
    staleTime: 30_000,
  });
}

export interface UploadDocumentInput {
  file: File;
  kategorie: DokumentKategorie;
  ordner: string;
  tags: string[];
  bezug?: DokumentBezug | null;
  hochgeladenVon: string;
}

export function useUploadDocument() {
  const qc = useQueryClient();
  const create = useServerFn(createDocument);
  return useMutation({
    mutationFn: async (input: UploadDocumentInput): Promise<DokumentRecord> => {
      const safeName = input.file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, input.file, { upsert: false, contentType: input.file.type || undefined });
      if (upErr) throw new Error(upErr.message);

      const write: DokumentWrite = {
        name: input.file.name,
        kategorie: input.kategorie,
        format: formatVonDatei(input.file),
        ordner: input.ordner || "Allgemein",
        tags: input.tags,
        bezug: input.bezug ?? null,
        storagePath: path,
        groesseKb: Math.max(1, Math.round(input.file.size / 1024)),
        hochgeladenVon: input.hochgeladenVon,
      };
      try {
        return await create({ data: write });
      } catch (e) {
        // Roll back the uploaded object if the metadata insert failed.
        await supabase.storage.from(BUCKET).remove([path]);
        throw e;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  const del = useServerFn(deleteDocument);
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await del({ data: { id } });
      if (res.storagePath) {
        await supabase.storage.from(BUCKET).remove([res.storagePath]);
      }
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY }),
  });
}

/** Create a short-lived signed URL for viewing/downloading a private file. */
export async function signedDocumentUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}
