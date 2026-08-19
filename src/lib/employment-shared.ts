import { z } from "zod";

// Client-sichere Typen & Mapper für Beschäftigungsverhältnisse (Finanzbereich).
//
// FACHREGELN (serverseitig/DB-seitig erzwungen, hier nur gespiegelt):
// - Entweder Stundenlohn ODER festes Monatsbrutto – niemals beides.
// - Neue Datensätze starten immer im Status "pruefung_erforderlich".
// - Verifizierung nur durch eine zweite berechtigte Person (DB-Trigger).
// - Verifizierte Zeiträume desselben Fahrers dürfen sich nie überschneiden
//   (EXCLUDE-Constraint `employment_no_overlap_verified`).
// - Es wird KEIN Betrag geraten oder vorbelegt.

export type Verguetungsart = "stundenlohn" | "monatsbrutto";
export type BeschaeftigungsStatus = "pruefung_erforderlich" | "verifiziert";

export const VERGUETUNGSART_LABEL: Record<Verguetungsart, string> = {
  stundenlohn: "Stundenlohn",
  monatsbrutto: "Festes Monatsbrutto",
};

export const BESCHAEFTIGUNG_STATUS_LABEL: Record<BeschaeftigungsStatus, string> = {
  pruefung_erforderlich: "Prüfung erforderlich",
  verifiziert: "Verifiziert",
};

