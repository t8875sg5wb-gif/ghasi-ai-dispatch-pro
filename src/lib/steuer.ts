// ============================================================
// GHASI AI — Steuer-/USt-Modul (Krankentransport)
// ------------------------------------------------------------
// Eine Umsatzsteuerbefreiung nach § 4 Nr. 17b UStG gilt nur, wenn die
// gesetzlichen Voraussetzungen im konkreten Betrieb/Fall erfuellt sind, insbesondere
// die Befoerderung mit einem hierfuer besonders eingerichteten Fahrzeug. Dieses Modul kapselt die
// Netto/USt/Brutto-Berechnung, gesetzliche Hinweistexte und den
// gewählten Steuermodus des Unternehmens.
//
// WICHTIG: Diese Angaben ersetzen keine steuerliche Beratung.
// ============================================================
import type { Transportart } from "@/lib/auftraege";
import { GRUNDFREIBETRAG } from "@/lib/gesetzeswerte";

export type SteuerModus = "befreit_4_17b" | "kleinunternehmer_19" | "regulaer_19";

export const STEUER_MODI: SteuerModus[] = ["befreit_4_17b", "kleinunternehmer_19", "regulaer_19"];

export const STEUER_MODUS_LABEL: Record<SteuerModus, string> = {
  befreit_4_17b: "Umsatzsteuerbefreit (§ 4 Nr. 17b UStG)",
  kleinunternehmer_19: "Kleinunternehmer (§ 19 UStG)",
  regulaer_19: "Regelbesteuerung (19 %)",
};

/** Rechtlicher Hinweistext für die Rechnung je Steuermodus. */
export const STEUER_HINWEIS: Record<SteuerModus, string> = {
  befreit_4_17b:
    "Umsatzsteuerfrei gemäß § 4 Nr. 17b UStG (Beförderung kranker oder verletzter Personen mit einem hierfür besonders eingerichteten Fahrzeug).",
  kleinunternehmer_19:
    "Gemäß § 19 UStG (Kleinunternehmerregelung) wird keine Umsatzsteuer berechnet.",
  regulaer_19: "Im ausgewiesenen Betrag sind 19 % Umsatzsteuer enthalten.",
};

export const STEUER_DISCLAIMER = "Diese Angaben ersetzen keine steuerliche Beratung.";

/** Vorauswahl im Formular. Sie ist KEINE rechtliche Einstufung und bleibt bis zur Admin-Bestätigung gesperrt. */
export const DEFAULT_STEUER_MODUS: SteuerModus = "befreit_4_17b";

/**
 * Optionale Überschreibungen je Transportart. Eine Transportart allein beweist
 * keine Steuerbefreiung; Fahrzeugausstattung, Genehmigung und konkrete Leistung
 * koennen entscheidend sein. Leer = der bewusst bestätigte Unternehmensmodus wird verwendet.
 */
export const STEUER_OVERRIDE_TRANSPORTART: Partial<Record<Transportart, SteuerModus>> = {};

/** USt-Satz in Prozent für einen Modus. */
export function satzFuer(modus: SteuerModus): number {
  return modus === "regulaer_19" ? 19 : 0;
}

/** Ermittelt den Steuermodus für eine Transportart (mit Overrides). */
export function modusFuerTransportart(
  art: Transportart,
  standard: SteuerModus = DEFAULT_STEUER_MODUS,
): SteuerModus {
  return STEUER_OVERRIDE_TRANSPORTART[art] ?? standard;
}

