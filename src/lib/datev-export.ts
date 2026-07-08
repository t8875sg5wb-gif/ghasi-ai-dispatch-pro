// DATEV-Buchungsstapel-Export (Format EXTF 700, Kategorie 21) für den
// Steuerberater. Erzeugt eine CSV im DATEV-Standardaufbau. Reine, testbare
// Funktion ohne Seiteneffekte.
//
// HINWEIS: Kontenzuordnungen (SKR03) sind Standardwerte und müssen vom
// Steuerberater geprüft werden.
import type { Rechnung } from "@/lib/finance";
import { brutto } from "@/lib/finance";

export interface DatevOptions {
  beraterNr: string;
  mandantNr: string;
  /** Erlöskonto (SKR03), z. B. 8120 steuerfreie Umsätze §4 Nr.17b */
  erloeskonto: string;
  /** Debitoren-/Gegenkonto, z. B. 10000 */
  gegenkonto: string;
  von: Date;
  bis: Date;
  bezeichnung: string;
}

/** Deutsches Dezimalformat mit Komma, ohne Tausenderpunkt, 2 Nachkommastellen. */
function amount(n: number): string {
  return Math.abs(n).toFixed(2).replace(".", ",");
}

function yyyymmdd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** DATEV-Belegdatum: TTMM (Tag+Monat). */
function ttmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ts(): string {
  const d = new Date();
  return (
    yyyymmdd(d) +
    String(d.getHours()).padStart(2, "0") +
    String(d.getMinutes()).padStart(2, "0") +
    String(d.getSeconds()).padStart(2, "0") +
    "000"
  );
}

/** CSV-Feld quoten, wenn nötig. */
function q(v: string | number): string {
  const s = String(v);
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Spaltenüberschriften des Buchungsstapels (Format 21, gekürzt auf die belegten Felder). */
const SPALTEN = [
  "Umsatz (ohne Soll/Haben-Kz)",
  "Soll/Haben-Kennzeichen",
  "WKZ Umsatz",
  "Kurs",
  "Basis-Umsatz",
  "WKZ Basis-Umsatz",
  "Konto",
  "Gegenkonto (ohne BU-Schlüssel)",
  "BU-Schlüssel",
  "Belegdatum",
  "Belegfeld 1",
  "Belegfeld 2",
  "Skonto",
  "Buchungstext",
];

export interface DatevResult {
  csv: string;
  /** Anzahl exportierter Buchungen. */
  anzahl: number;
  /** Summe der exportierten Bruttobeträge. */
  summe: number;
}

/** Filtert Rechnungen auf den Zeitraum und relevante Status. */
export function datevRechnungen(invoices: Rechnung[], von: Date, bis: Date): Rechnung[] {
  const vonT = new Date(von);
  vonT.setHours(0, 0, 0, 0);
  const bisT = new Date(bis);
  bisT.setHours(23, 59, 59, 999);
  return invoices.filter((r) => {
    if (r.typ !== "rechnung") return false;
    if (r.status === "entwurf" || r.status === "storniert") return false;
    const d = new Date(r.datum).getTime();
    return d >= vonT.getTime() && d <= bisT.getTime();
  });
}

export function buildDatevBuchungsstapel(invoices: Rechnung[], opts: DatevOptions): DatevResult {
  const rows = datevRechnungen(invoices, opts.von, opts.bis);
  const wjBeginn = yyyymmdd(new Date(opts.von.getFullYear(), 0, 1));

  // Kopfzeile (EXTF-Header, Format 21 = Buchungsstapel, Version 7)
  const header = [
    q("EXTF"),
    700,
    21,
    q("Buchungsstapel"),
    7,
    ts(),
    "",
    q(""),
    q(""),
    q(""),
    q(opts.beraterNr),
    q(opts.mandantNr),
    wjBeginn,
    4,
    yyyymmdd(opts.von),
    yyyymmdd(opts.bis),
    q(opts.bezeichnung),
    q(""),
    1,
    0,
    q("EUR"),
    "",
    "",
    "",
    "",
    "",
    "",
    q(""),
  ].join(";");

  const spaltenZeile = SPALTEN.map(q).join(";");

  let summe = 0;
  const datenZeilen = rows.map((r) => {
    const b = brutto(r);
    summe += b;
    return [
      amount(b), // Umsatz
      "S", // Soll (Forderung an Erlöse → Debitor im Soll)
      "EUR", // WKZ
      "", // Kurs
      "", // Basis-Umsatz
      "", // WKZ Basis
      opts.gegenkonto, // Konto = Debitoren-Sammelkonto
      opts.erloeskonto, // Gegenkonto = Erlöskonto
      "", // BU-Schlüssel
      ttmm(r.datum), // Belegdatum TTMM
      q(r.nummer), // Belegfeld 1 = Rechnungsnummer
      "", // Belegfeld 2
      "", // Skonto
      q(`${r.kunde}`.slice(0, 60)), // Buchungstext
    ].join(";");
  });

  const csv = [header, spaltenZeile, ...datenZeilen].join("\r\n");
  return { csv, anzahl: rows.length, summe };
}
