// Client-safe mapping between the persisted `vehicles` table (snake_case) and
// the in-app `Fahrzeug` domain type (camelCase).
import type {
  Fahrzeug,
  Fahrzeugtyp,
  FahrzeugStatus,
  Kraftstoffart,
  Reifenstatus,
  Reparatur,
} from "@/lib/fahrzeuge";

/** Shape the client sends when creating/updating a vehicle (no id/nummer). */
export type VehicleWrite = Omit<Fahrzeug, "id" | "nummer"> & { nummer?: string };

export interface VehicleRow {
  id: string;
  nummer: string;
  kennzeichen: string;
  marke: string;
  modell: string;
  baujahr: number;
  typ: string;
  rollstuhl_geeignet: boolean;
  liegend_geeignet: boolean;
  sitzplaetze: number;
  status: string;
  fahrer: string | null;
  standort: string;
  gps: unknown;
  kilometerstand: number;
  tankstand: number;
  kraftstoff: string;
  verbrauch: number;
  reichweite: number;
  kosten_pro_km: number;
  tagesumsatz: number;
  tagesgewinn: number;
  monatsumsatz: number;
  monatsgewinn: number;
  tuev_bis: string;
  oelwechsel_bei: number;
  naechste_wartung: string;
  reifenstatus: string;
  reparaturen: unknown;
  versicherung: string;
  versicherung_bis: string;
  leasingrate: number;
  leasing_ende: string;
  dokumente: unknown;
  fotos: unknown;
  notizen: string;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && !Number.isNaN(n) ? n : fallback;
}

export function rowToFahrzeug(r: VehicleRow): Fahrzeug {
  const gps =
    r.gps && typeof r.gps === "object"
      ? (r.gps as { lat: number; lng: number })
      : { lat: 52.29, lng: 8.9 };
  return {
    id: r.id,
    nummer: r.nummer ?? "—",
    kennzeichen: r.kennzeichen ?? "",
    marke: r.marke ?? "",
    modell: r.modell ?? "",
    baujahr: num(r.baujahr, 2020),
    typ: (r.typ as Fahrzeugtyp) ?? "KTW",
    rollstuhlGeeignet: Boolean(r.rollstuhl_geeignet),
    liegendGeeignet: Boolean(r.liegend_geeignet),
    sitzplaetze: num(r.sitzplaetze, 1),
    status: (r.status as FahrzeugStatus) ?? "frei",
    fahrer: r.fahrer ?? null,
    standort: r.standort ?? "",
    gps: { lat: num(gps.lat, 52.29), lng: num(gps.lng, 8.9) },
    kilometerstand: num(r.kilometerstand),
    tankstand: num(r.tankstand, 100),
    kraftstoff: (r.kraftstoff as Kraftstoffart) ?? "Diesel",
    verbrauch: num(r.verbrauch),
    reichweite: num(r.reichweite),
    kostenProKm: num(r.kosten_pro_km),
    tagesumsatz: num(r.tagesumsatz),
    tagesgewinn: num(r.tagesgewinn),
    monatsumsatz: num(r.monatsumsatz),
    monatsgewinn: num(r.monatsgewinn),
    tuevBis: r.tuev_bis ?? "",
    oelwechselBei: num(r.oelwechsel_bei),
    naechsteWartung: r.naechste_wartung ?? "",
    reifenstatus: (r.reifenstatus as Reifenstatus) ?? "gut",
    reparaturen: Array.isArray(r.reparaturen) ? (r.reparaturen as Reparatur[]) : [],
    versicherung: r.versicherung ?? "",
    versicherungBis: r.versicherung_bis ?? "",
    leasingrate: num(r.leasingrate),
    leasingEnde: r.leasing_ende ?? "",
    dokumente: Array.isArray(r.dokumente) ? (r.dokumente as string[]) : [],
    fotos: Array.isArray(r.fotos) ? (r.fotos as string[]) : [],
    notizen: r.notizen ?? "",
  };
}

export function fahrzeugToRow(w: Partial<VehicleWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set("nummer", w.nummer);
  set("kennzeichen", w.kennzeichen);
  set("marke", w.marke);
  set("modell", w.modell);
  set("baujahr", w.baujahr);
  set("typ", w.typ);
  set("rollstuhl_geeignet", w.rollstuhlGeeignet);
  set("liegend_geeignet", w.liegendGeeignet);
  set("sitzplaetze", w.sitzplaetze);
  set("status", w.status);
  set("fahrer", w.fahrer);
  set("standort", w.standort);
  set("gps", w.gps);
  set("kilometerstand", w.kilometerstand);
  set("tankstand", w.tankstand);
  set("kraftstoff", w.kraftstoff);
  set("verbrauch", w.verbrauch);
  set("reichweite", w.reichweite);
  set("kosten_pro_km", w.kostenProKm);
  set("tagesumsatz", w.tagesumsatz);
  set("tagesgewinn", w.tagesgewinn);
  set("monatsumsatz", w.monatsumsatz);
  set("monatsgewinn", w.monatsgewinn);
  set("tuev_bis", w.tuevBis);
  set("oelwechsel_bei", w.oelwechselBei);
  set("naechste_wartung", w.naechsteWartung);
  set("reifenstatus", w.reifenstatus);
  set("reparaturen", w.reparaturen);
  set("versicherung", w.versicherung);
  set("versicherung_bis", w.versicherungBis);
  set("leasingrate", w.leasingrate);
  set("leasing_ende", w.leasingEnde);
  set("dokumente", w.dokumente);
  set("fotos", w.fotos);
  set("notizen", w.notizen);
  return row;
}
