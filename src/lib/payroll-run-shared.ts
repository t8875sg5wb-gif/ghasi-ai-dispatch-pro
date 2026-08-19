// Client-sichere Typen, Mapper, Validierung UND Berechnungskern für Lohnläufe.
//
// UMFANG: Anlegen, Berechnen und Vier-Augen-Freigabe (Vorlage/Freigabe/Ablehnung)
//   inkl. technischer Unveränderlichkeit nach Freigabe.
//   KEIN Export (kein DATEV, kein Lohnschein/PDF), KEINE Auszahlung.
//
// GRUNDSATZ „NICHTS RATEN“:
// - Es werden ausschließlich VERIFIZIERTE Daten verwendet:
//   Beschäftigungsverhältnis, Lohn-Regelwerke und Lohn-Eingabefakten.
// - Fehlt eine Grundlage, wird der Lohnlauf als "unvollstaendig" markiert und
//   die fehlenden Punkte werden benannt. Es wird nie geschätzt, nie auf 0
//   gesetzt und kein Platzhalter gespeichert.
// - Bei Stundenlohn ist die einzige zulässige Stundenquelle ein VERIFIZIERTER
//   Lohn-Eingabefakt `arbeitsstunden_YYYY_MM`, der den Monat abdeckt.
//   Der Schichtplan (`driver_shifts`) ist reine Planung ohne Prüfstatus und
//   wird deshalb ABSICHTLICH NICHT als Arbeitszeiterfassung herangezogen.
import { z } from "zod";

import type { Beschaeftigungsverhaeltnis, Verguetungsart } from "@/lib/employment-shared";
import type {
  LohnFakt,
  LohnRegel,
  RegelBerechnungsart,
  RegelKategorie,
} from "@/lib/payroll-shared";

export type LohnlaufStatus =
  | "offen"
  | "berechnet"
  | "unvollstaendig"
  | "zur_freigabe"
  | "freigegeben";

export const LOHNLAUF_STATUS_LABEL: Record<LohnlaufStatus, string> = {
  offen: "Offen",
  berechnet: "Berechnet",
  unvollstaendig: "Unvollständig",
  zur_freigabe: "Zur Freigabe vorgelegt",
  freigegeben: "Freigegeben",
};

/** Nach der Freigabe ist ein Lohnlauf technisch unveränderlich (DB-Trigger). */
export function istUnveraenderlich(status: LohnlaufStatus): boolean {
  return status === "freigegeben";
}

/** Wortgleicher Grund für fehlende Stundenquelle (fachlich vorgegeben). */
export const GRUND_FEHLENDE_ARBEITSZEIT = "fehlende geprüfte Arbeitszeiterfassung";

/* ================================================================== *
 * Typen
 * ================================================================== */

export interface LohnlaufPosten {
  id: string;
  lohnlaufId: string;
  /** Herkunftsregel (kann nach Löschen der Regel `null` sein – Kennung bleibt). */
  regelId: string | null;
  regelKennung: string;
  regelBezeichnung: string;
  kategorie: RegelKategorie;
  berechnungsart: RegelBerechnungsart;
  prozentsatz: number | null;
  festbetrag: number | null;
  basisbetrag: number;
  betrag: number;
  quelle: string;
  quelleVersion: string;
}

export interface Lohnlauf {
  id: string;
  fahrerId: string;
  /** Erster Tag des Kalendermonats (YYYY-MM-01). */
  periodeMonat: string;
  status: LohnlaufStatus;
  beschaeftigungId: string | null;
  verguetungsart: Verguetungsart | null;
  stunden: number | null;
  stundenlohn: number | null;
  brutto: number | null;
  summeAbzuege: number | null;
  netto: number | null;
  summeArbeitgeberkosten: number | null;
  fehlendePunkte: string[];
  berechnetAm: string | null;
  berechnetVon: string | null;
  vorgelegtVon: string | null;
  vorgelegtAm: string | null;
  vorgelegtVersion: number | null;
  freigegebenVon: string | null;
  freigegebenAm: string | null;
  entschiedenVon: string | null;
  entschiedenAm: string | null;
  ablehnungGrund: string | null;
  version: number;
  notiz: string;
  createdAt: string;
  updatedAt: string;
  posten: LohnlaufPosten[];
}

