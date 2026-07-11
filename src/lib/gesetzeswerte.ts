// ============================================================
// GHASI AI — Gesetzeswerte (zentrale Quelle der Wahrheit)
// ------------------------------------------------------------
// Verfassung Art. 11: ALLE gesetzlichen/statutarischen Kennzahlen liegen
// hier an EINER Stelle, jeweils mit „stand“ (gültig ab) markiert. Konsumenten:
// Lohn-Rechner, steuer.ts, Compliance, EÜR/Jahresabschluss und die
// KI-Wissensschicht. Alle Werte sind Näherungen und ersetzen KEINE
// zertifizierte Lohn-/Steuersoftware oder Beratung.
//
// Rechtsstand: Juli 2026 (Deutschland).
// ============================================================

/** Menschlich lesbarer Rechtsstand für Anzeige & KI-Zitate. */
export const RECHTSSTAND = "Stand: Juli 2026";

interface Wert<T> {
  wert: T;
  /** gültig ab (ISO-Datum) */
  stand: string;
  /** optionaler Ausblick auf bekannte künftige Werte */
  hinweis?: string;
}

/* ------------------------------------------------------------------ *
 * Mindestlohn
 * ------------------------------------------------------------------ */
export const MINDESTLOHN: Wert<number> = {
  wert: 13.9,
  stand: "2026-01-01",
  hinweis: "Ab 2027-01-01: 14,60 €/Stunde.",
};

/* ------------------------------------------------------------------ *
 * Minijob / Midijob (Übergangsbereich)
 * ------------------------------------------------------------------ */
/** Minijob-Grenze pro Monat (dynamisch an den Mindestlohn gekoppelt). */
export const MINIJOB_GRENZE_MONAT: Wert<number> = {
  wert: 603,
  stand: "2026-01-01",
  hinweis: "Ab 2027-01-01: 633 €/Monat. (2025 galt noch 556 €.)",
};
/** Minijob-Grenze pro Jahr. */
export const MINIJOB_GRENZE_JAHR: Wert<number> = {
  wert: 7_236,
  stand: "2026-01-01",
};
/** Untergrenze Übergangsbereich (Midijob). */
export const MIDIJOB_UNTERGRENZE: Wert<number> = {
  wert: 603.01,
  stand: "2026-01-01",
};
/** Obergrenze Übergangsbereich (Midijob). */
export const MIDIJOB_OBERGRENZE: Wert<number> = {
  wert: 2_000,
  stand: "2023-01-01",
};

/* ------------------------------------------------------------------ *
 * Sozialversicherungs-Beitragssätze 2026 (in Prozent)
 * ------------------------------------------------------------------ */
export const SV_SAETZE_2026 = {
  stand: "2026-01-01",
  /** KV allgemeiner Beitragssatz */
  kvAllgemein: 14.6,
  /** durchschnittlicher kassenindividueller Zusatzbeitrag 2026 (pro Kasse konfigurierbar) */
  kvZusatzbeitragDurchschnitt: 2.9,
  /** Pflegeversicherung Grundsatz */
  pv: 3.6,
  /** PV-Zuschlag für Kinderlose (ab 23 J.) */
  pvKinderlosZuschlag: 0.6,
  /** PV Arbeitgeberanteil */
  pvArbeitgeber: 1.7,
  /** Rentenversicherung */
  rv: 18.6,
  /** Arbeitslosenversicherung */
  av: 2.6,
} as const;

/* ------------------------------------------------------------------ *
 * Minijob: pauschale Arbeitgeberabgaben (Minijob-Zentrale) 2026
 * ------------------------------------------------------------------ */
export const MINIJOB_PAUSCHALEN_2026 = {
  stand: "2026-01-01",
  /** pauschale Krankenversicherung */
  kv: 13.0,
  /** pauschale Rentenversicherung */
  rv: 15.0,
  /** einheitliche Pauschsteuer (inkl. Soli & KiSt) */
  steuer: 2.0,
  /** Umlage U1 (Entgeltfortzahlung Krankheit) – zum 2026-01-01 gesenkt */
  u1: 0.8,
  /** Umlage U2 (Mutterschaft) */
  u2: 0.44,
  /** Insolvenzgeldumlage */
  insolvenzgeld: 0.15,
} as const;

/** Summe der Minijob-Pauschalabgaben des Arbeitgebers in Prozent. */
export const MINIJOB_PAUSCHAL_AG_PROZENT =
  MINIJOB_PAUSCHALEN_2026.kv +
  MINIJOB_PAUSCHALEN_2026.rv +
  MINIJOB_PAUSCHALEN_2026.steuer +
  MINIJOB_PAUSCHALEN_2026.u1 +
  MINIJOB_PAUSCHALEN_2026.u2 +
  MINIJOB_PAUSCHALEN_2026.insolvenzgeld;

