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

/**
 * Einordnung eines Wertes:
 * - `gesetzlich`: durch Gesetz/Verordnung/amtliche Bekanntmachung festgelegt
 * - `konfigurierbar`: betriebs-/kassenindividuell einstellbar
 * - `schaetzung`: Näherung, kein amtlicher Wert
 */
export type Wertkategorie = "gesetzlich" | "konfigurierbar" | "schaetzung";

/** Herkunfts-/Versionsangaben zu jedem Wert (Verfassung Art. 11). */
interface WertMeta {
  kategorie: Wertkategorie;
  /** Quelle: Name + URL. "TODO" = in diesem Lauf nicht verifiziert. */
  quelle: string;
  /** Datum der letzten inhaltlichen Verifikation (ISO). */
  verifiziertAm: string;
}

interface Wert<T> extends WertMeta {
  wert: T;
  /** gültig ab (ISO-Datum) */
  stand: string;
  /** optionaler Ausblick auf bekannte künftige Werte */
  hinweis?: string;
}

// Platzhalter für künftige, noch nicht verifizierte Werte.
const TODO_QUELLE = "TODO: Quelle nicht in diesem Lauf verifiziert";

/* ------------------------------------------------------------------ *
 * Mindestlohn
 * ------------------------------------------------------------------ */
export const MINDESTLOHN: Wert<number> = {
  wert: 13.9,
  stand: "2026-01-01",
  kategorie: "gesetzlich",
  quelle:
    "Bundesministerium für Arbeit und Soziales, Pressemitteilung — https://www.bmas.de/DE/Service/Presse/Pressemitteilungen/2025/mindestlohn-steigt-zum-ersten-januar-2026.html",
  verifiziertAm: "2026-07-29",
  hinweis: "Ab 2027-01-01: 14,60 €/Stunde.",
};

/* ------------------------------------------------------------------ *
 * Minijob / Midijob (Übergangsbereich)
 * ------------------------------------------------------------------ */
/** Minijob-Grenze pro Monat (dynamisch an den Mindestlohn gekoppelt). */
export const MINIJOB_GRENZE_MONAT: Wert<number> = {
  wert: 603,
  stand: "2026-01-01",
  kategorie: "gesetzlich",
  quelle:
    "Minijob-Zentrale, Neue Verdienstgrenze 2026 — https://magazin.minijob-zentrale.de/neue-verdienstgrenze-2026/ (Formel: Mindestlohn × 130 ÷ 3)",
  verifiziertAm: "2026-07-29",
  hinweis: "Ab 2027-01-01: 633 €/Monat. (2025 galt noch 556 €.)",
};
/** Minijob-Grenze pro Jahr. */
export const MINIJOB_GRENZE_JAHR: Wert<number> = {
  wert: 7_236,
  stand: "2026-01-01",
  kategorie: "gesetzlich",
  quelle:
    "Minijob-Zentrale, Neue Verdienstgrenze 2026 — https://magazin.minijob-zentrale.de/neue-verdienstgrenze-2026/ (Formel: Mindestlohn × 130 ÷ 3)",
  verifiziertAm: "2026-07-29",
};
/** Untergrenze Übergangsbereich (Midijob). */
export const MIDIJOB_UNTERGRENZE: Wert<number> = {
  wert: 603.01,
  stand: "2026-01-01",
  kategorie: "gesetzlich",
  quelle:
    "Deutsche Rentenversicherung, Meldung 23.02.2026 — https://www.deutsche-rentenversicherung.de/DRV/DE/Ueber-uns-und-Presse/Presse/Meldungen/2026/260223-minijob-midijob-verdienstgrenzen-steigen",
  verifiziertAm: "2026-07-29",
};
/** Obergrenze Übergangsbereich (Midijob) – seit 2023 unverändert. */
export const MIDIJOB_OBERGRENZE: Wert<number> = {
  wert: 2_000,
  stand: "2023-01-01",
  kategorie: "gesetzlich",
  quelle:
    "Deutsche Rentenversicherung, Meldung 23.02.2026 — https://www.deutsche-rentenversicherung.de/DRV/DE/Ueber-uns-und-Presse/Presse/Meldungen/2026/260223-minijob-midijob-verdienstgrenzen-steigen",
  verifiziertAm: "2026-07-29",
};

/* ------------------------------------------------------------------ *
 * Sozialversicherungs-Beitragssätze 2026 (in Prozent)
 * ------------------------------------------------------------------ */