export interface Beschaeftigungsverhaeltnis {
  id: string;
  fahrerId: string;
  verguetungsart: Verguetungsart;
  /** Nur gesetzt bei `verguetungsart === "stundenlohn"`. */
  stundenlohn: number | null;
  /** Nur gesetzt bei `verguetungsart === "monatsbrutto"`. */
  monatsbrutto: number | null;
  gueltigAb: string;
  gueltigBis: string | null;
  status: BeschaeftigungsStatus;
  version: number;
  notiz: string;
  erstelltVon: string | null;
  verifiziertVon: string | null;
  verifiziertAm: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BeschaeftigungsverhaeltnisWrite {
  fahrerId: string;
  verguetungsart: Verguetungsart;
  stundenlohn?: number | null;
  monatsbrutto?: number | null;
  gueltigAb: string;
  gueltigBis?: string | null;
  notiz?: string;
}

export interface EmploymentRow {
  id: string;
  driver_id: string;
  verguetungsart: string;
  stundenlohn: number | string | null;
  monatsbrutto: number | string | null;
  gueltig_ab: string;
  gueltig_bis: string | null;
  status: string;
  version: number;
  notiz: string | null;
  created_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmploymentAuditRow {
  id: string;
  employment_id: string;
  driver_id: string | null;
  aktion: string;
  version: number | null;
  akteur_user_id: string | null;
  old_row: unknown;
  new_row: unknown;
  created_at: string;
}

export interface BeschaeftigungsAudit {
  id: string;
  beschaeftigungId: string;
  fahrerId: string | null;
  aktion: string;
  version: number | null;
  akteurUserId: string | null;
  /** Vorher-/Nachher-Stand als JSON-Text (serialisierbar, nur zur Anzeige). */
  altWert: string | null;
  neuWert: string | null;
  createdAt: string;
}

function num(v: number | string | null): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function rowToBeschaeftigung(r: EmploymentRow): Beschaeftigungsverhaeltnis {
  const art: Verguetungsart = r.verguetungsart === "monatsbrutto" ? "monatsbrutto" : "stundenlohn";
  return {
    id: r.id,
    fahrerId: r.driver_id,
    verguetungsart: art,
    stundenlohn: num(r.stundenlohn),
    monatsbrutto: num(r.monatsbrutto),
    gueltigAb: r.gueltig_ab,
    gueltigBis: r.gueltig_bis ?? null,
    status: r.status === "verifiziert" ? "verifiziert" : "pruefung_erforderlich",
    version: Number(r.version) || 1,
    notiz: r.notiz ?? "",
    erstelltVon: r.created_by ?? null,
    verifiziertVon: r.verified_by ?? null,
    verifiziertAm: r.verified_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function rowToAudit(r: EmploymentAuditRow): BeschaeftigungsAudit {
  return {
    id: r.id,
    beschaeftigungId: r.employment_id,
    fahrerId: r.driver_id ?? null,
    aktion: r.aktion,
    version: r.version ?? null,
    akteurUserId: r.akteur_user_id ?? null,
    altWert: r.old_row == null ? null : JSON.stringify(r.old_row),
    neuWert: r.new_row == null ? null : JSON.stringify(r.new_row),
    createdAt: r.created_at,
  };
}

/**
 * Patch-Semantik (CP33-Muster): ausgelassene Felder erzeugen KEINEN Schlüssel,
 * damit Teil-Updates keine bestehenden Werte überschreiben. Explizite `null`
 * werden bewusst geschrieben.
 */
export function beschaeftigungToRow(
  w: Partial<BeschaeftigungsverhaeltnisWrite>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set("driver_id", w.fahrerId);
  set("verguetungsart", w.verguetungsart);
  set("stundenlohn", w.stundenlohn);
  set("monatsbrutto", w.monatsbrutto);
  set("gueltig_ab", w.gueltigAb);
  set("gueltig_bis", w.gueltigBis);
  set("notiz", w.notiz);
  return row;
}

/**
 * Übersetzt DB-Fehler in klare deutsche Meldungen, ohne SQL-Details zu zeigen.
 * Wird sowohl serverseitig als auch (für Tests) isoliert verwendet.
 */
export function mapEmploymentDbError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("employment_no_overlap_verified") || m.includes("conflicting key value")) {
    return "Zeitliche Überschneidung: Für diesen Fahrer existiert im gewählten Zeitraum bereits ein verifiziertes Beschäftigungsverhältnis.";
  }
  if (m.includes("employment_exactly_one_amount")) {
    return "Es muss genau eine Vergütungsform angegeben werden – Stundenlohn ODER Monatsbrutto.";
  }
  if (m.includes("employment_zeitraum_check")) {
    return "Das Enddatum darf nicht vor dem Startdatum liegen.";
  }
  if (m.includes("zweiten berechtigten person")) {
    return "Ein Beschäftigungsverhältnis muss von einer zweiten berechtigten Person verifiziert werden.";
  }
  if (m.includes("nicht in einem schritt")) {
    return "Inhaltliche Änderung und Verifizierung sind nicht in einem Schritt möglich.";
  }
  if (m.includes("kein zugriff") || m.includes("row-level security") || m.includes("permission")) {
    return "Kein Zugriff: Beschäftigungsverhältnisse dürfen nur von Administration oder Finanzen bearbeitet werden.";
  }
  return "Die Änderung konnte nicht gespeichert werden.";
}

/* ------------------------------------------------------------------ *
 * Validierungsschemata (client-sicher, von den Serverfunktionen genutzt)
 * ------------------------------------------------------------------ */

const isoDatum = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-DD sein.");

/**
 * Genau EINE Vergütungsform. Es wird bewusst nichts vorbelegt oder geraten:
 * fehlt der zur Vergütungsart passende Betrag, schlägt die Validierung fehl.
 */
export function genauEineVerguetung(v: {
  verguetungsart?: unknown;
  stundenlohn?: unknown;
  monatsbrutto?: unknown;
}): boolean {
  if (v.verguetungsart === "stundenlohn") {
    return typeof v.stundenlohn === "number" && v.stundenlohn > 0 && v.monatsbrutto == null;
  }
  if (v.verguetungsart === "monatsbrutto") {
    return typeof v.monatsbrutto === "number" && v.monatsbrutto > 0 && v.stundenlohn == null;
  }
  return false;
}

export const employmentFieldsSchema = z
  .object({
    fahrerId: z.string().uuid(),
    verguetungsart: z.enum(["stundenlohn", "monatsbrutto"]),
    stundenlohn: z.number().positive().max(1000).nullable().optional(),
    monatsbrutto: z.number().positive().max(1_000_000).nullable().optional(),
    gueltigAb: isoDatum,
    gueltigBis: isoDatum.nullable().optional(),
    notiz: z.string().max(2000).optional(),
  })
  .strict();

const EIN_BETRAG_MSG =
  "Es muss genau eine Vergütungsform angegeben werden – Stundenlohn ODER Monatsbrutto.";
const ZEITRAUM_MSG = "Das Enddatum darf nicht vor dem Startdatum liegen.";

export const createEmploymentSchema = employmentFieldsSchema
  .refine(genauEineVerguetung, { message: EIN_BETRAG_MSG, path: ["verguetungsart"] })
  .refine((v) => !v.gueltigBis || v.gueltigBis >= v.gueltigAb, {
    message: ZEITRAUM_MSG,
    path: ["gueltigBis"],
  });

/**
 * Änderungen werden immer als vollständiger Satz übergeben – so kann die
 * Ein-Betrag-Regel auch bei Änderungen zuverlässig geprüft werden.
 */
export const updateEmploymentSchema = z
  .object({ id: z.string().uuid(), values: employmentFieldsSchema })
  .strict()
  .refine((v) => genauEineVerguetung(v.values), {
    message: EIN_BETRAG_MSG,
    path: ["values", "verguetungsart"],
  })
  .refine((v) => !v.values.gueltigBis || v.values.gueltigBis >= v.values.gueltigAb, {
    message: ZEITRAUM_MSG,
    path: ["values", "gueltigBis"],
  });

export const employmentIdSchema = z.object({ id: z.string().uuid() }).strict();
