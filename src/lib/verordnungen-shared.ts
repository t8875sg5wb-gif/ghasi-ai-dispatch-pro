// Client-safe Domänentyp und Mapper für die Tabelle `verordnungen`
// (ärztliche Verordnung, Muster 4). Bewusst OHNE Diagnose- oder sonstige
// medizinische Freitextfelder — es werden nur die für die Kassenabrechnung
// notwendigen Angaben gespeichert.
import type { Transportart } from "@/lib/auftraege";

export interface Verordnung {
  id: string;
  /** Stabile Patienten-Zuordnung (patients.id); null = noch nicht verknüpft. */
  patientId: string | null;
  ausstellungsdatum: string; // YYYY-MM-DD
  arztName: string;
  /** Betriebsstättennummer */
  arztBsnr: string;
  /** Lebenslange Arztnummer */
  arztLanr: string;
  transportart: Transportart;
  hinRueckfahrt: boolean;
  istSerie: boolean;
  /** Genehmigte Anzahl Fahrten (nur bei Serie). */
  anzahlFaelligkeiten: number | null;
  seriengueltigVon: string | null;
  seriengueltigBis: string | null;
  genehmigtVonKasse: boolean;
  genehmigungsnummer: string;
  /** Verweis auf den vorhandenen Scan im Dokumentencenter. */
  dokumentId: string | null;
  notiz: string;
}

export type VerordnungWrite = Omit<Verordnung, "id">;

export interface VerordnungRow {
  id: string;
  patient_id: string | null;
  ausstellungsdatum: string;
  arzt_name: string | null;
  arzt_bsnr: string | null;
  arzt_lanr: string | null;
  transportart: string;
  hin_rueckfahrt: boolean | null;
  ist_serie: boolean | null;
  anzahl_faelligkeiten: number | null;
  seriengueltig_von: string | null;
  seriengueltig_bis: string | null;
  genehmigt_von_kasse: boolean | null;
  genehmigungsnummer: string | null;
  dokument_id: string | null;
  notiz: string | null;
}

const TRANSPORTARTEN: Transportart[] = [
  "Liegendtransport",
  "Sitzendtransport",
  "Rollstuhl",
  "Dialysefahrt",
];

export function istTransportart(v: string): v is Transportart {
  return (TRANSPORTARTEN as string[]).includes(v);
}

export function rowToVerordnung(r: VerordnungRow): Verordnung {
  return {
    id: r.id,
    patientId: r.patient_id ?? null,
    ausstellungsdatum: r.ausstellungsdatum,
    arztName: r.arzt_name ?? "",
    arztBsnr: r.arzt_bsnr ?? "",
    arztLanr: r.arzt_lanr ?? "",
    transportart: istTransportart(r.transportart) ? r.transportart : "Sitzendtransport",
    hinRueckfahrt: Boolean(r.hin_rueckfahrt),
    istSerie: Boolean(r.ist_serie),
    anzahlFaelligkeiten: r.anzahl_faelligkeiten ?? null,
    seriengueltigVon: r.seriengueltig_von ?? null,
    seriengueltigBis: r.seriengueltig_bis ?? null,
    genehmigtVonKasse: Boolean(r.genehmigt_von_kasse),
    genehmigungsnummer: r.genehmigungsnummer ?? "",
    dokumentId: r.dokument_id ?? null,
    notiz: r.notiz ?? "",
  };
}

export function verordnungToRow(w: Partial<VerordnungWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set("patient_id", w.patientId);
  set("ausstellungsdatum", w.ausstellungsdatum);
  set("arzt_name", w.arztName);
  set("arzt_bsnr", w.arztBsnr);
  set("arzt_lanr", w.arztLanr);
  set("transportart", w.transportart);
  set("hin_rueckfahrt", w.hinRueckfahrt);
  set("ist_serie", w.istSerie);
  set("anzahl_faelligkeiten", w.anzahlFaelligkeiten);
  set("seriengueltig_von", w.seriengueltigVon);
  set("seriengueltig_bis", w.seriengueltigBis);
  set("genehmigt_von_kasse", w.genehmigtVonKasse);
  set("genehmigungsnummer", w.genehmigungsnummer);
  set("dokument_id", w.dokumentId);
  set("notiz", w.notiz);
  return row;
}

/** Kurzbeschriftung für Auswahllisten. */
export function verordnungLabel(v: Verordnung): string {
  const datum = v.ausstellungsdatum.split("-").reverse().join(".");
  const serie = v.istSerie
    ? ` · Serie${v.anzahlFaelligkeiten ? ` ${v.anzahlFaelligkeiten}×` : ""}`
    : "";
  const arzt = v.arztName ? ` · ${v.arztName}` : "";
  return `${datum} · ${v.transportart}${serie}${arzt}`;
}
