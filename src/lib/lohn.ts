// ============================================================
// GHASI AI — Lohn-Rechner (informativ, Näherung)
// ------------------------------------------------------------
// Bereitet Netto, Arbeitgeberkosten und die abzuführenden Beträge je
// Fahrer vor. Alle Werte sind Näherungen (Stand 2026) und ersetzen KEINE
// zertifizierte Lohnabrechnung. Die offizielle Meldung erfordert
// zertifizierte Software oder einen Lohnservice.
// ============================================================
import type { Beschaeftigungsart } from "@/lib/fahrer";
import { computeEinkommensteuer } from "@/lib/steuer";
import { computeMidijobBemessung2026 } from "@/lib/midijob-2026";
import {
  MINIJOB_GRENZE_MONAT,
  MIDIJOB_OBERGRENZE,
  SV_SAETZE_2026,
  MINIJOB_PAUSCHAL_AG_PROZENT,
} from "@/lib/gesetzeswerte";

/** Minijob-Grenze (€/Monat) – zentral aus gesetzeswerte.ts (Stand Juli 2026: 603 €). */
export const MINIJOB_GRENZE_2026 = MINIJOB_GRENZE_MONAT.wert;
/** Obergrenze Übergangsbereich (Midijob). */
export const MIDIJOB_GRENZE = MIDIJOB_OBERGRENZE.wert;

/** Näherungssätze Sozialversicherung (Arbeitnehmer-Anteil gesamt, 2026). */
const SV_AN =
  (SV_SAETZE_2026.kvAllgemein / 2 +
    SV_SAETZE_2026.kvZusatzbeitragDurchschnitt / 2 +
    SV_SAETZE_2026.pv / 2 +
    SV_SAETZE_2026.rv / 2 +
    SV_SAETZE_2026.av / 2) /
  100;
/** Näherungssätze Sozialversicherung (Arbeitgeber-Anteil inkl. Umlagen ~1,4 %). */
const SV_AG =
  (SV_SAETZE_2026.kvAllgemein / 2 +
    SV_SAETZE_2026.kvZusatzbeitragDurchschnitt / 2 +
    SV_SAETZE_2026.pvArbeitgeber +
    SV_SAETZE_2026.rv / 2 +
    SV_SAETZE_2026.av / 2) /
    100 +
  0.014;
/** Minijob: pauschale Arbeitgeberabgaben (KV 13 % + RV 15 % + Steuer 2 % + Umlagen). */
const MINIJOB_PAUSCHAL_AG = MINIJOB_PAUSCHAL_AG_PROZENT / 100;
/** Arbeitnehmer-Pauschbetrag (Werbungskosten) pro Jahr. */
const AN_PAUSCHBETRAG = 1_230;

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface LohnErgebnis {
  /** Nur "ok" darf in Summen/Exporte eingehen. */
  rechenstatus: "ok" | "pruefung_erforderlich";
  beschaeftigungsart: Beschaeftigungsart;
  brutto: number;
  /** Arbeitnehmer-SV-Anteil */
  svAn: number;
  /** grobe Lohnsteuer (Näherung, Steuerklasse I) */
  lohnsteuer: number;
  /** ausgezahltes Netto */
  netto: number;
  /** Arbeitgeber-Abgaben (SV-AG-Anteil bzw. Minijob-Pauschale) */
  agAbgaben: number;
  /** Gesamtkosten Arbeitgeber (Brutto + AG-Abgaben) */
  agGesamt: number;
  /** an Krankenkasse/Minijob-Zentrale abzuführen (AN- + AG-SV) */
  anSozialversicherung: number;
  /** an Finanzamt abzuführen (Lohnsteuer) */
  anFinanzamt: number;
  /** Warnung, z. B. Minijob-Grenze überschritten */
  warnung?: string;
}

/** Grobe monatliche Lohnsteuer (Steuerklasse I, Näherung). */
function grobeLohnsteuer(monatsbrutto: number, svAnJahr: number): number {
  const jahresbrutto = monatsbrutto * 12;
  const zvE = Math.max(0, jahresbrutto - AN_PAUSCHBETRAG - svAnJahr);
  return round2(computeEinkommensteuer(zvE) / 12);
}

export function computeLohn(
  beschaeftigungsart: Beschaeftigungsart,
  monatsbrutto: number,
): LohnErgebnis {
  const brutto = Math.max(0, round2(monatsbrutto));

  if (beschaeftigungsart === "minijob") {
    const agAbgaben = round2(brutto * MINIJOB_PAUSCHAL_AG);
    return {
      rechenstatus: "ok",
      beschaeftigungsart,
      brutto,
      svAn: 0,
      lohnsteuer: 0,
      netto: brutto, // i. d. R. RV-befreit; Auszahlung = Brutto
      agAbgaben,
      agGesamt: round2(brutto + agAbgaben),
      anSozialversicherung: agAbgaben,
      anFinanzamt: 0,
      warnung:
        brutto > MINIJOB_GRENZE_2026
          ? `Minijob-Grenze (${MINIJOB_GRENZE_2026} €) überschritten – Beschäftigung ist ggf. sozialversicherungspflichtig.`
          : undefined,
    };
  }

  if (beschaeftigungsart === "midijob") {
    // Übergangsbereich: amtliche 2026-Bemessungsgrundlage (Faktor F=0,6619).
    // Die Beitragssätze bleiben hier eine Näherung, weil dieser Legacy-Rechner
    // keine individuellen KV-/PV-Fakten abfragt.
    let bemessung;
    try {
      bemessung = computeMidijobBemessung2026(brutto);
    } catch {
      return {
        rechenstatus: "pruefung_erforderlich",
        beschaeftigungsart,
        brutto,
        svAn: 0,
        lohnsteuer: 0,
        netto: 0,
        agAbgaben: 0,
        agGesamt: 0,
        anSozialversicherung: 0,
        anFinanzamt: 0,
        warnung:
          "Midijob-Stammdaten ungültig: Arbeitsentgelt muss 2026 zwischen 603,01 € und 2.000,00 € liegen. Keine Beträge berechnet.",
      };
    }
    const svAn = round2(bemessung.beitragspflichtigeEinnahmeArbeitnehmer * SV_AN);
    const lohnsteuer = grobeLohnsteuer(brutto, svAn * 12);
    const agAbgaben = round2(brutto * SV_AG);
    return {
      rechenstatus: "ok",
      beschaeftigungsart,
      brutto,
      svAn,
      lohnsteuer,
      netto: round2(brutto - svAn - lohnsteuer),
      agAbgaben,
      agGesamt: round2(brutto + agAbgaben),
      anSozialversicherung: round2(svAn + agAbgaben),
      anFinanzamt: lohnsteuer,
      warnung:
        brutto > MIDIJOB_GRENZE
          ? `Über ${MIDIJOB_GRENZE} € – regulär sozialversicherungspflichtig statt Midijob.`
          : undefined,
    };
  }

  // sozialversicherungspflichtig
  const svAn = round2(brutto * SV_AN);
  const lohnsteuer = grobeLohnsteuer(brutto, svAn * 12);
  const agAbgaben = round2(brutto * SV_AG);
  return {
    rechenstatus: "ok",
    beschaeftigungsart,
    brutto,
    svAn,
    lohnsteuer,
    netto: round2(brutto - svAn - lohnsteuer),
    agAbgaben,
    agGesamt: round2(brutto + agAbgaben),
    anSozialversicherung: round2(svAn + agAbgaben),
    anFinanzamt: lohnsteuer,
  };
}
