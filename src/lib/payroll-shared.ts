// Client-sichere Typen, Mapper & Validierung für die geprüften Lohn-Grundlagen.
//
// Zwei getrennte Datenbereiche (bewusst OHNE jede Berechnung):
//  1) Lohn-Eingabefakten je Fahrer (`payroll_facts`) – frei benennbarer
//     Fakten-Schlüssel + Wert + Gültigkeitszeitraum.
//  2) Lohn-Regelwerke (`payroll_rules`) – organisationsweite Abzugs- und
//     Arbeitgeberkostenregeln mit PFLICHT-Quellenangabe.
//
// FACHREGELN (in der Datenbank per Trigger/Constraint erzwungen, hier nur
// gespiegelt, damit die Oberfläche früh sauber meldet):
// - Neue Datensätze starten in "Prüfung erforderlich" bzw. "Entwurf".
// - Verifizierung nur durch eine ANDERE Person als die erstellende.
// - Jede inhaltliche Änderung setzt den Status zurück und zählt die Version.
// - Verifizierte Zeiträume überschneiden sich nie (EXCLUDE-Constraints).
// - Es wird KEIN Wert geraten oder vorbelegt.
import { z } from "zod";

/* ================================================================== *
 * 1) Lohn-Eingabefakten
 * ================================================================== */

export type LohnFaktStatus = "pruefung_erforderlich" | "verifiziert";

export const LOHN_FAKT_STATUS_LABEL: Record<LohnFaktStatus, string> = {
  pruefung_erforderlich: "Prüfung erforderlich",
  verifiziert: "Verifiziert",
};

