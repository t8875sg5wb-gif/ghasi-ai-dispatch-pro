// Mahnwesen: reine Hilfsfunktionen zur Erzeugung von Mahnstufen und
// fertigen Mahntexten (zum Kopieren / Download). Kein Versand – GHASI AI
// bereitet nur vor, der Versand erfolgt manuell.
import type { Rechnung } from "@/lib/finance";
import { brutto, EUR, formatDatum, tageUeberfaellig } from "@/lib/finance";
import type { CompanySettings } from "@/lib/company-settings.functions";

export const MAHN_STUFE_LABEL: Record<number, string> = {
  0: "Keine Mahnung",
  1: "Zahlungserinnerung",
  2: "1. Mahnung",
  3: "2. Mahnung (letzte)",
};

export function mahnStufeLabel(stufe: number): string {
  return MAHN_STUFE_LABEL[Math.min(3, Math.max(0, stufe))] ?? "Mahnung";
}

/** Die nächste anzuwendende Mahnstufe (max. 3). */
export function naechsteMahnstufe(r: Rechnung): number {
  return Math.min(3, (r.mahnstufe ?? 0) + 1);
}

/** Optionale Mahngebühr je Stufe (EUR). */
export function mahngebuehr(stufe: number): number {
  if (stufe >= 3) return 5;
  if (stufe >= 2) return 2.5;
  return 0;
}

const ANREDE: Record<number, string> = {
  1: "wir möchten Sie freundlich daran erinnern, dass die folgende Rechnung noch offen ist:",
  2: "trotz unserer Zahlungserinnerung konnten wir bisher keinen Zahlungseingang feststellen. Wir bitten Sie, den offenen Betrag umgehend zu begleichen:",
  3: "leider ist die nachstehende Rechnung weiterhin unbeglichen. Dies ist unsere letzte Mahnung, bevor wir weitere Schritte einleiten:",
};

/** Baut einen fertigen, formellen Mahntext für eine Rechnung. */
export function buildMahnText(
  r: Rechnung,
  stufe: number,
  company: CompanySettings,
  zahlungsfristTage = 7,
): string {
  const tage = tageUeberfaellig(r);
  const gebuehr = mahngebuehr(stufe);
  const summe = brutto(r) + gebuehr;
  const frist = new Date();
  frist.setDate(frist.getDate() + zahlungsfristTage);
  const fristStr = frist.toLocaleDateString("de-DE");

  const zeilen: string[] = [];
  zeilen.push(`${company.firma}`);
  if (company.adresse) zeilen.push(company.adresse);
  zeilen.push("");
  zeilen.push(`An: ${r.kunde}`);
  zeilen.push("");
  zeilen.push(`Betreff: ${mahnStufeLabel(stufe)} – Rechnung ${r.nummer}`);
  zeilen.push("");
  zeilen.push("Sehr geehrte Damen und Herren,");
  zeilen.push("");
  zeilen.push(ANREDE[stufe] ?? ANREDE[1]);
  zeilen.push("");
  zeilen.push(`Rechnungsnummer: ${r.nummer}`);
  zeilen.push(`Rechnungsdatum:  ${formatDatum(r.datum)}`);
  zeilen.push(`Fällig seit:     ${formatDatum(r.faelligkeit)} (${tage} Tage überfällig)`);
  zeilen.push(`Offener Betrag:  ${EUR(brutto(r))}`);
  if (gebuehr > 0) {
    zeilen.push(`Mahngebühr:      ${EUR(gebuehr)}`);
    zeilen.push(`Gesamtbetrag:    ${EUR(summe)}`);
  }
  zeilen.push("");
  zeilen.push(
    `Bitte überweisen Sie den offenen Betrag bis zum ${fristStr}. Sollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.`,
  );
  zeilen.push("");
  zeilen.push("Mit freundlichen Grüßen");
  zeilen.push(company.inhaber || company.firma);
  return zeilen.join("\n");
}
