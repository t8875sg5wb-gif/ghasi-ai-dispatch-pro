// Client-safe mapping for insurer contracts (genehmigte Preise / Kassenverträge).
export interface Kassenvertrag {
  id: string;
  insurerId: string;
  leistung: string;
  preis: number;
  einheit: string;
  genehmigt: boolean;
  gueltigAb?: string;
  gueltigBis?: string;
  aktenzeichen: string;
  notiz: string;
}

export interface KassenvertragWrite {
  insurerId: string;
  leistung: string;
  preis: number;
  einheit: string;
  genehmigt: boolean;
  gueltigAb?: string | null;
  gueltigBis?: string | null;
  aktenzeichen?: string;
  notiz?: string;
}

export interface KassenvertragRow {
  id: string;
  insurer_id: string;
  leistung: string;
  preis: number;
  einheit: string;
  genehmigt: boolean;
  gueltig_ab: string | null;
  gueltig_bis: string | null;
  aktenzeichen: string;
  notiz: string;
}

export const VERTRAG_EINHEITEN = ["pro Fahrt", "pro km", "pro Std.", "Pauschale"];

export function rowToKassenvertrag(r: KassenvertragRow): Kassenvertrag {
  return {
    id: r.id,
    insurerId: r.insurer_id,
    leistung: r.leistung ?? "",
    preis: Number(r.preis) || 0,
    einheit: r.einheit ?? "pro Fahrt",
    genehmigt: Boolean(r.genehmigt),
    gueltigAb: r.gueltig_ab ?? undefined,
    gueltigBis: r.gueltig_bis ?? undefined,
    aktenzeichen: r.aktenzeichen ?? "",
    notiz: r.notiz ?? "",
  };
}

export function kassenvertragToRow(w: Partial<KassenvertragWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set("insurer_id", w.insurerId);
  set("leistung", w.leistung);
  set("preis", w.preis);
  set("einheit", w.einheit);
  set("genehmigt", w.genehmigt);
  set("gueltig_ab", w.gueltigAb ?? null);
  set("gueltig_bis", w.gueltigBis ?? null);
  set("aktenzeichen", w.aktenzeichen ?? "");
  set("notiz", w.notiz ?? "");
  return row;
}