export interface LohnFakt {
  id: string;
  fahrerId: string;
  /** Frei benennbarer Schlüssel, z. B. `steuerklasse`, `kv_status`. */
  faktSchluessel: string;
  wert: string;
  gueltigAb: string;
  gueltigBis: string | null;
  status: LohnFaktStatus;
  version: number;
  notiz: string;
  erstelltVon: string | null;
  verifiziertVon: string | null;
  verifiziertAm: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LohnFaktWrite {
  fahrerId: string;
  faktSchluessel: string;
  wert: string;
  gueltigAb: string;
  gueltigBis?: string | null;
  notiz?: string;
}

export interface PayrollFactRow {
  id: string;
  driver_id: string;
  fakt_schluessel: string;
  wert: string;
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

export function rowToLohnFakt(r: PayrollFactRow): LohnFakt {
  return {
    id: r.id,
    fahrerId: r.driver_id,
    faktSchluessel: r.fakt_schluessel,
    wert: r.wert,
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

/** Patch-Semantik (CP33-Muster): ausgelassene Felder erzeugen KEINEN Schlüssel. */
export function lohnFaktToRow(w: Partial<LohnFaktWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set("driver_id", w.fahrerId);
  set("fakt_schluessel", w.faktSchluessel);
  set("wert", w.wert);
  set("gueltig_ab", w.gueltigAb);
  set("gueltig_bis", w.gueltigBis);
  set("notiz", w.notiz);
  return row;
}

/* ================================================================== *
 * 2) Lohn-Regelwerke
 * ================================================================== */

export type RegelStatus = "entwurf" | "verifiziert";
export type RegelKategorie = "arbeitnehmerabzug" | "arbeitgeberkosten";
export type RegelBerechnungsart = "prozent" | "festbetrag";

export const REGEL_STATUS_LABEL: Record<RegelStatus, string> = {
  entwurf: "Entwurf",
  verifiziert: "Verifiziert",
};

export const REGEL_KATEGORIE_LABEL: Record<RegelKategorie, string> = {
  arbeitnehmerabzug: "Arbeitnehmerabzug",
  arbeitgeberkosten: "Arbeitgeberkosten",
};

export const REGEL_ART_LABEL: Record<RegelBerechnungsart, string> = {
  prozent: "Prozentsatz vom Bruttolohn",
  festbetrag: "Fester Betrag",
};

export interface LohnRegel {
  id: string;
  kennung: string;
  bezeichnung: string;
  kategorie: RegelKategorie;
  berechnungsart: RegelBerechnungsart;
  /** Nur gesetzt bei `berechnungsart === "prozent"`. */
  prozentsatz: number | null;
  /** Nur gesetzt bei `berechnungsart === "festbetrag"`. */
  festbetrag: number | null;
  gueltigAb: string;
  gueltigBis: string | null;
  /** PFLICHT – z. B. Gesetzesparagraph oder offizielle Beitragssatz-Quelle. */
  quelle: string;
  /** PFLICHT – Versionsangabe/Stand der Quelle. */
  quelleVersion: string;
  status: RegelStatus;
  version: number;
  notiz: string;
  erstelltVon: string | null;
  verifiziertVon: string | null;
  verifiziertAm: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LohnRegelWrite {
  kennung: string;
  bezeichnung: string;
  kategorie: RegelKategorie;
  berechnungsart: RegelBerechnungsart;
  prozentsatz?: number | null;
  festbetrag?: number | null;
  gueltigAb: string;
  gueltigBis?: string | null;
  quelle: string;
  quelleVersion: string;
  notiz?: string;
}

export interface PayrollRuleRow {
  id: string;
  kennung: string;
  bezeichnung: string;
  kategorie: string;
  berechnungsart: string;
  prozentsatz: number | string | null;
  festbetrag: number | string | null;
  gueltig_ab: string;
  gueltig_bis: string | null;
  quelle: string;
  quelle_version: string;
  status: string;
  version: number;
  notiz: string | null;
  created_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

function num(v: number | string | null): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function rowToLohnRegel(r: PayrollRuleRow): LohnRegel {
  return {
    id: r.id,
    kennung: r.kennung,
    bezeichnung: r.bezeichnung,
    kategorie: r.kategorie === "arbeitgeberkosten" ? "arbeitgeberkosten" : "arbeitnehmerabzug",
    berechnungsart: r.berechnungsart === "festbetrag" ? "festbetrag" : "prozent",
    prozentsatz: num(r.prozentsatz),
    festbetrag: num(r.festbetrag),
    gueltigAb: r.gueltig_ab,
    gueltigBis: r.gueltig_bis ?? null,
    quelle: r.quelle,
    quelleVersion: r.quelle_version,
    status: r.status === "verifiziert" ? "verifiziert" : "entwurf",
    version: Number(r.version) || 1,
    notiz: r.notiz ?? "",
    erstelltVon: r.created_by ?? null,
    verifiziertVon: r.verified_by ?? null,
    verifiziertAm: r.verified_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function lohnRegelToRow(w: Partial<LohnRegelWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set("kennung", w.kennung);
  set("bezeichnung", w.bezeichnung);
  set("kategorie", w.kategorie);
  set("berechnungsart", w.berechnungsart);
  set("prozentsatz", w.prozentsatz);
  set("festbetrag", w.festbetrag);
  set("gueltig_ab", w.gueltigAb);
  set("gueltig_bis", w.gueltigBis);
  set("quelle", w.quelle);
  set("quelle_version", w.quelleVersion);
  set("notiz", w.notiz);
  return row;
}

/* ================================================================== *
 * Audit-Protokoll (identische Struktur für beide Bereiche)
 * ================================================================== */

export interface PayrollAuditRow {
  id: string;
  aktion: string;
  version: number | null;
  akteur_user_id: string | null;
  old_row: unknown;
  new_row: unknown;
  created_at: string;
  fact_id?: string;
  rule_id?: string;
  driver_id?: string | null;
  fakt_schluessel?: string | null;
  kennung?: string | null;
}

export interface PayrollAudit {
  id: string;
  entitaetId: string;
  /** Fahrer-ID (Fakten) bzw. `null` (Regelwerke). */
  fahrerId: string | null;
  /** Fakten-Schlüssel bzw. Regel-Kennung. */
  bezeichner: string | null;
  aktion: string;
  version: number | null;
  akteurUserId: string | null;
  /** Vorher-/Nachher-Stand als JSON-Text (serialisierbar, nur zur Anzeige). */
  altWert: string | null;
  neuWert: string | null;
  createdAt: string;
}

export function rowToPayrollAudit(r: PayrollAuditRow): PayrollAudit {
  return {
    id: r.id,
    entitaetId: r.fact_id ?? r.rule_id ?? "",
    fahrerId: r.driver_id ?? null,
    bezeichner: r.fakt_schluessel ?? r.kennung ?? null,
    aktion: r.aktion,
    version: r.version ?? null,
    akteurUserId: r.akteur_user_id ?? null,
    altWert: r.old_row == null ? null : JSON.stringify(r.old_row),
    neuWert: r.new_row == null ? null : JSON.stringify(r.new_row),
    createdAt: r.created_at,
  };
}

/* ================================================================== *
 * Fehler-Mapping (keine SQL-Details nach außen)
 * ================================================================== */

export function mapPayrollDbError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("payroll_facts_no_overlap_verified")) {
    return "Zeitliche Überschneidung: Für diesen Fahrer existiert für denselben Fakten-Schlüssel bereits ein verifizierter Eintrag im gewählten Zeitraum.";
  }
  if (m.includes("payroll_rules_no_overlap_verified")) {
    return "Zeitliche Überschneidung: Für diese Kennung existiert bereits eine verifizierte Regel im gewählten Zeitraum.";
  }
  if (m.includes("conflicting key value")) {
    return "Zeitliche Überschneidung mit einem bereits verifizierten Eintrag.";
  }
  if (m.includes("payroll_rules_exactly_one_wert")) {
    return "Es muss genau eine Berechnungsart mit passendem Wert angegeben werden – Prozentsatz ODER fester Betrag.";
  }
  if (m.includes("payroll_rules_quelle")) {
    return "Quellenangabe und Quellen-Version sind Pflicht.";
  }
  if (m.includes("zeitraum_check")) {
    return "Das Enddatum darf nicht vor dem Startdatum liegen.";
  }
  if (m.includes("schluessel_check") || m.includes("kennung_check")) {
    return "Schlüssel/Kennung darf nur Kleinbuchstaben, Ziffern und Unterstriche enthalten (2–60 Zeichen).";
  }
  if (m.includes("zweiten berechtigten person")) {
    return "Der Eintrag muss von einer zweiten berechtigten Person verifiziert werden.";
  }
  if (m.includes("nicht in einem schritt")) {
    return "Inhaltliche Änderung und Verifizierung sind nicht in einem Schritt möglich.";
  }
  if (m.includes("kein zugriff") || m.includes("row-level security") || m.includes("permission")) {
    return "Kein Zugriff: Diese Daten dürfen nur von Administration oder Finanzen bearbeitet werden.";
  }
  return "Die Änderung konnte nicht gespeichert werden.";
}

/* ================================================================== *
 * Validierungsschemata (client-sicher, von den Serverfunktionen genutzt)
 * ================================================================== */

const isoDatum = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-DD sein.");
const ZEITRAUM_MSG = "Das Enddatum darf nicht vor dem Startdatum liegen.";
const schluessel = z
  .string()
  .regex(
    /^[a-z0-9_]{2,60}$/,
    "Schlüssel/Kennung: nur Kleinbuchstaben, Ziffern und Unterstriche (2–60 Zeichen).",
  );

export const faktFieldsSchema = z
  .object({
    fahrerId: z.string().uuid(),
    faktSchluessel: schluessel,
    wert: z.string().trim().min(1, "Ein Wert ist erforderlich.").max(200),
    gueltigAb: isoDatum,
    gueltigBis: isoDatum.nullable().optional(),
    notiz: z.string().max(2000).optional(),
  })
  .strict();

export const createFaktSchema = faktFieldsSchema.refine(
  (v) => !v.gueltigBis || v.gueltigBis >= v.gueltigAb,
  { message: ZEITRAUM_MSG, path: ["gueltigBis"] },
);

export const updateFaktSchema = z
  .object({ id: z.string().uuid(), values: faktFieldsSchema })
  .strict()
  .refine((v) => !v.values.gueltigBis || v.values.gueltigBis >= v.values.gueltigAb, {
    message: ZEITRAUM_MSG,
    path: ["values", "gueltigBis"],
  });

const EIN_WERT_MSG =
  "Es muss genau eine Berechnungsart mit passendem Wert angegeben werden – Prozentsatz ODER fester Betrag.";

/**
 * Genau EIN Wert passend zur Berechnungsart. Es wird bewusst nichts vorbelegt:
 * fehlt der Wert, schlägt die Validierung fehl.
 */
export function genauEinRegelWert(v: {
  berechnungsart?: unknown;
  prozentsatz?: unknown;
  festbetrag?: unknown;
}): boolean {
  if (v.berechnungsart === "prozent") {
    return typeof v.prozentsatz === "number" && v.prozentsatz > 0 && v.festbetrag == null;
  }
  if (v.berechnungsart === "festbetrag") {
    return typeof v.festbetrag === "number" && v.festbetrag > 0 && v.prozentsatz == null;
  }
  return false;
}

export const regelFieldsSchema = z
  .object({
    kennung: schluessel,
    bezeichnung: z.string().trim().min(2).max(160),
    kategorie: z.enum(["arbeitnehmerabzug", "arbeitgeberkosten"]),
    berechnungsart: z.enum(["prozent", "festbetrag"]),
    prozentsatz: z.number().positive().max(100).nullable().optional(),
    festbetrag: z.number().positive().max(1_000_000).nullable().optional(),
    gueltigAb: isoDatum,
    gueltigBis: isoDatum.nullable().optional(),
    // Quellenangabe ist Pflicht: ohne Quelle darf keine Regel entstehen.
    quelle: z.string().trim().min(3, "Quellenangabe ist Pflicht.").max(300),
    quelleVersion: z.string().trim().min(1, "Quellen-Version ist Pflicht.").max(60),
    notiz: z.string().max(2000).optional(),
  })
  .strict();

export const createRegelSchema = regelFieldsSchema
  .refine(genauEinRegelWert, { message: EIN_WERT_MSG, path: ["berechnungsart"] })
  .refine((v) => !v.gueltigBis || v.gueltigBis >= v.gueltigAb, {
    message: ZEITRAUM_MSG,
    path: ["gueltigBis"],
  });

export const updateRegelSchema = z
  .object({ id: z.string().uuid(), values: regelFieldsSchema })
  .strict()
  .refine((v) => genauEinRegelWert(v.values), {
    message: EIN_WERT_MSG,
    path: ["values", "berechnungsart"],
  })
  .refine((v) => !v.values.gueltigBis || v.values.gueltigBis >= v.values.gueltigAb, {
    message: ZEITRAUM_MSG,
    path: ["values", "gueltigBis"],
  });

export const payrollIdSchema = z.object({ id: z.string().uuid() }).strict();
