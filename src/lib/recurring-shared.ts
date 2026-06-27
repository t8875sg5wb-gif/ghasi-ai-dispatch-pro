// Client-safe mapping between the persisted `recurring_orders` table (snake_case)
// and the in-app `Dauerauftrag` domain type (camelCase). No server-only imports
// here so this module can be used from both server functions and the browser store.
import type {
  Dauerauftrag,
  DauerauftragStatus,
  Rhythmus,
  SerienKategorie,
} from "@/lib/dauerauftraege";
import type { Mobilitaet } from "@/lib/auftraege";

/** Shape the client sends when creating/updating a recurring order. */
export interface RecurringWrite {
  kennung: string;
  patient: string;
  abholort: string;
  zielort: string;
  terminzeit: string;
  rueckfahrt: boolean;
  rueckfahrtzeit?: string | null;
  mobilitaet: string;
  begleitperson: boolean;
  verordnungErforderlich: boolean;
  kostentraeger: string;
  krankenkasse: string;
  bevorzugtesFahrzeug?: string | null;
  bevorzugterFahrer?: string | null;
  notiz: string;
  medizinischeNotiz: string;
  kategorie: string;
  rhythmus: string;
  wochentage: number[];
  startDatum: string;
  endDatum?: string | null;
  pausiert: boolean;
  pauseVon?: string | null;
  pauseBis?: string | null;
  feiertageUeberspringen: boolean;
  uebersprungeneTermine: string[];
  generierteTermine: string[];
}

/** Minimal structural type of a row coming back from `recurring_orders`. */
export interface RecurringRow {
  id: string;
  kennung: string;
  patient: string;
  abholort: string;
  zielort: string;
  terminzeit: string;
  rueckfahrt: boolean;
  rueckfahrtzeit: string | null;
  mobilitaet: string;
  begleitperson: boolean;
  verordnung_erforderlich: boolean;
  kostentraeger: string;
  krankenkasse: string;
  bevorzugtes_fahrzeug: string | null;
  bevorzugter_fahrer: string | null;
  notiz: string;
  medizinische_notiz: string;
  kategorie: string;
  rhythmus: string;
  wochentage: number[];
  start_datum: string;
  end_datum: string | null;
  pausiert: boolean;
  pause_von: string | null;
  pause_bis: string | null;
  feiertage_ueberspringen: boolean;
  uebersprungene_termine: string[];
  generierte_termine: string[];
  created_at: string;
}

export function rowToDauerauftrag(r: RecurringRow): Dauerauftrag {
  return {
    id: r.id,
    kennung: r.kennung,
    patient: r.patient,
    abholort: r.abholort,
    zielort: r.zielort,
    terminzeit: r.terminzeit,
    rueckfahrt: r.rueckfahrt,
    rueckfahrtzeit: r.rueckfahrtzeit ?? undefined,
    mobilitaet: r.mobilitaet as Mobilitaet,
    begleitperson: r.begleitperson,
    verordnungErforderlich: r.verordnung_erforderlich,
    kostentraeger: r.kostentraeger,
    krankenkasse: r.krankenkasse,
    bevorzugtesFahrzeug: r.bevorzugtes_fahrzeug,
    bevorzugterFahrer: r.bevorzugter_fahrer,
    notiz: r.notiz ?? "",
    medizinischeNotiz: r.medizinische_notiz ?? "",
    kategorie: r.kategorie as SerienKategorie,
    rhythmus: r.rhythmus as Rhythmus,
    wochentage: r.wochentage ?? [],
    startDatum: r.start_datum,
    endDatum: r.end_datum,
    pausiert: r.pausiert,
    pauseVon: r.pause_von,
    pauseBis: r.pause_bis,
    feiertageUeberspringen: r.feiertage_ueberspringen,
    uebersprungeneTermine: r.uebersprungene_termine ?? [],
    generierteTermine: r.generierte_termine ?? [],
    erstellt: r.created_at,
  };
}

/** Map a full Dauerauftrag (domain) to a client write payload. */
export function dauerauftragToWrite(d: Dauerauftrag): RecurringWrite {
  return {
    kennung: d.kennung,
    patient: d.patient,
    abholort: d.abholort,
    zielort: d.zielort,
    terminzeit: d.terminzeit,
    rueckfahrt: d.rueckfahrt,
    rueckfahrtzeit: d.rueckfahrtzeit ?? null,
    mobilitaet: d.mobilitaet,
    begleitperson: d.begleitperson,
    verordnungErforderlich: d.verordnungErforderlich,
    kostentraeger: d.kostentraeger,
    krankenkasse: d.krankenkasse,
    bevorzugtesFahrzeug: d.bevorzugtesFahrzeug,
    bevorzugterFahrer: d.bevorzugterFahrer,
    notiz: d.notiz,
    medizinischeNotiz: d.medizinischeNotiz,
    kategorie: d.kategorie,
    rhythmus: d.rhythmus,
    wochentage: d.wochentage,
    startDatum: d.startDatum,
    endDatum: d.endDatum,
    pausiert: d.pausiert,
    pauseVon: d.pauseVon,
    pauseBis: d.pauseBis,
    feiertageUeberspringen: d.feiertageUeberspringen,
    uebersprungeneTermine: d.uebersprungeneTermine,
    generierteTermine: d.generierteTermine,
  };
}

/** Map a client write payload to a DB insert/update object (undefined keys dropped). */
export function writeToRecurringRow(w: Partial<RecurringWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };
  set("kennung", w.kennung);
  set("patient", w.patient);
  set("abholort", w.abholort);
  set("zielort", w.zielort);
  set("terminzeit", w.terminzeit);
  set("rueckfahrt", w.rueckfahrt);
  set("rueckfahrtzeit", w.rueckfahrtzeit);
  set("mobilitaet", w.mobilitaet);
  set("begleitperson", w.begleitperson);
  set("verordnung_erforderlich", w.verordnungErforderlich);
  set("kostentraeger", w.kostentraeger);
  set("krankenkasse", w.krankenkasse);
  set("bevorzugtes_fahrzeug", w.bevorzugtesFahrzeug);
  set("bevorzugter_fahrer", w.bevorzugterFahrer);
  set("notiz", w.notiz);
  set("medizinische_notiz", w.medizinischeNotiz);
  set("kategorie", w.kategorie);
  set("rhythmus", w.rhythmus);
  set("wochentage", w.wochentage);
  set("start_datum", w.startDatum);
  set("end_datum", w.endDatum);
  set("pausiert", w.pausiert);
  set("pause_von", w.pauseVon);
  set("pause_bis", w.pauseBis);
  set("feiertage_ueberspringen", w.feiertageUeberspringen);
  set("uebersprungene_termine", w.uebersprungeneTermine);
  set("generierte_termine", w.generierteTermine);
  return row;
}
