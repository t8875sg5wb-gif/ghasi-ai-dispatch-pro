// P0.2 – Client/server split for documents.
//
// - `DokumentRecord` is the CLIENT DTO. It intentionally omits every
//   server-only or identifying field (`storage_path`, `uploaded_by`,
//   `hochgeladen_von`, `status`, `delete_error`, `delete_attempted_at`).
//   The browser NEVER receives an internal storage path OR the uploader
//   identity.
// - `DocumentClientProjectionRow` is the exact DB row shape produced by
//   selecting `CLIENT_DOCUMENT_COLUMNS`. `documentRowToClientDto` uses
//   ONLY these fields — the typed mapper cannot accidentally read
//   `storage_path`, `hochgeladen_von`, `uploaded_by`, `status`, etc.
// - Deep-link `bezug.to` is re-derived server-side from `bezug.typ`; the
//   persisted row cannot spoof a client-side navigation target.
import type { DokumentKategorie, DokumentFormat, DokumentBezugTyp } from "@/lib/documents";
import { bezugRoute } from "@/lib/documents";

/** Client-facing DTO. ONLY fields the browser is allowed to see. */
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
  hochgeladenAm: string; // ISO (created_at)
}

/** Whitelist of DB columns the browser may ever read. */
export const CLIENT_DOCUMENT_COLUMNS =
  "id,name,kategorie,format,ordner,tags,bezug,groesse_kb,ocr_text,created_at" as const;

/** DB row shape produced by SELECTing exactly `CLIENT_DOCUMENT_COLUMNS`. */
export interface DocumentClientProjectionRow {
  id: string;
  name: string | null;
  kategorie: string | null;
  format: string | null;
  ordner: string | null;
  tags: unknown;
  bezug: unknown;
  groesse_kb: number | null;
  ocr_text: string | null;
  created_at: string;
}

/** Typed mapper – no `as unknown as` bypass. */
export function documentRowToClientDto(r: DocumentClientProjectionRow): DokumentRecord {
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
      bezug = { typ: bezugRaw.typ as DokumentBezugTyp, label: bezugRaw.label, to };
    }
  }
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
    hochgeladenAm: r.created_at,
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

/**
 * Bereinigt einen vom Browser gelieferten Dateinamen: Basename ohne
 * Pfad-Trenner, ohne Steuerzeichen, max. 200 Zeichen. Der Wert taucht
 * niemals im Storage-Pfad auf; er ist reine Anzeige-Metadata.
 */
export function bereinigeDateiname(raw: string | undefined): string {
  const s = (raw ?? "").split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const ohneSteuerzeichen = s.replace(/[\x00-\x1F\x7F]/g, "");
  const gekuerzt = ohneSteuerzeichen.trim().slice(0, 200);
  return gekuerzt || "dokument";
}
