// Client-safe mapping between the persisted `insurance_policies` table
// (snake_case) and the in-app `Versicherung` domain type (camelCase).
import type { Versicherung, VersicherungsArt, VersicherungsStatus } from "@/lib/versicherungen";

export type InsuranceWrite = Omit<Versicherung, "id">;

export interface InsuranceRow {
  id: string;
  versicherer: string;
  policennummer: string;
  art: string;
  fahrzeug: string;
  beitrag_monat: number;
  selbstbeteiligung: number;
  beginn: string;
  ablauf: string;
  status: string;
  notiz: string | null;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && !Number.isNaN(n) ? n : fallback;
}

export function rowToVersicherung(r: InsuranceRow): Versicherung {
  return {
    id: r.id,
    versicherer: r.versicherer ?? "",
    policennummer: r.policennummer ?? "",
    art: (r.art as VersicherungsArt) ?? "Haftpflicht",
    fahrzeug: r.fahrzeug ?? "",
    beitragMonat: num(r.beitrag_monat),
    selbstbeteiligung: num(r.selbstbeteiligung),
    beginn: r.beginn ?? "",
    ablauf: r.ablauf ?? "",
    status: (r.status as VersicherungsStatus) ?? "aktiv",
    notiz: r.notiz ?? undefined,
  };
}

export function versicherungToRow(w: Partial<InsuranceWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set("versicherer", w.versicherer);
  set("policennummer", w.policennummer);
  set("art", w.art);
  set("fahrzeug", w.fahrzeug);
  set("beitrag_monat", w.beitragMonat);
  set("selbstbeteiligung", w.selbstbeteiligung);
  set("beginn", w.beginn);
  set("ablauf", w.ablauf);
  set("status", w.status);
  set("notiz", w.notiz ?? null);
  return row;
}
