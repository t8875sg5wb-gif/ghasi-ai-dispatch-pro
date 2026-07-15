// Client/server split for documents:
// - `DokumentRecord` is the CLIENT DTO. It intentionally omits every
//   server-only field (storage_path, uploaded_by, status, delete_error, …).
//   The browser NEVER receives the internal storage path.
// - `DocumentRow` is the raw DB row shape used server-side only.
// - `documentRowToClientDto` is the single mapper both server-fn readers and
//   the upload route use to build the client DTO. It also re-derives the
//   navigation route for a `bezug` from its type, so the persisted row does
//   not have to carry (and cannot spoof) a client-side deep link.
import type { DokumentKategorie, DokumentFormat, DokumentBezugTyp } from "@/lib/documents";
import { bezugRoute } from "@/lib/documents";

/** Client-facing DTO. Contains ONLY fields the browser is allowed to see. */
export interface DokumentRecord {
  id: string;
  name: string;
  kategorie: DokumentKategorie;
  format: DokumentFormat;
  ordner: string;
  tags: string[];
  bezug?: { typ: DokumentBezugTyp; label: string; to: string };
  groesseKb: number;
  ocrText?: string;
  hochgeladenVon: string;
  hochgeladenAm: string; // ISO (created_at)
  status: "active" | "pending_delete";
}

/** Server-only DB row shape. Never leave the server layer with this. */
export interface DocumentRow {
  id: string;
  name: string;
  kategorie: string;
  format: string;
  ordner: string;
  tags: unknown;
  bezug: unknown;
  storage_path: string;
  groesse_kb: number;
  ocr_text: string | null;
  hochgeladen_von: string;
  created_at: string;
  status?: string | null;
}

/** Explicit whitelist of columns the client may ever read. */
export const CLIENT_DOCUMENT_COLUMNS =
  "id,name,kategorie,format,ordner,tags,bezug,groesse_kb,ocr_text,hochgeladen_von,created_at,status" as const;

/** Server-only → client DTO. Strips `storage_path`, `uploaded_by`, errors, etc. */
export function documentRowToClientDto(r: DocumentRow): DokumentRecord {
  const bezugRaw = r.bezug as { typ?: unknown; label?: unknown } | null;
  let bezug: DokumentRecord["bezug"] | undefined;
  if (
    bezugRaw &&
    typeof bezugRaw === "object" &&
    typeof bezugRaw.typ === "string" &&
    typeof bezugRaw.label === "string"
  ) {
    const to = bezugRoute(bezugRaw.typ as DokumentBezugTyp);
    if (to) {
      bezug = {
        typ: bezugRaw.typ as DokumentBezugTyp,
        label: bezugRaw.label,
        to,
      };
    }
  }
  const status =
    r.status === "pending_delete" ? "pending_delete" : ("active" as DokumentRecord["status"]);
  return {
    id: r.id,
    name: r.name ?? "",
    kategorie: (r.kategorie as DokumentKategorie) ?? "patientendokument",
    format: (r.format as DokumentFormat) ?? "pdf",
    ordner: r.ordner ?? "Allgemein",
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    bezug,
    groesseKb: r.groesse_kb ?? 0,
    ocrText: r.ocr_text ?? undefined,
    hochgeladenVon: r.hochgeladen_von ?? "",
    hochgeladenAm: r.created_at,
    status,
  };
}

/** Derive a document format bucket from a MIME type / filename. */
export function formatVonDatei(file: File): DokumentFormat {
  const t = file.type.toLowerCase();
  const n = file.name.toLowerCase();
  if (t.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic)$/.test(n)) return "bild";
  if (t === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (
    t.includes("spreadsheet") ||
    t.includes("excel") ||
    t === "text/csv" ||
    /\.(csv|xlsx?|ods)$/.test(n)
  )
    return "tabelle";
  return "text";
}
