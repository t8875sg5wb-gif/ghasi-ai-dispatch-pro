// DATEV-Lohn-Exportentwurf für freigegebene Lohnläufe.
//
// Aufbau bewusst identisch zum Muster in `src/lib/datev-export.ts`: eine reine,
// testbare Funktion ohne Seiteneffekte, die eine CSV im deutschen Zahlenformat
// (Komma als Dezimaltrennzeichen, keine Tausenderpunkte) erzeugt. Kein
// Datenbankzugriff, reiner Lesevorgang.
//
// ACHTUNG — LOHNART-PLATZHALTER:
// Die echten DATEV-Lohnart-Schlüssel für die hier verwendeten Abzugs- und
// Arbeitgeberkosten-Kategorien sind NICHT bekannt. Deshalb steht in der Spalte
// "Lohnart" bewusst KEIN Zahlencode, sondern der auffällige Platzhalter
// `LOHNART_PLATZHALTER`. Dieser Platzhalter MUSS vor jeglicher Nutzung durch
// echte, vom Steuerberater bestätigte DATEV-Lohnart-Schlüssel ersetzt werden.
// Eine Datei mit Platzhaltern darf NICHT in DATEV importiert werden.
import type { Lohnlauf, LohnlaufPosten } from "@/lib/payroll-run-shared";
import { monatLabel } from "@/lib/payroll-run-shared";
import { REGEL_KATEGORIE_LABEL } from "@/lib/payroll-shared";

/**
 * Bewusst als Platzhalter erkennbarer Wert – niemals eine Zahl, die man
 * versehentlich für einen echten DATEV-Lohnart-Schlüssel halten könnte.
 */
export const LOHNART_PLATZHALTER = "LOHNART_PRUEFEN";

/** Pflicht-Warnhinweis, der im Export und im UI sichtbar sein muss. */
export const DATEV_LOHN_WARNUNG =
  "Entwurf mit Platzhalter-Lohnarten: Die Spalte \u201aLohnart\u2018 enthält den Platzhalter " +
  `${LOHNART_PLATZHALTER} und MUSS vor jeglicher Nutzung durch echte, vom Steuerberater ` +
  "bestätigte DATEV-Lohnart-Schlüssel ersetzt werden. Diese Datei darf nicht ungeprüft in " +
  "DATEV importiert werden. Keine Auszahlung, keine Übermittlung an Behörden.";

export interface DatevLohnOptions {
  beraterNr: string;
  mandantNr: string;
  /** Anzeigename des Fahrers (Referenz für den Steuerberater). */
  fahrerName: string;
}

export interface DatevLohnResult {
  csv: string;
  /** Anzahl exportierter Postenzeilen. */
  anzahl: number;
  /** Vorgeschlagener Dateiname. */
  dateiname: string;
}

/** Deutsches Dezimalformat: Komma, keine Tausenderpunkte, 2 Nachkommastellen. */
function amount(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

/** CSV-Feld quoten, wenn nötig (Semikolon-Trennung, Excel/DE-freundlich). */
function q(v: string | number): string {
  const s = String(v);
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const SPALTEN = [
  "Berater",
  "Mandant",
  "Fahrer-Referenz",
  "Personalnummer",
  "Abrechnungszeitraum",
  "Zeilentyp",
  "Lohnart",
  "Regel-Kennung",
  "Bezeichnung",
  "Kategorie",
  "Betrag",
  "Quelle",
  "Quelle-Version",
];

function postenZeile(
  p: LohnlaufPosten,
  base: (string | number)[],
): string {
  return [
    ...base,
    q("Posten"),
    // Platzhalter statt erfundenem Lohnart-Schlüssel – siehe Kopfkommentar.
    q(LOHNART_PLATZHALTER),
    q(p.regelKennung),
    q(p.regelBezeichnung),
    q(REGEL_KATEGORIE_LABEL[p.kategorie]),
    amount(p.betrag),
    q(p.quelle),
    q(p.quelleVersion),
  ].join(";");
}

function summenZeile(
  base: (string | number)[],
  bezeichnung: string,
  betrag: number | null,
): string {
  return [
    ...base,
    q("Summe"),
    q(LOHNART_PLATZHALTER),
    q(""),
    q(bezeichnung),
    q(""),
    betrag === null ? "" : amount(betrag),
    q(""),
    q(""),
  ].join(";");
}

/**
 * Erzeugt den DATEV-Lohn-Exportentwurf für EINEN freigegebenen Lohnlauf.
 * Wirft, wenn der Lauf nicht freigegeben ist – dieselbe Regel wie beim PDF-Export.
 */
export function buildDatevLohnexport(lauf: Lohnlauf, opts: DatevLohnOptions): DatevLohnResult {
  if (lauf.status !== "freigegeben") {
    throw new Error(
      "Nur freigegebene Lohnläufe können exportiert werden – dieser Lauf ist fachlich noch nicht final.",
    );
  }

  const zeitraum = monatLabel(lauf.periodeMonat);
  const base: (string | number)[] = [
    q(opts.beraterNr),
    q(opts.mandantNr),
    q(opts.fahrerName),
    q(lauf.fahrerId),
    q(zeitraum),
  ];

  const kopf = [
    `# DATEV-Lohn-Exportentwurf – ${zeitraum} – ${opts.fahrerName} (Stand/Version ${lauf.version})`,
    `# ${DATEV_LOHN_WARNUNG}`,
  ];

  const summen = [
    summenZeile(base, "Bruttolohn", lauf.brutto),
    summenZeile(base, "Summe Abzüge", lauf.summeAbzuege),
    summenZeile(base, "Netto (Auszahlung an Fahrer)", lauf.netto),
    summenZeile(base, "Summe Arbeitgeberkosten", lauf.summeArbeitgeberkosten),
  ];

  const posten = lauf.posten.map((p) => postenZeile(p, base));

  const csv = [...kopf, SPALTEN.map(q).join(";"), ...summen, ...posten].join("\r\n");

  return {
    csv,
    anzahl: posten.length,
    dateiname: `DATEV-Lohn-ENTWURF-${lauf.periodeMonat.slice(0, 7)}-${opts.fahrerName.replace(
      /[^\w-]+/g,
      "_",
    )}.csv`,
  };
}