export interface PayrollRunRow {
  id: string;
  driver_id: string;
  periode_monat: string;
  status: string;
  employment_id: string | null;
  verguetungsart: string | null;
  stunden: number | string | null;
  stundenlohn: number | string | null;
  brutto: number | string | null;
  summe_abzuege: number | string | null;
  netto: number | string | null;
  summe_arbeitgeberkosten: number | string | null;
  fehlende_punkte: unknown;
  berechnet_am: string | null;
  berechnet_von: string | null;

  vorgelegt_von: string | null;
  vorgelegt_am: string | null;
  vorgelegt_version: number | null;
  freigegeben_von: string | null;
  freigegeben_am: string | null;
  entschieden_von: string | null;
  entschieden_am: string | null;
  ablehnung_grund: string | null;
  version: number;

  notiz: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollRunItemRow {
  id: string;
  run_id: string;
  rule_id: string | null;
  regel_kennung: string;
  regel_bezeichnung: string;
  kategorie: string;
  berechnungsart: string;
  prozentsatz: number | string | null;
  festbetrag: number | string | null;
  basisbetrag: number | string;
  betrag: number | string;
  quelle: string | null;
  quelle_version: string | null;
}

export interface PayrollRunAuditRow {
  id: string;
  run_id: string;
  driver_id: string | null;
  periode_monat: string | null;
  aktion: string;
  version: number | null;
  akteur_user_id: string | null;
  old_row: unknown;
  new_row: unknown;
  created_at: string;
}

export interface LohnlaufAudit {
  id: string;
  lohnlaufId: string;
  fahrerId: string | null;
  periodeMonat: string | null;
  aktion: string;
  version: number | null;
  akteurUserId: string | null;
  altWert: string | null;
  neuWert: string | null;
  createdAt: string;
}

/* ================================================================== *
 * Mapper
 * ================================================================== */

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const STATUS_WERTE: LohnlaufStatus[] = [
  "offen",
  "berechnet",
  "unvollstaendig",
  "zur_freigabe",
  "freigegeben",
];

function status(v: string): LohnlaufStatus {
  return (STATUS_WERTE as string[]).includes(v) ? (v as LohnlaufStatus) : "offen";
}

export function rowToPosten(r: PayrollRunItemRow): LohnlaufPosten {
  return {
    id: r.id,
    lohnlaufId: r.run_id,
    regelId: r.rule_id ?? null,
    regelKennung: r.regel_kennung,
    regelBezeichnung: r.regel_bezeichnung,
    kategorie: r.kategorie === "arbeitgeberkosten" ? "arbeitgeberkosten" : "arbeitnehmerabzug",
    berechnungsart: r.berechnungsart === "festbetrag" ? "festbetrag" : "prozent",
    prozentsatz: num(r.prozentsatz),
    festbetrag: num(r.festbetrag),
    basisbetrag: num(r.basisbetrag) ?? 0,
    betrag: num(r.betrag) ?? 0,
    quelle: r.quelle ?? "",
    quelleVersion: r.quelle_version ?? "",
  };
}

export function rowToLohnlauf(r: PayrollRunRow, posten: PayrollRunItemRow[] = []): Lohnlauf {
  const art = r.verguetungsart;
  return {
    id: r.id,
    fahrerId: r.driver_id,
    periodeMonat: r.periode_monat,
    status: status(r.status),
    beschaeftigungId: r.employment_id ?? null,
    verguetungsart: art === "stundenlohn" || art === "monatsbrutto" ? art : null,
    stunden: num(r.stunden),
    stundenlohn: num(r.stundenlohn),
    brutto: num(r.brutto),
    summeAbzuege: num(r.summe_abzuege),
    netto: num(r.netto),
    summeArbeitgeberkosten: num(r.summe_arbeitgeberkosten),
    fehlendePunkte: Array.isArray(r.fehlende_punkte)
      ? (r.fehlende_punkte as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    berechnetAm: r.berechnet_am ?? null,
    berechnetVon: r.berechnet_von ?? null,
    vorgelegtVon: r.vorgelegt_von ?? null,
    vorgelegtAm: r.vorgelegt_am ?? null,
    vorgelegtVersion: r.vorgelegt_version ?? null,
    freigegebenVon: r.freigegeben_von ?? null,
    freigegebenAm: r.freigegeben_am ?? null,
    entschiedenVon: r.entschieden_von ?? null,
    entschiedenAm: r.entschieden_am ?? null,
    ablehnungGrund: r.ablehnung_grund ?? null,
    version: Number(r.version) || 1,

    notiz: r.notiz ?? "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    posten: posten.map(rowToPosten),
  };
}

export function rowToLohnlaufAudit(r: PayrollRunAuditRow): LohnlaufAudit {
  return {
    id: r.id,
    lohnlaufId: r.run_id,
    fahrerId: r.driver_id ?? null,
    periodeMonat: r.periode_monat ?? null,
    aktion: r.aktion,
    version: r.version ?? null,
    akteurUserId: r.akteur_user_id ?? null,
    altWert: r.old_row == null ? null : JSON.stringify(r.old_row),
    neuWert: r.new_row == null ? null : JSON.stringify(r.new_row),
    createdAt: r.created_at,
  };
}

/* ================================================================== *
 * Zeitraum-Helfer (1. bis letzter Tag des Monats)
 * ================================================================== */

/** `2026-08` → `{ ab: "2026-08-01", bis: "2026-08-31" }` */
export function monatsZeitraum(monat: string): { ab: string; bis: string } {
  const [y, m] = monat.split("-").map(Number);
  const jahr = y as number;
  const mon = m as number;
  const letzter = new Date(Date.UTC(jahr, mon, 0)).getUTCDate();
  const p = (n: number) => String(n).padStart(2, "0");
  return { ab: `${jahr}-${p(mon)}-01`, bis: `${jahr}-${p(mon)}-${p(letzter)}` };
}

/** Schlüssel des einzigen zulässigen Stunden-Fakts, z. B. `arbeitsstunden_2026_08`. */
export function arbeitsstundenSchluessel(monat: string): string {
  return `arbeitsstunden_${monat.replace("-", "_")}`;
}

export function monatLabel(periodeMonat: string): string {
  const [y, m] = periodeMonat.split("-");
  return `${m}/${y}`;
}

/* ================================================================== *
 * Berechnungskern (rein, ohne Datenbank – deshalb direkt testbar)
 * ================================================================== */

export interface BerechnungsPosten {
  regelId: string;
  regelKennung: string;
  regelBezeichnung: string;
  kategorie: RegelKategorie;
  berechnungsart: RegelBerechnungsart;
  prozentsatz: number | null;
  festbetrag: number | null;
  basisbetrag: number;
  betrag: number;
  quelle: string;
  quelleVersion: string;
}

export interface BerechnungsErgebnis {
  status: "berechnet" | "unvollstaendig";
  fehlendePunkte: string[];
  beschaeftigungId: string | null;
  verguetungsart: Verguetungsart | null;
  stunden: number | null;
  stundenlohn: number | null;
  brutto: number | null;
  summeAbzuege: number | null;
  netto: number | null;
  summeArbeitgeberkosten: number | null;
  posten: BerechnungsPosten[];
}

function rund(n: number): number {
  return Math.round(n * 100) / 100;
}

function deckt(ab: string, bis: string | null, zAb: string, zBis: string): boolean {
  return ab <= zAb && (bis === null || bis >= zBis);
}

function giltIm(ab: string, bis: string | null, zAb: string, zBis: string): boolean {
  return ab <= zBis && (bis === null || bis >= zAb);
}

/**
 * Berechnet einen Lohnlauf ausschließlich aus verifizierten Grundlagen.
 * Die übergebenen Listen dürfen bereits vorgefiltert sein; es wird zusätzlich
 * hier auf `status === "verifiziert"` geprüft (doppelte Absicherung).
 */
export function berechneLohnlauf(args: {
  monat: string;
  fahrerId: string;
  beschaeftigungen: Beschaeftigungsverhaeltnis[];
  regeln: LohnRegel[];
  fakten: LohnFakt[];
}): BerechnungsErgebnis {
  const { ab, bis } = monatsZeitraum(args.monat);
  const fehlend: string[] = [];

  const verifizierteFakten = args.fakten.filter(
    (f) =>
      f.status === "verifiziert" &&
      f.fahrerId === args.fahrerId &&
      deckt(f.gueltigAb, f.gueltigBis, ab, bis),
  );

  const beschaeftigung =
    args.beschaeftigungen.find(
      (b) =>
        b.status === "verifiziert" &&
        b.fahrerId === args.fahrerId &&
        deckt(b.gueltigAb, b.gueltigBis, ab, bis),
    ) ?? null;

  if (!beschaeftigung) {
    fehlend.push(
      "Kein verifiziertes Beschäftigungsverhältnis, das den gesamten Kalendermonat abdeckt.",
    );
  }

  // --- Bruttolohn -------------------------------------------------
  let brutto: number | null = null;
  let stunden: number | null = null;
  let stundenlohn: number | null = null;

  if (beschaeftigung?.verguetungsart === "monatsbrutto") {
    if (typeof beschaeftigung.monatsbrutto === "number" && beschaeftigung.monatsbrutto > 0) {
      brutto = rund(beschaeftigung.monatsbrutto);
    } else {
      fehlend.push("Im verifizierten Beschäftigungsverhältnis fehlt das Monatsbrutto.");
    }
  } else if (beschaeftigung?.verguetungsart === "stundenlohn") {
    stundenlohn = beschaeftigung.stundenlohn;
    const schluessel = arbeitsstundenSchluessel(args.monat);
    const stundenFakt = verifizierteFakten.find((f) => f.faktSchluessel === schluessel);
    const wert = stundenFakt ? Number(String(stundenFakt.wert).replace(",", ".")) : NaN;

    if (!stundenFakt || !Number.isFinite(wert) || wert < 0) {
      // Niemals schätzen und niemals auf 0 setzen.
      fehlend.push(
        `${GRUND_FEHLENDE_ARBEITSZEIT}: verifizierter Lohn-Eingabefakt „${schluessel}“ fehlt für diesen Zeitraum.`,
      );
    } else if (typeof stundenlohn !== "number" || stundenlohn <= 0) {
      fehlend.push("Im verifizierten Beschäftigungsverhältnis fehlt der Stundenlohn.");
    } else {
      stunden = rund(wert);
      brutto = rund(stunden * stundenlohn);
    }
  }

  // --- Regelposten ------------------------------------------------
  const gueltigeRegeln = args.regeln.filter(
    (r) => r.status === "verifiziert" && giltIm(r.gueltigAb, r.gueltigBis, ab, bis),
  );

  const posten: BerechnungsPosten[] = [];
  for (const r of gueltigeRegeln) {
    if (r.benoetigterFakt) {
      const vorhanden = verifizierteFakten.some((f) => f.faktSchluessel === r.benoetigterFakt);
      if (!vorhanden) {
        fehlend.push(
          `Regel „${r.kennung}“ benötigt den verifizierten Lohn-Eingabefakt „${r.benoetigterFakt}“ für diesen Zeitraum.`,
        );
        continue;
      }
    }
    if (brutto === null) continue; // ohne Bruttolohn wird kein Posten geraten

    const betrag =
      r.berechnungsart === "prozent"
        ? rund((brutto * (r.prozentsatz ?? 0)) / 100)
        : rund(r.festbetrag ?? 0);

    posten.push({
      regelId: r.id,
      regelKennung: r.kennung,
      regelBezeichnung: r.bezeichnung,
      kategorie: r.kategorie,
      berechnungsart: r.berechnungsart,
      prozentsatz: r.prozentsatz,
      festbetrag: r.festbetrag,
      basisbetrag: brutto,
      betrag,
      quelle: r.quelle,
      quelleVersion: r.quelleVersion,
    });
  }

  if (fehlend.length > 0 || brutto === null) {
    return {
      status: "unvollstaendig",
      fehlendePunkte: fehlend,
      beschaeftigungId: beschaeftigung?.id ?? null,
      verguetungsart: beschaeftigung?.verguetungsart ?? null,
      stunden: null,
      stundenlohn: null,
      brutto: null,
      summeAbzuege: null,
      netto: null,
      summeArbeitgeberkosten: null,
      posten: [],
    };
  }

  const summeAbzuege = rund(
    posten.filter((p) => p.kategorie === "arbeitnehmerabzug").reduce((s, p) => s + p.betrag, 0),
  );
  const summeArbeitgeberkosten = rund(
    posten.filter((p) => p.kategorie === "arbeitgeberkosten").reduce((s, p) => s + p.betrag, 0),
  );

  return {
    status: "berechnet",
    fehlendePunkte: [],
    beschaeftigungId: beschaeftigung?.id ?? null,
    verguetungsart: beschaeftigung?.verguetungsart ?? null,
    stunden,
    stundenlohn,
    brutto,
    summeAbzuege,
    netto: rund(brutto - summeAbzuege),
    summeArbeitgeberkosten,
    posten,
  };
}

/* ================================================================== *
 * Fehler-Mapping
 * ================================================================== */

export function mapLohnlaufDbError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("payroll_runs_unique_periode") || m.includes("duplicate key")) {
    return "Für diesen Fahrer existiert für diesen Kalendermonat bereits ein Lohnlauf.";
  }
  if (m.includes("payroll_runs_monatsanfang")) {
    return "Der Zeitraum muss ein vollständiger Kalendermonat sein.";
  }
  // Fachliche Trigger-Meldungen (Freigabe-Workflow) unverändert durchreichen.
  if (m.includes("unveraenderlich") || m.includes("unveränderlich")) {
    return "Ein freigegebener Lohnlauf ist unveränderlich – keine Neuberechnung, Änderung oder Löschung möglich.";
  }
  if (m.includes("zweiten berechtigten person")) {
    return "Vier-Augen-Prinzip: Wer vorgelegt oder berechnet hat, darf denselben Lohnlauf nicht selbst entscheiden.";
  }
  if (m.includes("erneut vorgelegt")) {
    return "Der Rechenstand hat sich seit der Vorlage geändert. Der Lohnlauf muss erneut vorgelegt werden.";
  }
  if (m.includes("vollstaendig berechneter") || m.includes("vollständig berechneter")) {
    return "Nur ein vollständig berechneter Lohnlauf kann zur Freigabe vorgelegt werden.";
  }
  if (m.includes("vorgelegter lohnlauf") || m.includes("vorgelegter lohnlauf")) {
    return "Unzulässiger Statuswechsel für einen vorgelegten Lohnlauf.";
  }
  if (m.includes("ablehnung erfordert")) {
    return "Eine Ablehnung erfordert einen Grund.";
  }
  if (m.includes("nicht geloescht") || m.includes("nicht gelöscht")) {
    return "Ein freigegebener Lohnlauf kann nicht gelöscht werden.";
  }
  if (m.includes("kein zugriff") || m.includes("row-level security") || m.includes("permission")) {
    return "Kein Zugriff: Lohnläufe dürfen nur von Administration oder Finanzen bearbeitet werden.";
  }
  return "Der Lohnlauf konnte nicht gespeichert werden.";
}

/* ================================================================== *
 * Validierung
 * ================================================================== */

export const createLohnlaufSchema = z
  .object({
    fahrerId: z.string().uuid(),
    /** Kalendermonat als `YYYY-MM`. */
    monat: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Monat muss YYYY-MM sein."),
    notiz: z.string().max(2000).optional(),
  })
  .strict();

export type LohnlaufWrite = z.infer<typeof createLohnlaufSchema>;

export const lohnlaufIdSchema = z.object({ id: z.string().uuid() }).strict();

/** Ablehnung: Pflicht-Freitextgrund. */
export const ablehnenLohnlaufSchema = z
  .object({
    id: z.string().uuid(),
    grund: z
      .string()
      .trim()
      .min(5, "Bitte einen nachvollziehbaren Ablehnungsgrund angeben (mind. 5 Zeichen).")
      .max(2000),
  })
  .strict();

export type LohnlaufAblehnung = z.infer<typeof ablehnenLohnlaufSchema>;
