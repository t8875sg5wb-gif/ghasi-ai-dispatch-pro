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
import {
  type AdresseStruktur,
  adresseAusStrukturOderLegacy,
  formatAdresse,
  normalisiereAdresse,
} from "@/lib/address";

/** Shape the client sends when creating/updating an order. */
export interface OrderWrite {
  nummer?: string;
  patient: string;
  transportart: string;
  prioritaet: string;
  status?: string;
  /** Legacy fallback; new writes should send `pickup`/`destination`. */
  abholort?: string;
  zielort?: string;
  pickup?: AdresseStruktur;
  destination?: AdresseStruktur;
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
  pickup_street?: string | null;
  pickup_house_number?: string | null;
  pickup_postal_code?: string | null;
  pickup_city?: string | null;
  pickup_country?: string | null;
  pickup_additional_info?: string | null;
  destination_street?: string | null;
  destination_house_number?: string | null;
  destination_postal_code?: string | null;
  destination_city?: string | null;
  destination_country?: string | null;
  destination_additional_info?: string | null;
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
  const pickup = adresseAusStrukturOderLegacy(
    {
      street: r.pickup_street ?? "",
      houseNumber: r.pickup_house_number ?? "",
      postalCode: r.pickup_postal_code ?? "",
      city: r.pickup_city ?? "",
      country: r.pickup_country ?? "Deutschland",
      additionalInfo: r.pickup_additional_info ?? "",
    },
    r.abholort,
  );
  const destination = adresseAusStrukturOderLegacy(
    {
      street: r.destination_street ?? "",
      houseNumber: r.destination_house_number ?? "",
      postalCode: r.destination_postal_code ?? "",
      city: r.destination_city ?? "",
      country: r.destination_country ?? "Deutschland",
      additionalInfo: r.destination_additional_info ?? "",
    },
    r.zielort,
  );
  const abholort = formatAdresse(pickup) || (r.abholort ?? "");
  const zielort = formatAdresse(destination) || (r.zielort ?? "");
  return {
    id: r.id,
    nummer: r.nummer ?? "—",
    patient: r.patient ?? "Unbekannter Patient",
    transportart: (r.transportart || "Sitzendtransport") as Transportart,
    prioritaet: (r.prioritaet || "normal") as AuftragPrioritaet,
    status: (r.status || "neu") as AuftragStatus,
    pickup,
    destination,
    abholort,
    zielort,
    termin: r.termin ?? new Date().toISOString(),
    fahrer: r.fahrer,
    fahrzeug: r.fahrzeug,
    kostentraeger: r.kostentraeger ?? "",
    notiz: r.notiz ?? "",
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
  const pickup = w.pickup ? normalisiereAdresse(w.pickup) : w.abholort !== undefined ? normalisiereAdresse(w.abholort) : undefined;
  const destination = w.destination ? normalisiereAdresse(w.destination) : w.zielort !== undefined ? normalisiereAdresse(w.zielort) : undefined;
  set("abholort", w.abholort ?? (pickup ? "" : undefined));
  set("zielort", w.zielort ?? (destination ? "" : undefined));
  if (pickup) {
    set("pickup_street", pickup.street);
    set("pickup_house_number", pickup.houseNumber);
    set("pickup_postal_code", pickup.postalCode);
    set("pickup_city", pickup.city);
    set("pickup_country", pickup.country || "Deutschland");
    set("pickup_additional_info", pickup.additionalInfo);
  }
  if (destination) {
    set("destination_street", destination.street);
    set("destination_house_number", destination.houseNumber);
    set("destination_postal_code", destination.postalCode);
    set("destination_city", destination.city);
    set("destination_country", destination.country || "Deutschland");
    set("destination_additional_info", destination.additionalInfo);
  }
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
