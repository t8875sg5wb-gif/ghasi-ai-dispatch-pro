// Client-safe mapping between the persisted `orders` table (snake_case) and the
// in-app `Auftrag` domain type (camelCase). No server-only imports here so this
// module can be used from both server functions and the browser store.
import type {
  Auftrag,
  AuftragPrioritaet,
  AuftragStatus,
  Mobilitaet,
  Transportart,
  VerordnungStatus,
} from "@/lib/auftraege";

/** Shape the client sends when creating/updating an order. */
export interface OrderWrite {
  nummer?: string;
  patient: string;
  transportart: string;
  prioritaet: string;
  status?: string;
  abholort: string;
  zielort: string;
  termin: string;
  fahrer: string | null;
  fahrzeug: string | null;
  kostentraeger: string;
  notiz: string;
  verordnung?: string;
  verordnungDokumentId?: string | null;
  mobilitaet?: string | null;
  begleitperson?: boolean;
  abholanforderung?: string;
  zielanforderung?: string;
  patientennotiz?: string;
  medizinischeNotiz?: string;
  detailStatus?: string | null;
  abrechnungStatus?: string;
  dauerauftragId?: string | null;
}

/** Minimal structural type of a row coming back from the `orders` table. */
export interface OrderRow {
  id: string;
  nummer: string;
  patient: string;
  transportart: string;
  prioritaet: string;
  status: string;
  abholort: string;
  zielort: string;
  termin: string;
  fahrer: string | null;
  fahrzeug: string | null;
  kostentraeger: string;
  notiz: string;
  verordnung: string;
  verordnung_dokument_id: string | null;
  mobilitaet: string | null;
  begleitperson: boolean;
  abholanforderung: string;
  zielanforderung: string;
  patientennotiz: string;
  medizinische_notiz: string;
  detail_status?: string | null;
  abrechnung_status?: string;
  dauerauftrag_id?: string | null;
}

export function rowToAuftrag(r: OrderRow): Auftrag {
  return {
    id: r.id,
    nummer: r.nummer,
    patient: r.patient,
    transportart: r.transportart as Transportart,
    prioritaet: r.prioritaet as AuftragPrioritaet,
    status: r.status as AuftragStatus,
    abholort: r.abholort,
    zielort: r.zielort,
    termin: r.termin,
    fahrer: r.fahrer,
    fahrzeug: r.fahrzeug,
    kostentraeger: r.kostentraeger,
    notiz: r.notiz,
    verordnung: (r.verordnung ?? "nicht_erhalten") as VerordnungStatus,
    verordnungDokumentId: r.verordnung_dokument_id ?? null,
    mobilitaet: (r.mobilitaet ?? undefined) as Mobilitaet | undefined,
    begleitperson: r.begleitperson,
    abholanforderung: r.abholanforderung ?? "",
    zielanforderung: r.zielanforderung ?? "",
    patientennotiz: r.patientennotiz ?? "",
    medizinischeNotiz: r.medizinische_notiz ?? "",
    detailStatus: r.detail_status ?? null,
    abrechnungStatus: r.abrechnung_status ?? "offen",
    dauerauftragId: r.dauerauftrag_id ?? null,
  };
}

/** Map a client write payload to a DB insert/update object (undefined keys dropped). */
export function writeToRow(w: Partial<OrderWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };
  set("nummer", w.nummer);
  set("patient", w.patient);
  set("transportart", w.transportart);
  set("prioritaet", w.prioritaet);
  set("status", w.status);
  set("abholort", w.abholort);
  set("zielort", w.zielort);
  set("termin", w.termin);
  set("fahrer", w.fahrer);
  set("fahrzeug", w.fahrzeug);
  set("kostentraeger", w.kostentraeger);
  set("notiz", w.notiz);
  set("verordnung", w.verordnung);
  set("verordnung_dokument_id", w.verordnungDokumentId);
  set("mobilitaet", w.mobilitaet);
  set("begleitperson", w.begleitperson);
  set("abholanforderung", w.abholanforderung);
  set("zielanforderung", w.zielanforderung);
  set("patientennotiz", w.patientennotiz);
  set("medizinische_notiz", w.medizinischeNotiz);
  set("detail_status", w.detailStatus);
  set("abrechnung_status", w.abrechnungStatus);
  set("dauerauftrag_id", w.dauerauftragId);
  return row;
}
