// Client-safe mapping between the persisted `drivers` table (snake_case) and the
// in-app `Fahrer` domain type (camelCase). No server-only imports here so this
// module can be used from both server functions and the browser store.
import type { Fahrer, FahrerStatus, Nachweis, Vertragsart } from "@/lib/fahrer";

/** Shape the client sends when creating/updating a driver. */
export interface DriverWrite {
  nummer?: string;
  name: string;
  foto: string | null;
  telefon: string;
  email: string;
  adresse: string;
  fuehrerschein: Nachweis;
  pSchein: Nachweis;
  ersteHilfe: Nachweis;
  vertragsart: Vertragsart;
  arbeitszeiten: string;
  urlaubstage: number;
  krankheitstage: number;
  status: FahrerStatus;
  standort: string;
  gps: { lat: number; lng: number };
  fahrzeug: string | null;
  schicht: string;
  bewertung: number;
  puenktlichkeit: number;
  beschwerden: number;
  lob: number;
  ueberstunden: number;
  kmHeute: number;
  umsatzHeute: number;
  gewinnHeute: number;
}

/** Minimal structural type of a row coming back from the `drivers` table. */
export interface DriverRow {
  id: string;
  nummer: string;
  name: string;
  foto: string | null;
  telefon: string;
  email: string;
  adresse: string;
  fuehrerschein: unknown;
  p_schein: unknown;
  erste_hilfe: unknown;
  vertragsart: string;
  arbeitszeiten: string;
  urlaubstage: number;
  krankheitstage: number;
  status: string;
  standort: string;
  gps: unknown;
  fahrzeug: string | null;
  schicht: string;
  bewertung: number | string;
  puenktlichkeit: number;
  beschwerden: number;
  lob: number;
  ueberstunden: number | string;
  km_heute: number | string;
  umsatz_heute: number | string;
  gewinn_heute: number | string;
}

function asNachweis(value: unknown): Nachweis {
  const v = (value ?? {}) as Partial<Nachweis>;
  return { gueltigBis: v.gueltigBis ?? "", info: v.info };
}

function asGps(value: unknown): { lat: number; lng: number } {
  const v = (value ?? {}) as Partial<{ lat: number; lng: number }>;
  return { lat: Number(v.lat ?? 0), lng: Number(v.lng ?? 0) };
}

export function rowToFahrer(r: DriverRow): Fahrer {
  return {
    id: r.id,
    nummer: r.nummer,
    name: r.name,
    foto: r.foto,
    telefon: r.telefon,
    email: r.email,
    adresse: r.adresse,
    fuehrerschein: asNachweis(r.fuehrerschein),
    pSchein: asNachweis(r.p_schein),
    ersteHilfe: asNachweis(r.erste_hilfe),
    vertragsart: r.vertragsart as Vertragsart,
    arbeitszeiten: r.arbeitszeiten,
    urlaubstage: Number(r.urlaubstage),
    krankheitstage: Number(r.krankheitstage),
    status: r.status as FahrerStatus,
    standort: r.standort,
    gps: asGps(r.gps),
    fahrzeug: r.fahrzeug,
    schicht: r.schicht,
    bewertung: Number(r.bewertung),
    puenktlichkeit: Number(r.puenktlichkeit),
    beschwerden: Number(r.beschwerden),
    lob: Number(r.lob),
    ueberstunden: Number(r.ueberstunden),
    kmHeute: Number(r.km_heute),
    umsatzHeute: Number(r.umsatz_heute),
    gewinnHeute: Number(r.gewinn_heute),
  };
}

/** Map a client write payload to a DB insert/update object (undefined keys dropped). */
export function writeToRow(w: Partial<DriverWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };
  set("nummer", w.nummer);
  set("name", w.name);
  set("foto", w.foto);
  set("telefon", w.telefon);
  set("email", w.email);
  set("adresse", w.adresse);
  set("fuehrerschein", w.fuehrerschein);
  set("p_schein", w.pSchein);
  set("erste_hilfe", w.ersteHilfe);
  set("vertragsart", w.vertragsart);
  set("arbeitszeiten", w.arbeitszeiten);
  set("urlaubstage", w.urlaubstage);
  set("krankheitstage", w.krankheitstage);
  set("status", w.status);
  set("standort", w.standort);
  set("gps", w.gps);
  set("fahrzeug", w.fahrzeug);
  set("schicht", w.schicht);
  set("bewertung", w.bewertung);
  set("puenktlichkeit", w.puenktlichkeit);
  set("beschwerden", w.beschwerden);
  set("lob", w.lob);
  set("ueberstunden", w.ueberstunden);
  set("km_heute", w.kmHeute);
  set("umsatz_heute", w.umsatzHeute);
  set("gewinn_heute", w.gewinnHeute);
  return row;
}
