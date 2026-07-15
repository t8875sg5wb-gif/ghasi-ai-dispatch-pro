// P0_STORAGE — Client store for persisted documents.
// The browser MUST NOT touch Supabase Storage directly anymore:
//  - Uploads run through the authorized /api/documents/upload server route
//    (multipart form-data, bearer token, server-side validation & path).
//  - Signed URLs are minted per document-id via a server function (TTL ≤ 600 s).
//  - Deletion removes both the metadata row and the storage object server-side.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { listDocuments, deleteDocument, getDocumentSignedUrl } from "@/lib/documents.functions";
import type { DokumentRecord } from "@/lib/documents-shared";
import type { DokumentKategorie, DokumentBezugTyp } from "@/lib/documents";

export const DOCUMENTS_QUERY_KEY = ["documents"] as const;

// Client-Vorprüfung (UX-Helfer, keine Autorisierung). Server erzwingt alles nochmal.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ERLAUBTE_ENDUNGEN = new Set(["pdf", "png", "jpg", "jpeg", "webp"]);
const ERLAUBTE_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

function pruefeUploadClient(file: File): void {
  if (file.size <= 0) throw new Error("Datei ist leer.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Datei ist zu groß (max. 10 MiB).");
  const endung = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  if (!ERLAUBTE_ENDUNGEN.has(endung)) {
    throw new Error("Nur PDF, JPEG, PNG oder WebP sind erlaubt.");
  }
  if (file.type && !ERLAUBTE_MIME.has(file.type)) {
    throw new Error("Der Dateityp (MIME) ist nicht erlaubt.");
  }
}

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
  /**
   * Nur `typ` und `label`. Die anzuzeigende Route wird serverseitig aus `typ`
   * abgeleitet – der Client kann keinen Deep-Link speichern.
   */
  bezug?: { typ: DokumentBezugTyp; label: string } | null;
}

async function bearerToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Nicht angemeldet.");
  return token;
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadDocumentInput): Promise<DokumentRecord> => {
      pruefeUploadClient(input.file);
      const token = await bearerToken();
      const form = new FormData();
      form.append("file", input.file);
      form.append("kategorie", input.kategorie);
      form.append("ordner", input.ordner || "Allgemein");
      form.append("tags", JSON.stringify(input.tags ?? []));
      if (input.bezug) form.append("bezug", JSON.stringify(input.bezug));

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        let msg = "Upload fehlgeschlagen.";
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      return (await res.json()) as DokumentRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  const del = useServerFn(deleteDocument);
  return useMutation({
    mutationFn: async (id: string) => {
      await del({ data: { id } });
      return { ok: true as const };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY }),
  });
}

/**
 * Kurzlebige signierte URL (≤ 600 s) für ein Dokument. Autorisierung
 * erfolgt anhand der Dokument-ID auf dem Server; ein Storage-Pfad wird
 * niemals aus dem Client übergeben. Nicht über die TTL hinaus cachen.
 */
export async function signedDocumentUrlById(id: string): Promise<string | null> {
  try {
    const res = await getDocumentSignedUrl({ data: { id } });
    return res.url;
  } catch {
    return null;
  }
}
