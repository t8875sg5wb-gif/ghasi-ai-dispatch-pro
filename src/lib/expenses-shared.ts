// Client-safe types & mapping for the `expenses` (Ausgaben) domain.
// Business rule (Schiene A, §4 Nr.17b): in VAT-exempt mode input VAT is NOT
// recoverable (§15 Abs.2 UStG), so expenses are booked GROSS; the VAT part is
// shown only as "nicht abziehbare Vorsteuer" information.

export const AUSGABE_KATEGORIEN = [
  "Kraftstoff",
  "Reparatur",
  "Leasing",
  "Versicherung",
  "Löhne",
  "Büro",
  "Sonstiges",
] as const;

export type AusgabeKategorie = (typeof AUSGABE_KATEGORIEN)[number];

export interface Ausgabe {
  id: string;
  datum: string; // ISO date
  kategorie: AusgabeKategorie;
  lieferant: string;
  betragBrutto: number;
  ustSatz: number;
  fahrzeugId?: string | null;
  fahrerId?: string | null;
  notiz?: string | null;
  belegDokumentId?: string | null;
  createdAt?: string;
}

export type AusgabeWrite = Omit<Ausgabe, "id" | "createdAt">;

export interface ExpenseRow {
  id: string;
  datum: string;
  kategorie: string;
  lieferant: string;
  betrag_brutto: number | string;
  ust_satz: number | string;
  fahrzeug_id: string | null;
  fahrer_id: string | null;
  notiz: string | null;
  beleg_dokument_id: string | null;
  created_at: string;
}

const toNum = (v: number | string | null | undefined): number =>
  v === null || v === undefined ? 0 : typeof v === "number" ? v : Number(v);

export function rowToAusgabe(r: ExpenseRow): Ausgabe {
  return {
    id: r.id,
    datum: r.datum,
    kategorie: (r.kategorie as AusgabeKategorie) ?? "Sonstiges",
    lieferant: r.lieferant ?? "",
    betragBrutto: toNum(r.betrag_brutto),
    ustSatz: toNum(r.ust_satz),
    fahrzeugId: r.fahrzeug_id ?? null,
    fahrerId: r.fahrer_id ?? null,
    notiz: r.notiz ?? null,
    belegDokumentId: r.beleg_dokument_id ?? null,
    createdAt: r.created_at,
  };
}

export function ausgabeToRow(w: Partial<AusgabeWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set("datum", w.datum);
  set("kategorie", w.kategorie);
  set("lieferant", w.lieferant);
  set("betrag_brutto", w.betragBrutto);
  set("ust_satz", w.ustSatz);
  set("fahrzeug_id", w.fahrzeugId ?? null);
  set("fahrer_id", w.fahrerId ?? null);
  set("notiz", w.notiz ?? null);
  set("beleg_dokument_id", w.belegDokumentId ?? null);
  return row;
}

/** Included (non-recoverable in exempt mode) input VAT of a gross expense. */
export function enthalteneVorsteuer(a: Pick<Ausgabe, "betragBrutto" | "ustSatz">): number {
  if (a.ustSatz <= 0) return 0;
  const netto = a.betragBrutto / (1 + a.ustSatz / 100);
  return Math.round((a.betragBrutto - netto) * 100) / 100;
}

export function nettoBetrag(a: Pick<Ausgabe, "betragBrutto" | "ustSatz">): number {
  if (a.ustSatz <= 0) return a.betragBrutto;
  return Math.round((a.betragBrutto / (1 + a.ustSatz / 100)) * 100) / 100;
}
