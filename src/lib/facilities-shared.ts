// Client-safe mapping between the persisted `facilities` table (snake_case) and
// the in-app `Einrichtung` domain type (camelCase).
import type { Einrichtung, EinrichtungTyp } from "@/lib/stammdaten";

export type FacilityWrite = Omit<Einrichtung, "id">;

export interface FacilityRow {
  id: string;
  name: string;
  adresse: string;
  ansprechpartner: string;
  telefon: string;
  typ: string;
  email: string | null;
  fachbereiche: unknown;
  kapazitaet: number | null;
  oeffnungszeiten: string | null;
  kostentraeger: string | null;
  notiz: string | null;
  aktiv: boolean;
}

export function rowToEinrichtung(r: FacilityRow): Einrichtung {
  return {
    id: r.id,
    name: r.name ?? "",
    adresse: r.adresse ?? "",
    ansprechpartner: r.ansprechpartner ?? "",
    telefon: r.telefon ?? "",
    typ: (r.typ as EinrichtungTyp) ?? "krankenhaus",
    email: r.email ?? undefined,
    fachbereiche: Array.isArray(r.fachbereiche) ? (r.fachbereiche as string[]) : [],
    kapazitaet: r.kapazitaet ?? undefined,
    oeffnungszeiten: r.oeffnungszeiten ?? undefined,
    kostentraeger: r.kostentraeger ?? undefined,
    notiz: r.notiz ?? undefined,
    aktiv: r.aktiv ?? true,
  };
}

export function einrichtungToRow(w: Partial<FacilityWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set("name", w.name);
  set("adresse", w.adresse);
  set("ansprechpartner", w.ansprechpartner);
  set("telefon", w.telefon);
  set("typ", w.typ);
  set("email", w.email ?? null);
  set("fachbereiche", w.fachbereiche ?? []);
  set("kapazitaet", w.kapazitaet ?? null);
  set("oeffnungszeiten", w.oeffnungszeiten ?? null);
  set("kostentraeger", w.kostentraeger ?? null);
  set("notiz", w.notiz ?? null);
  set("aktiv", w.aktiv);
  return row;
}
