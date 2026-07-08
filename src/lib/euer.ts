// ============================================================
// GHASI AI — Einnahmen-Überschuss-Rechnung (EÜR, §4 Abs.3 EStG)
// ------------------------------------------------------------
// Aggregiert echte Daten nach dem Zufluss-/Abflussprinzip (§11 EStG):
//   Betriebseinnahmen = tatsächliche Zahlungseingänge bezahlter Rechnungen
//   Betriebsausgaben  = Ausgaben (im §4-Nr.17b-Modus brutto gebucht)
// gruppiert nach den offiziellen Anlage-EÜR-Zeilen.
//
// WICHTIG: Vorbereitung für die Steuererklärung – ersetzt keine
// steuerliche Beratung. Übertragung ans Finanzamt erfolgt über ELSTER.
// ============================================================
import type { Rechnung } from "@/lib/finance";
import { brutto, summeZahlungen, letzteZahlungDatum, abgeleiteterStatus } from "@/lib/finance";
import type { Ausgabe, AusgabeKategorie } from "@/lib/expenses-shared";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Offizielle Anlage-EÜR-Ausgabenzeilen (vereinfacht). */
export type EuerAusgabeZeile =
  | "kfzKosten"
  | "miete_leasing"
  | "versicherungen"
  | "personalkosten"
  | "sonstige";

export const EUER_AUSGABE_LABEL: Record<EuerAusgabeZeile, string> = {
  kfzKosten: "Kfz-Kosten (Kraftstoff, Reparaturen)",
  miete_leasing: "Miete/Leasing bewegliche Wirtschaftsgüter",
  versicherungen: "Versicherungen & Beiträge",
  personalkosten: "Personalkosten (Löhne, Gehälter)",
  sonstige: "Sonstige unbeschränkt abziehbare Betriebsausgaben",
};

export const EUER_AUSGABE_ZEILEN: EuerAusgabeZeile[] = [
  "kfzKosten",
  "miete_leasing",
  "versicherungen",
  "personalkosten",
  "sonstige",
];

/** Mapping Ausgaben-Kategorie → Anlage-EÜR-Zeile. */
export function euerZeileFuer(kat: AusgabeKategorie): EuerAusgabeZeile {
  switch (kat) {
    case "Kraftstoff":
    case "Reparatur":
      return "kfzKosten";
    case "Leasing":
      return "miete_leasing";
    case "Versicherung":
      return "versicherungen";
    case "Löhne":
      return "personalkosten";
    case "Büro":
    case "Sonstiges":
    default:
      return "sonstige";
  }
}

export type EuerEinnahmeZeile = "steuerfrei_4_17b" | "andere";

export const EUER_EINNAHME_LABEL: Record<EuerEinnahmeZeile, string> = {
  steuerfrei_4_17b: "Umsatzsteuerfreie Umsätze (§4 Nr.17b UStG)",
  andere: "Andere (steuerpflichtige) Umsätze",
};

const emptyMonths = (): number[] => Array.from({ length: 12 }, () => 0);

export interface EuerZeileErgebnis<K extends string> {
  key: K;
  label: string;
  /** per-month amounts, index 0 = Januar */
  monate: number[];
  summe: number;
}

export interface EuerErgebnis {
  jahr: number;
  einnahmen: EuerZeileErgebnis<EuerEinnahmeZeile>[];
  ausgaben: EuerZeileErgebnis<EuerAusgabeZeile>[];
  einnahmenSumme: number;
  ausgabenSumme: number;
  /** Gewinn/Verlust = Einnahmen − Ausgaben */
  gewinn: number;
  /** enthaltene, nicht abziehbare Vorsteuer (informativ, befreiter Modus) */
  hinweisVorsteuer: number;
}

interface Zahlungsereignis {
  datum: string;
  betrag: number;
  steuerpflichtig: boolean;
}

