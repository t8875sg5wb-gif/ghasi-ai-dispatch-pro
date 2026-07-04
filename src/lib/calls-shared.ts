// Client-safe mapping between the persisted `calls` table (snake_case) and
// the in-app `Anruf` domain type (camelCase).
import type { Anruf, AnrufRichtung, AnrufStatus, AnrufKategorie } from "@/lib/telefon";

export type CallWrite = Omit<Anruf, "id">;

export interface CallRow {
  id: string;
  richtung: string;
  nummer: string;
  name: string | null;
  zeitpunkt: string;
  dauer_sek: number;
  kategorie: string;
  status: string;
  notiz: string | null;
  auftrag_erstellt: boolean;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && !Number.isNaN(n) ? n : fallback;
}

export function rowToAnruf(r: CallRow): Anruf {
  return {
    id: r.id,
    richtung: (r.richtung as AnrufRichtung) ?? "eingehend",
    nummer: r.nummer ?? "",
    name: r.name ?? undefined,
    zeitpunkt: r.zeitpunkt ?? new Date().toISOString(),
    dauerSek: num(r.dauer_sek),
    kategorie: (r.kategorie as AnrufKategorie) ?? "Sonstige",
    status: (r.status as AnrufStatus) ?? "offen",
    notiz: r.notiz ?? undefined,
    auftragErstellt: Boolean(r.auftrag_erstellt),
  };
}

export function anrufToRow(w: Partial<CallWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set("richtung", w.richtung);
  set("nummer", w.nummer);
  set("name", w.name ?? null);
  set("zeitpunkt", w.zeitpunkt);
  set("dauer_sek", w.dauerSek);
  set("kategorie", w.kategorie);
  set("status", w.status);
  set("notiz", w.notiz ?? null);
  set("auftrag_erstellt", w.auftragErstellt);
  return row;
}
