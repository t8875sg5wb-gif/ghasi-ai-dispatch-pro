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
