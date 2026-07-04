// Client-safe mapping between the persisted `insurers` table (snake_case) and
// the in-app `Krankenkasse` domain type (camelCase).
import type { Krankenkasse } from "@/lib/stammdaten";

export type InsurerWrite = Omit<Krankenkasse, "id">;

export interface InsurerRow {
  id: string;
  name: string;
  kuerzel: string;
  vertragsstatus: string;
}

export function rowToKrankenkasse(r: InsurerRow): Krankenkasse {
  return {
    id: r.id,
    name: r.name ?? "",
    kuerzel: r.kuerzel ?? "",
    vertragsstatus: (r.vertragsstatus as Krankenkasse["vertragsstatus"]) ?? "Einzelfall",
  };
}

export function krankenkasseToRow(w: Partial<InsurerWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set("name", w.name);
  set("kuerzel", w.kuerzel);
  set("vertragsstatus", w.vertragsstatus);
  return row;
}
