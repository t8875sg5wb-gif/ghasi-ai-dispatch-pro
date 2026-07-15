// P0.2 – Client/server split for documents.
//
// - `DokumentRecord` is the CLIENT DTO. It intentionally omits every
//   server-only or identifying field (`storage_path`, `uploaded_by`,
//   `hochgeladen_von`, `status`, `delete_error`, `delete_attempted_at`).
//   The browser NEVER receives an internal storage path OR the uploader
//   identity.
// - `documentClientProjectionSchema` is a real runtime Zod boundary for
//   the columns selected via `CLIENT_DOCUMENT_COLUMNS`. `parseDocumentClientRow`
//   validates + maps in one step and needs NO `as unknown as` casts.
// - Deep-link `bezug.to` is re-derived server-side from `bezug.typ`; the
//   persisted row cannot spoof a client-side navigation target.
import { z } from "zod";

import {
  DOKUMENT_KATEGORIEN,
  DOKUMENT_BEZUG_TYPEN,
  bezugRoute,
  type DokumentKategorie,
  type DokumentFormat,
  type DokumentBezugTyp,
} from "@/lib/documents";

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

const DOKUMENT_FORMATE = ["pdf", "bild", "tabelle", "text"] as const satisfies readonly DokumentFormat[];

/**
 * Runtime Zod schema for a `bezug` value read from the database. Unknown
 * persisted keys (e.g. a legacy `to`) are silently dropped; a missing or
 * malformed value collapses to `null` via `.catch(null)` in the parent.
 */
const bezugProjectionSchema = z
  .object({
    typ: z.enum(DOKUMENT_BEZUG_TYPEN),
    label: z.string().max(240),
  })
  .transform((b) => ({ typ: b.typ, label: b.label }));

/**
 * Real projection boundary. Only accepts values shaped like
 * `CLIENT_DOCUMENT_COLUMNS`; unrelated columns cannot appear because the
 * server SELECT never reads them.
 */
export const documentClientProjectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  kategorie: z.enum(DOKUMENT_KATEGORIEN).nullable(),
  format: z.enum(DOKUMENT_FORMATE).nullable(),
  ordner: z.string().nullable(),
  tags: z.array(z.string().max(120)).max(50).nullable().catch(null),
  bezug: bezugProjectionSchema.nullable().catch(null),
  groesse_kb: z.number().nullable(),
  ocr_text: z.string().nullable(),
  created_at: z.string(),
});

export type DocumentClientProjection = z.infer<typeof documentClientProjectionSchema>;

/**
 * Validate a single row read from `CLIENT_DOCUMENT_COLUMNS` and project it
 * into the client DTO. Throws on internally corrupt projections; callers
 * MUST catch and surface a generic 500 without leaking internal fields.
 */
export function parseDocumentClientRow(raw: unknown): DokumentRecord {
  const p = documentClientProjectionSchema.parse(raw);
  let bezug: DokumentRecord["bezug"] | undefined;
  if (p.bezug) {
    const to = bezugRoute(p.bezug.typ);
    if (to) bezug = { typ: p.bezug.typ, label: p.bezug.label, to };
  }
  return {
    id: p.id,
    name: p.name ?? "",
    kategorie: p.kategorie ?? "patientendokument",
    format: p.format ?? "pdf",
    ordner: p.ordner ?? "Allgemein",
    tags: p.tags ?? [],
    bezug,
    groesseKb: p.groesse_kb ?? 0,
    ocrText: p.ocr_text ?? undefined,
    hochgeladenAm: p.created_at,
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
