// Client-safe mapping between the persisted `documents` table and the in-app
// persisted document record type. Reuses the category/format metadata from
// `@/lib/documents` so the UI stays consistent with the seed catalogue.
import type { DokumentKategorie, DokumentFormat, DokumentBezug } from "@/lib/documents";

export interface DokumentRecord {
  id: string;
  name: string;
  kategorie: DokumentKategorie;
  format: DokumentFormat;
  ordner: string;
  tags: string[];
  bezug?: DokumentBezug;
  storagePath: string;
  groesseKb: number;
  ocrText?: string;
  hochgeladenVon: string;
  hochgeladenAm: string; // ISO (created_at)
}

export interface DokumentWrite {
  name: string;
  kategorie: DokumentKategorie;
  format: DokumentFormat;
  ordner: string;
  tags: string[];
  bezug?: DokumentBezug | null;
  storagePath: string;
  groesseKb: number;
  ocrText?: string | null;
  hochgeladenVon: string;
}

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
}

export function rowToDokument(r: DocumentRow): DokumentRecord {
  return {
    id: r.id,
    name: r.name ?? "",
    kategorie: (r.kategorie as DokumentKategorie) ?? "patientendokument",
    format: (r.format as DokumentFormat) ?? "pdf",
    ordner: r.ordner ?? "Allgemein",
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    bezug: (r.bezug as DokumentBezug | null) ?? undefined,
    storagePath: r.storage_path,
    groesseKb: r.groesse_kb ?? 0,
    ocrText: r.ocr_text ?? undefined,
    hochgeladenVon: r.hochgeladen_von ?? "",
    hochgeladenAm: r.created_at,
  };
}

export function dokumentToRow(w: Partial<DokumentWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set("name", w.name);
  set("kategorie", w.kategorie);
  set("format", w.format);
  set("ordner", w.ordner);
  set("tags", w.tags);
  set("bezug", w.bezug ?? null);
  set("storage_path", w.storagePath);
  set("groesse_kb", w.groesseKb);
  set("ocr_text", w.ocrText ?? null);
  set("hochgeladen_von", w.hochgeladenVon);
  return row;
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