export interface SteuerErgebnis {
  netto: number;
  ust: number;
  satz: number;
  brutto: number;
  hinweis: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Berechnet Netto/USt/Brutto für einen Betrag und Steuermodus.
 *
 * Der übergebene `betrag` ist der Netto-Leistungsbetrag. Bei befreiten und
 * Kleinunternehmer-Modi entspricht Netto = Brutto (0 % USt). Nur in der
 * Regelbesteuerung wird die 19 % USt aufgeschlagen.
 */
export function computeUst(betrag: number, modus: SteuerModus): SteuerErgebnis {
  const satz = satzFuer(modus);
  const netto = round2(betrag);
  const ust = round2(netto * (satz / 100));
  const brutto = round2(netto + ust);
  return { netto, ust, satz, brutto, hinweis: STEUER_HINWEIS[modus] };
}

/* ------------------------------------------------------------------ *
 * Gewerbesteuer (Schätzung, Einzelunternehmen)
 * ------------------------------------------------------------------ */

/** Steuermesszahl für den Gewerbeertrag (§ 11 GewStG). */
export const GEWST_MESSZAHL = 0.035;
/** Freibetrag für natürliche Personen/Personengesellschaften (§ 11 Abs. 1 GewStG). */
export const GEWST_FREIBETRAG = 24_500;

/**
 * Schätzt die jährliche Gewerbesteuer für ein Einzelunternehmen:
 * (Jahresgewinn − Freibetrag) × Steuermesszahl × Hebesatz.
 * Nur eine grobe Orientierung — ersetzt keine steuerliche Beratung.
 */
export function computeGewerbesteuer(gewinnJahr: number, hebesatzProzent: number): number {
  // § 11 GewStG: Gewerbeertrag zuerst auf volle 100 EUR nach unten abrunden.
  // Die Funktion bleibt eine Schaetzung, weil Hinzurechnungen/Kuerzungen des
  // tatsaechlichen Gewerbeertrags hier nicht modelliert werden.
  const abgerundet = Math.floor(Math.max(0, gewinnJahr) / 100) * 100;
  const ertrag = Math.max(0, abgerundet - GEWST_FREIBETRAG);
  return Math.round(ertrag * GEWST_MESSZAHL * (hebesatzProzent / 100));
}

/** Geschätzter Jahresgewinn nach Gewerbesteuer. */
export function computeGewinnNachSteuern(gewinnJahr: number, hebesatzProzent: number): number {
  return Math.round(gewinnJahr - computeGewerbesteuer(gewinnJahr, hebesatzProzent));
}

/* ------------------------------------------------------------------ *
 * Einkommensteuer (Schätzung, Grundtarif)
 * ------------------------------------------------------------------ */

/** Grundfreibetrag 2026 – zentral aus gesetzeswerte.ts (Stand Juli 2026). */
export const EST_GRUNDFREIBETRAG_2026 = GRUNDFREIBETRAG.wert;

/**
 * Tarifliche Einkommensteuer 2026 für ein bereits ermitteltes zu versteuerndes Einkommen.
 * Die Tarifformel und Abrundung folgen § 32a EStG. Die Ermittlung des zvE selbst
 * bleibt außerhalb dieser Funktion und kann persönliche Sonderregeln enthalten.
 */
export function computeEinkommensteuer(
  zvE: number,
  grundfreibetrag: number = EST_GRUNDFREIBETRAG_2026,
): number {
  const x = Math.max(0, Math.floor(zvE));
  if (x <= grundfreibetrag) return 0;
  // Tarifzonen: Tarif 2026 (§32a EStG, Steuerfortentwicklungsgesetz).
  const z2Start = 17_799;
  const z3Start = 69_878;
  const z4Start = 277_825;
  let est: number;
  if (x <= z2Start) {
    const y = (x - grundfreibetrag) / 10_000;
    est = (914.51 * y + 1_400) * y;
  } else if (x <= z3Start) {
    const zz = (x - z2Start) / 10_000;
    est = (173.1 * zz + 2_397) * zz + 1_034.87;
  } else if (x <= z4Start) {
    est = 0.42 * x - 11_135.63;
  } else {
    est = 0.45 * x - 19_470.38;
  }

  return Math.max(0, Math.floor(est));
}

/** Splittingtarif nach § 32a Abs. 5 EStG für ein vorgegebenes gemeinsames zvE. */
export function computeEinkommensteuerSplitting(zvEGemeinsam: number): number {
  return 2 * computeEinkommensteuer(Math.floor(Math.max(0, zvEGemeinsam)) / 2);
}

/**
 * Solidaritaetszuschlag 2026 auf die uebergebene ESt-Bemessungsgrundlage.
 * Beruecksichtigt Freigrenze und Milderungszone nach §§ 3, 4 SolzG.
 * Die tatsaechliche Bemessungsgrundlage kann z. B. wegen Kinderfreibetraegen
 * von einer einfachen Einkommensteuer-Schaetzung abweichen.
 */
export function computeSoli(einkommensteuer: number, zusammenveranlagt = false): number {
  const basis = Math.max(0, einkommensteuer);
  const freigrenze = zusammenveranlagt ? 40_700 : 20_350;
  if (basis <= freigrenze) return 0;
  const regulaer = basis * 0.055;
  const milderungszone = (basis - freigrenze) * 0.119;
  return Math.floor(Math.min(regulaer, milderungszone) * 100) / 100;
}