export const SV_SAETZE_2026 = {
  stand: "2026-01-01",
  kategorie: "gesetzlich",
  quelle:
    "Deutsche Rentenversicherung Knappschaft-Bahn-See, Sozialversicherungsrechengrößen 2026 — https://www.deutsche-rentenversicherung.de/KnappschaftBahnSee/DE/Aktuelles/Meldungen/2026/2026_01_02_Sozialversicherungsrechengroessen2026",
  verifiziertAm: "2026-07-29",
  /** KV allgemeiner Beitragssatz */
  kvAllgemein: 14.6,
  /** durchschnittlicher kassenindividueller Zusatzbeitrag 2026 (pro Kasse konfigurierbar) */
  kvZusatzbeitragDurchschnitt: 2.9,
  /** Pflegeversicherung Grundsatz */
  pv: 3.6,
  /** PV-Zuschlag für Kinderlose (ab 23 J.) */
  pvKinderlosZuschlag: 0.6,
  /**
   * PV Arbeitgeberanteil (bundesweit 1,8 %; 1,8 % AG + 1,8 % AN = 3,6 %).
   * Sachsen-Sonderregelung (AG 1,3 %) ist hier bewusst NICHT abgebildet.
   * Quelle: Die Techniker, Wie berechnen Arbeitgeber den Pflegebeitrag? —
   * https://www.tk.de/firmenkunden/versicherung/beitraege-faq/pv-beitraege/wie-berechnen-arbeitgeber-den-pflegebeitrag-2148694
   */
  pvArbeitgeber: 1.8,
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
  kategorie: "gesetzlich",
  quelle:
    "Minijob-Zentrale, Abgaben für gewerbliche Minijobs 2026 — https://www.minijob-zentrale.de/DE/die-minijobs/gewerblich/abgaben/abgaben_node.html",
  verifiziertAm: "2026-07-29",
  /** pauschale Krankenversicherung */
  kv: 13.0,
  /** pauschale Rentenversicherung */
  rv: 15.0,
  /** einheitliche Pauschsteuer (inkl. Soli & KiSt) */
  steuer: 2.0,
  /** Umlage U1 (Entgeltfortzahlung Krankheit) – zum 2026-01-01 gesenkt */
  u1: 0.8,
  /** Umlage U2 (Mutterschaft) – 2026: 0,22 % */
  u2: 0.22,
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
export const BBG_KV_PV_MONAT: Wert<number> = {
  wert: 5_812.5,
  stand: "2026-01-01",
  kategorie: "gesetzlich",
  quelle:
    "Bundesregierung, Beitragsbemessungsgrenzen 2026 — https://www.bundesregierung.de/breg-de/aktuelles/beitragsgemessungsgrenzen-2386514",
  verifiziertAm: "2026-07-29",
};
/** Bezugsgröße – seit 2025 bundeseinheitlich (keine Ost/West-Trennung mehr). */
export const BEZUGSGROESSE_MONAT: Wert<number> = {
  wert: 3_955,
  stand: "2026-01-01",
  kategorie: "gesetzlich",
  quelle:
    "Sozialversicherungsrechengrößen-Verordnung 2026, § 1 — https://www.haufe.de/id/norm/sozialversicherungsrechengroessen-verordnung-2026-1-bezugsgroesse-in-der-sozialversicherung-HI17063750_p1.html",
  verifiziertAm: "2026-07-29",
};

/* ------------------------------------------------------------------ *
 * Einkommensteuer
 * ------------------------------------------------------------------ */
export const GRUNDFREIBETRAG: Wert<number> = {
  wert: 12_348,
  stand: "2026-01-01",
  kategorie: "gesetzlich",
  quelle:
    "Bundesministerium der Finanzen, Monatsbericht Februar 2026 — https://www.bundesfinanzministerium.de/Monatsberichte/Ausgabe/2026/02/Inhalte/Kapitel-2-Analysen/2-5-wichtigste-steuerliche-aenderungen-2026.html",
  verifiziertAm: "2026-07-29",
};

/* ------------------------------------------------------------------ *
 * Zuzahlung Krankenfahrt (§ 61 SGB V)
 * ------------------------------------------------------------------ */
export const ZUZAHLUNG_KRANKENFAHRT = {
  stand: "2004-01-01",
  kategorie: "gesetzlich",
  quelle: "§ 61 SGB V — https://www.gesetze-im-internet.de/sgb_5/__61.html",
  verifiziertAm: "2026-07-29",
  hinweis:
    "Kabinettsbeschluss vom 29.04.2026 (GKV-Beitragssatzstabilisierungsgesetz, Stand heute: noch NICHT von Bundestag/Bundesrat verabschiedet) sieht ab 2027 eine Anhebung der Zuzahlungsgrenzen um 50% vor: mind. 7,50 €, max. 15 € (Prozentsatz unverändert bei 10%). Vor Umsetzung erneut prüfen, ob das Gesetz tatsächlich in Kraft getreten ist.",
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
  kategorie: "gesetzlich",
  quelle:
    "BEG IV (Bürokratieentlastungsgesetz IV, gilt seit 01.01.2025) für Rechnungen/Belege & Bücher; § 41 Abs. 1 Satz 9 EStG — https://www.gesetze-im-internet.de/estg/__41.html für Lohnkonten. Hinweis: arbeitszeitnachweise wurde in diesem Lauf nicht neu verifiziert.",
  verifiziertAm: "2026-07-29",
  /** Rechnungen/Belege (verkürzt durch BEG IV) */
  rechnungenBelege: 8,
  /** Bücher/Bilanzen */
  buecher: 10,
  /** Lohnkonten – eigene, kürzere Frist (§ 41 Abs. 1 Satz 9 EStG), nicht mit den 8 Jahren für Buchungsbelege verwechseln. */
  lohnkonten: 6,
  /** Arbeitszeitnachweise (in diesem Lauf nicht neu recherchiert) */
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