/** Alle Zahlungseingänge einer Rechnung als Ereignisse (Zuflussprinzip). */
function zahlungsereignisse(r: Rechnung): Zahlungsereignis[] {
  if (r.typ === "gutschrift") {
    // Gutschriften mindern die Einnahmen im Erstattungszeitpunkt.
    const datum = letzteZahlungDatum(r) ?? r.datum;
    return [{ datum, betrag: brutto(r), steuerpflichtig: r.mwstSatz > 0 }];
  }
  const events: Zahlungsereignis[] = [];
  const list = r.zahlungen ?? [];
  if (list.length > 0) {
    for (const z of list) {
      events.push({ datum: z.datum, betrag: z.betrag, steuerpflichtig: r.mwstSatz > 0 });
    }
    return events;
  }
  // Keine erfassten Zahlungen: nutze Status "bezahlt" mit bezahltAm/Datum.
  if (abgeleiteterStatus(r) === "bezahlt") {
    const datum = r.bezahltAm ?? r.datum;
    const betrag = summeZahlungen(r) || brutto(r);
    events.push({ datum, betrag, steuerpflichtig: r.mwstSatz > 0 });
  }
  return events;
}

/**
 * Berechnet die EÜR für ein Jahr aus bezahlten Rechnungen (Einnahmen) und
 * Ausgaben (Zahlungsdatum = Ausgabendatum).
 */
export function computeEuer(
  jahr: number,
  rechnungen: Rechnung[],
  ausgaben: Ausgabe[],
): EuerErgebnis {
  const einM: Record<EuerEinnahmeZeile, number[]> = {
    steuerfrei_4_17b: emptyMonths(),
    andere: emptyMonths(),
  };
  for (const r of rechnungen) {
    for (const ev of zahlungsereignisse(r)) {
      const d = new Date(ev.datum);
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== jahr) continue;
      const zeile: EuerEinnahmeZeile = ev.steuerpflichtig ? "andere" : "steuerfrei_4_17b";
      einM[zeile][d.getMonth()] += ev.betrag;
    }
  }

  const ausM: Record<EuerAusgabeZeile, number[]> = {
    kfzKosten: emptyMonths(),
    miete_leasing: emptyMonths(),
    versicherungen: emptyMonths(),
    personalkosten: emptyMonths(),
    sonstige: emptyMonths(),
  };
  let vorsteuer = 0;
  for (const a of ausgaben) {
    const d = new Date(a.datum);
    if (Number.isNaN(d.getTime()) || d.getFullYear() !== jahr) continue;
    const zeile = euerZeileFuer(a.kategorie);
    ausM[zeile][d.getMonth()] += a.betragBrutto;
    if (a.ustSatz > 0) {
      const netto = a.betragBrutto / (1 + a.ustSatz / 100);
      vorsteuer += a.betragBrutto - netto;
    }
  }

  const einnahmen = (Object.keys(einM) as EuerEinnahmeZeile[]).map((k) => ({
    key: k,
    label: EUER_EINNAHME_LABEL[k],
    monate: einM[k].map(round2),
    summe: round2(einM[k].reduce((s, v) => s + v, 0)),
  }));
  const ausgabenZeilen = EUER_AUSGABE_ZEILEN.map((k) => ({
    key: k,
    label: EUER_AUSGABE_LABEL[k],
    monate: ausM[k].map(round2),
    summe: round2(ausM[k].reduce((s, v) => s + v, 0)),
  }));

  const einnahmenSumme = round2(einnahmen.reduce((s, z) => s + z.summe, 0));
  const ausgabenSumme = round2(ausgabenZeilen.reduce((s, z) => s + z.summe, 0));

  return {
    jahr,
    einnahmen,
    ausgaben: ausgabenZeilen,
    einnahmenSumme,
    ausgabenSumme,
    gewinn: round2(einnahmenSumme - ausgabenSumme),
    hinweisVorsteuer: round2(vorsteuer),
  };
}

export const MONATSNAMEN = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

/** Ermittelt alle Jahre, die in Rechnungen/Ausgaben vorkommen (absteigend). */
export function verfuegbareJahre(rechnungen: Rechnung[], ausgaben: Ausgabe[]): number[] {
  const jahre = new Set<number>();
  jahre.add(new Date().getFullYear());
  for (const r of rechnungen) {
    for (const ev of zahlungsereignisse(r)) {
      const y = new Date(ev.datum).getFullYear();
      if (!Number.isNaN(y)) jahre.add(y);
    }
  }
  for (const a of ausgaben) {
    const y = new Date(a.datum).getFullYear();
    if (!Number.isNaN(y)) jahre.add(y);
  }
  return Array.from(jahre).sort((a, b) => b - a);
}