/* ------------------------------------------------------------------ *
 * Beitragsbemessungsgrenzen & Bezugsgröße 2026 (Monat)
 * ------------------------------------------------------------------ */
export const BBG_KV_PV_MONAT: Wert<number> = { wert: 5_812.5, stand: "2026-01-01" };
export const BEZUGSGROESSE_MONAT: Wert<number> = { wert: 3_955, stand: "2026-01-01" };

/* ------------------------------------------------------------------ *
 * Einkommensteuer
 * ------------------------------------------------------------------ */
export const GRUNDFREIBETRAG: Wert<number> = { wert: 12_348, stand: "2026-01-01" };

/* ------------------------------------------------------------------ *
 * Zuzahlung Krankenfahrt (§ 61 SGB V)
 * ------------------------------------------------------------------ */
export const ZUZAHLUNG_KRANKENFAHRT = {
  stand: "2004-01-01",
  /** Anteil an den Fahrtkosten */
  prozent: 10,
  /** Mindestbetrag je Fahrt */
  min: 5,
  /** Höchstbetrag je Fahrt */
  max: 10,
} as const;

/**
 * Patienten-Zuzahlung für eine Krankenfahrt nach § 61 SGB V:
 * 10 % der Fahrtkosten, mindestens 5 €, höchstens 10 € je Fahrt.
 * Zuzahlungsbefreite Patienten zahlen 0 €.
 */
export function zuzahlungKrankenfahrt(fahrtkosten: number, befreit = false): number {
  if (befreit || fahrtkosten <= 0) return 0;
  const roh = fahrtkosten * (ZUZAHLUNG_KRANKENFAHRT.prozent / 100);
  const gedeckelt = Math.min(ZUZAHLUNG_KRANKENFAHRT.max, Math.max(ZUZAHLUNG_KRANKENFAHRT.min, roh));
  // Nie mehr als die tatsächlichen Kosten.
  return Math.round(Math.min(fahrtkosten, gedeckelt) * 100) / 100;
}

/* ------------------------------------------------------------------ *
 * Aufbewahrungsfristen (Jahre)
 * ------------------------------------------------------------------ */
export const AUFBEWAHRUNG_JAHRE = {
  stand: "2025-01-01",
  /** Rechnungen/Belege (verkürzt durch BEG IV) */
  rechnungenBelege: 8,
  /** Bücher/Bilanzen */
  buecher: 10,
  /** Lohnkonten */
  lohnkonten: 6,
  /** Arbeitszeitnachweise */
  arbeitszeitnachweise: 2,
} as const;

/* ------------------------------------------------------------------ *
 * Neue Regeln 2026 (Info-Texte für Lohn/Compliance/KI)
 * ------------------------------------------------------------------ */
export const NEUERUNGEN_2026: string[] = [
  `Mindestlohn ${MINDESTLOHN.wert.toFixed(2).replace(".", ",")} €/h seit 01.01.2026 (2027: 14,60 €).`,
  `Minijob-Grenze ${MINIJOB_GRENZE_MONAT.wert} €/Monat bzw. ${MINIJOB_GRENZE_JAHR.wert.toLocaleString("de-DE")} €/Jahr seit 01.01.2026 (2027: 633 €).`,
  "Ab 2026 entfällt in den Beitragsnachweisen die Trennung nach Rechtskreis Ost/West.",
  "Ab 01.07.2026 können Minijobber ihre Befreiung von der Rentenversicherungspflicht widerrufen (einmalig, nur in eine Richtung).",
];

/** Zentrale Steuer-/Vertragsgrundlagen für die KI (Schiene A). */
export const RECHTSGRUNDLAGEN_KI: string[] = [
  "Umsatzsteuerbefreiung der Krankenfahrten nach § 4 Nr. 17b UStG.",
  "Abrechnung mit den Krankenkassen nach § 133 SGB V (Fahrkostenvergütung, inkl. IK-Nummer des Leistungserbringers).",
  "Zuzahlung Krankenfahrt nach § 61 SGB V: 10 % der Kosten, mind. 5 €, max. 10 € je Fahrt; zuzahlungsbefreite Patienten zahlen nichts.",
  "BTW-Rahmenvertrag Westfalen-Lippe (gültig seit 06/2023) für sitzende/rollstuhlgebundene Krankenfahrten.",
  "LMW-Rahmenvertrag Westfalen-Lippe (gültig seit 01/2026): einfacher Liegend-/Tragestuhltransport ohne medizinische Betreuung (Schiene A).",
];
