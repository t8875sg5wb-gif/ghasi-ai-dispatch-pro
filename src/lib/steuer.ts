// ============================================================
// GHASI AI — Steuer-/USt-Modul (Krankentransport)
// ------------------------------------------------------------
// Krankenfahrten/-transporte sind nach § 4 Nr. 17b UStG von der
// Umsatzsteuer befreit. Dieses Modul kapselt die korrekte
// Netto/USt/Brutto-Berechnung, gesetzliche Hinweistexte und den
// gewählten Steuermodus des Unternehmens.
//
// WICHTIG: Diese Angaben ersetzen keine steuerliche Beratung.
// ============================================================
import type { Transportart } from "@/lib/auftraege";
import { GRUNDFREIBETRAG } from "@/lib/gesetzeswerte";

export type SteuerModus = "befreit_4_17b" | "kleinunternehmer_19" | "regulaer_19";

export const STEUER_MODI: SteuerModus[] = [
  "befreit_4_17b",
  "kleinunternehmer_19",
  "regulaer_19",
];

export const STEUER_MODUS_LABEL: Record<SteuerModus, string> = {
  befreit_4_17b: "Umsatzsteuerbefreit (§ 4 Nr. 17b UStG)",
  kleinunternehmer_19: "Kleinunternehmer (§ 19 UStG)",
  regulaer_19: "Regelbesteuerung (19 %)",
};

/** Rechtlicher Hinweistext für die Rechnung je Steuermodus. */
export const STEUER_HINWEIS: Record<SteuerModus, string> = {
  befreit_4_17b:
    "Umsatzsteuerfrei gemäß § 4 Nr. 17b UStG (Beförderung von kranken und verletzten Personen).",
  kleinunternehmer_19:
    "Gemäß § 19 UStG (Kleinunternehmerregelung) wird keine Umsatzsteuer berechnet.",
  regulaer_19: "Im ausgewiesenen Betrag sind 19 % Umsatzsteuer enthalten.",
};

export const STEUER_DISCLAIMER = "Diese Angaben ersetzen keine steuerliche Beratung.";

/** Der unternehmensweite Standardmodus für Krankentransporte. */
export const DEFAULT_STEUER_MODUS: SteuerModus = "befreit_4_17b";

/**
 * Optionale Überschreibungen je Transportart. Standardmäßig sind alle
 * medizinischen Krankenfahrten umsatzsteuerbefreit. Einzelne Arten können hier
 * abweichend geregelt werden (z. B. wenn ein Fahrttyp nicht unter § 4 Nr. 17b
 * fällt). Leer = überall der Unternehmens-Standardmodus.
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
  const ertrag = Math.max(0, gewinnJahr - GEWST_FREIBETRAG);
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
 * Schätzt die Einkommensteuer (Grundtarif) nach dem progressiven Tarif
 * (Formel angelehnt an den Einkommensteuertarif, mit Grundfreibetrag 2026).
 * Nur eine grobe Orientierung — ersetzt keine steuerliche Beratung.
 */
export function computeEinkommensteuer(
  zvE: number,
  grundfreibetrag: number = EST_GRUNDFREIBETRAG_2026,
): number {
  const x = Math.max(0, Math.floor(zvE));
  if (x <= grundfreibetrag) return 0;
  // Tarifzonen (Konstanten angelehnt an den Tarif 2025).
  const z2Start = 17_443;
  const z3Start = 68_480;
  const z4Start = 277_825;
  let est: number;
  if (x <= z2Start) {
    const y = (x - grundfreibetrag) / 10_000;
    est = (932.3 * y + 1_400) * y;
  } else if (x <= z3Start) {
    const zz = (x - z2Start) / 10_000;
    est = (176.64 * zz + 2_397) * zz + 1_015.13;
  } else if (x <= z4Start) {
    est = 0.42 * x - 10_911.92;
  } else {
    est = 0.45 * x - 19_246.67;
  }
  return Math.max(0, Math.round(est));
}

/** Grober Solidaritätszuschlag (5,5 % auf ESt, Freigrenze berücksichtigt näherungsweise). */
export function computeSoli(einkommensteuer: number): number {
  // Freigrenze 2026 ca. 19.950 € ESt (Einzelveranlagung); darunter 0.
  if (einkommensteuer <= 19_950) return 0;
  return Math.round(einkommensteuer * 0.055);
}
