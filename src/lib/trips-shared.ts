// Client-safe mapping for the per-vehicle mileage log (Fahrtenbuch).
export interface Fahrt {
  id: string;
  vehicleId: string;
  datum: string; // YYYY-MM-DD
  kmStart: number;
  kmEnde: number;
  fahrer: string;
  zweck: string;
  notiz: string;
}

export interface FahrtWrite {
  vehicleId: string;
  datum: string;
  kmStart: number;
  kmEnde: number;
  fahrer?: string;
  zweck?: string;
  notiz?: string;
}

export interface FahrtRow {
  id: string;
  vehicle_id: string;
  datum: string;
  km_start: number;
  km_ende: number;
  fahrer: string;
  zweck: string;
  notiz: string;
}

export function rowToFahrt(r: FahrtRow): Fahrt {
  return {
    id: r.id,
    vehicleId: r.vehicle_id,
    datum: r.datum,
    kmStart: r.km_start ?? 0,
    kmEnde: r.km_ende ?? 0,
    fahrer: r.fahrer ?? "",
    zweck: r.zweck ?? "",
    notiz: r.notiz ?? "",
  };
}

export function fahrtToRow(w: Partial<FahrtWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set("vehicle_id", w.vehicleId);
  set("datum", w.datum);
  set("km_start", w.kmStart);
  set("km_ende", w.kmEnde);
  set("fahrer", w.fahrer ?? "");
  set("zweck", w.zweck ?? "");
  set("notiz", w.notiz ?? "");
  return row;
}

export function fahrtKm(f: Fahrt): number {
  return Math.max(0, f.kmEnde - f.kmStart);
}
