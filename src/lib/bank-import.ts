// Client-side CSV/XLSX bank-statement import & matching against open invoices.
// No external bank API – the user uploads an exported statement, we parse the
// rows and suggest matches by amount and/or invoice number in the reference.
import type { ParsedSheet } from "@/lib/import-parse";
import type { Rechnung } from "@/lib/finance";
import { offenerBetrag } from "@/lib/finance";

export interface BankBuchung {
  datum: string; // ISO (best effort)
  betrag: number; // EUR, positive = incoming payment
  referenz: string;
}

export interface BankMatch {
  buchung: BankBuchung;
  kandidat: Rechnung | null;
  score: number; // 0..1
  grund: string;
}

const DATUM_KEYS = ["buchungstag", "valuta", "datum", "date", "wertstellung"];
const BETRAG_KEYS = ["betrag", "umsatz", "amount", "wert", "haben"];
const REF_KEYS = [
  "verwendungszweck",
  "referenz",
  "buchungstext",
  "reference",
  "zweck",
  "text",
  "beschreibung",
];

function findeSpalte(headers: string[], keys: string[]): string | null {
  const lower = headers.map((h) => ({ orig: h, low: h.toLowerCase() }));
  for (const k of keys) {
    const hit = lower.find((h) => h.low.includes(k));
    if (hit) return hit.orig;
  }
  return null;
}

/** Parse a German or ISO amount string into a number (EUR). */
export function parseBetrag(raw: string): number {
  if (!raw) return NaN;
  let s = raw.replace(/[^\d,.-]/g, "").trim();
  // German format: thousands "." and decimal "," → normalise.
  if (s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function gueltigesIsoDatum(iso: string): boolean {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const [, y, mo, d] = m;
  const date = new Date(`${iso}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() + 1 === Number(mo) &&
    date.getUTCDate() === Number(d)
  );
}

function parseDatum(raw: string): string | null {
  const wert = raw.trim();
  if (!wert) return null;

  // dd.mm.yyyy or dd.mm.yy
  const de = wert.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (de) {
    const [, d, m, y] = de;
    const yr = y.length === 2 ? `20${y}` : y;
    const iso = `${yr}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return gueltigesIsoDatum(iso) ? iso : null;
  }

  const iso = wert.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (iso) return gueltigesIsoDatum(iso[1]) ? iso[1] : null;

  const parsed = new Date(wert);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/** Turn a parsed sheet into incoming bank movements (positive amounts only). */
export function bankBuchungen(sheet: ParsedSheet): BankBuchung[] {
  const datumCol = findeSpalte(sheet.headers, DATUM_KEYS);
  const betragCol = findeSpalte(sheet.headers, BETRAG_KEYS);
  const refCol = findeSpalte(sheet.headers, REF_KEYS);

  if (!datumCol) throw new Error("Keine Datums-Spalte im Kontoauszug gefunden.");
  if (!betragCol) throw new Error("Keine Betragsspalte im Kontoauszug gefunden.");

  const out: BankBuchung[] = [];
  for (let index = 0; index < sheet.rows.length; index += 1) {
    const row = sheet.rows[index];
    const betragRaw = row[betragCol] ?? "";
    const betrag = parseBetrag(betragRaw);
    if (!Number.isFinite(betrag) || betrag <= 0) continue; // only incoming payments

    const datum = parseDatum(row[datumCol] ?? "");
    if (!datum) {
      throw new Error(`Ungültiges oder fehlendes Buchungsdatum in Zeile ${index + 2}.`);
    }

    out.push({
      datum,
      betrag: Math.round(betrag * 100) / 100,
      referenz: refCol ? (row[refCol] ?? "") : Object.values(row).join(" "),
    });
  }
  return out;
}

function normRef(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

/** Suggest the best open-invoice match for a single bank movement. */
export function findeMatch(buchung: BankBuchung, offene: Rechnung[]): BankMatch {
  const ref = normRef(buchung.referenz);
  let best: BankMatch = { buchung, kandidat: null, score: 0, grund: "Kein Treffer" };

  for (const r of offene) {
    const offen = offenerBetrag(r);
    if (offen <= 0) continue;
    const nummerHit = ref.includes(normRef(r.nummer));
    const betragHit = Math.abs(offen - buchung.betrag) < 0.02;

    let score = 0;
    const gruende: string[] = [];
    if (nummerHit) {
      score += 0.6;
      gruende.push(`Rechnungsnr. ${r.nummer} im Verwendungszweck`);
    }
    if (betragHit) {
      score += 0.4;
      gruende.push("Betrag stimmt exakt");
    }
    if (score > best.score) {
      best = { buchung, kandidat: r, score, grund: gruende.join(" · ") || "Teiltreffer" };
    }
  }
  return best;
}

/** Match every bank movement against the list of open invoices. */
export function matcheBuchungen(buchungen: BankBuchung[], offene: Rechnung[]): BankMatch[] {
  return buchungen.map((b) => findeMatch(b, offene));
}
