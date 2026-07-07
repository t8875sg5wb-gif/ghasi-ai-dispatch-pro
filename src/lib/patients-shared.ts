// Client-safe mapping between the persisted `patients` table (snake_case) and
// the in-app `Patient` domain type (camelCase).
import type { Patient } from "@/lib/stammdaten";

export type PatientWrite = Omit<Patient, "id">;

export interface PatientRow {
  id: string;
  name: string;
  telefon: string | null;
  mobilitaet: string;
  kostentraeger: string;
  hinweis: string;
  begleitperson: boolean;
  medizinische_notiz: string | null;
  patientennotiz: string | null;
}

export function rowToPatient(r: PatientRow): Patient {
  return {
    id: r.id,
    name: r.name ?? "",
    telefon: r.telefon ?? undefined,
    mobilitaet: (r.mobilitaet as Patient["mobilitaet"]) ?? "Gehfähig",
    kostentraeger: r.kostentraeger ?? "",
    hinweis: r.hinweis ?? "",
    begleitperson: Boolean(r.begleitperson),
    medizinischeNotiz: r.medizinische_notiz ?? undefined,
    patientennotiz: r.patientennotiz ?? undefined,
  };
}

export function patientToRow(w: Partial<PatientWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set("name", w.name);
  set("telefon", w.telefon ?? null);
  set("mobilitaet", w.mobilitaet);
  set("kostentraeger", w.kostentraeger);
  set("hinweis", w.hinweis);
  set("begleitperson", w.begleitperson);
  set("medizinische_notiz", w.medizinischeNotiz ?? null);
  set("patientennotiz", w.patientennotiz ?? null);
  return row;
}
