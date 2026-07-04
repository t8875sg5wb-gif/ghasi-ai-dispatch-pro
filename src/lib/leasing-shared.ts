// Client-safe mapping between the persisted `leasing_contracts` table
// (snake_case) and the in-app `Leasingvertrag` domain type (camelCase).
import type { Leasingvertrag, LeasingStatus } from "@/lib/leasing";

export type LeasingWrite = Omit<Leasingvertrag, "id">;

export interface LeasingRow {
  id: string;
  leasinggeber: string;
  vertragsnummer: string;
  fahrzeug: string;
  rate_monat: number;
  beginn: string;
  ende: string;
  restwert: number;
  laufzeit_monate: number;
  km_inklusive: number;
  km_aktuell: number;
  status: string;
  notiz: string | null;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && !Number.isNaN(n) ? n : fallback;
}

export function rowToLeasing(r: LeasingRow): Leasingvertrag {
  return {
    id: r.id,
    leasinggeber: r.leasinggeber ?? "",
    vertragsnummer: r.vertragsnummer ?? "",
    fahrzeug: r.fahrzeug ?? "",
    rateMonat: num(r.rate_monat),
    beginn: r.beginn ?? "",
    ende: r.ende ?? "",
    restwert: num(r.restwert),
    laufzeitMonate: num(r.laufzeit_monate),
    kmInklusive: num(r.km_inklusive),
    kmAktuell: num(r.km_aktuell),
    status: (r.status as LeasingStatus) ?? "aktiv",
    notiz: r.notiz ?? undefined,
  };
}

export function leasingToRow(w: Partial<LeasingWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set("leasinggeber", w.leasinggeber);
  set("vertragsnummer", w.vertragsnummer);
  set("fahrzeug", w.fahrzeug);
  set("rate_monat", w.rateMonat);
  set("beginn", w.beginn);
  set("ende", w.ende);
  set("restwert", w.restwert);
  set("laufzeit_monate", w.laufzeitMonate);
  set("km_inklusive", w.kmInklusive);
  set("km_aktuell", w.kmAktuell);
  set("status", w.status);
  set("notiz", w.notiz ?? null);
  return row;
}
