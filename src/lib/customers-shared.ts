// Client-safe mapping between the persisted `customers` table (snake_case) and
// the in-app `Kunde` domain type (camelCase).
import type { Kunde } from "@/lib/stammdaten";

export type CustomerWrite = Omit<Kunde, "id">;

export interface CustomerRow {
  id: string;
  name: string;
  typ: string;
  ansprechpartner: string;
  telefon: string;
  offene_rechnungen: number;
  email: string | null;
  adresse: string | null;
  vertragsstatus: string | null;
  konditionen: string | null;
  zahlungsziel_tage: number | null;
  kreditlimit: number | null;
  umsatz_jahr: number | null;
  notiz: string | null;
  aktiv: boolean;
}

export function rowToKunde(r: CustomerRow): Kunde {
  return {
    id: r.id,
    name: r.name ?? "",
    typ: (r.typ as Kunde["typ"]) ?? "Sonstige",
    ansprechpartner: r.ansprechpartner ?? "",
    telefon: r.telefon ?? "",
    offeneRechnungen: r.offene_rechnungen ?? 0,
    email: r.email ?? undefined,
    adresse: r.adresse ?? undefined,
    vertragsstatus: (r.vertragsstatus as Kunde["vertragsstatus"]) ?? undefined,
    konditionen: r.konditionen ?? undefined,
    zahlungszielTage: r.zahlungsziel_tage ?? undefined,
    kreditlimit: r.kreditlimit ?? undefined,
    umsatzJahr: r.umsatz_jahr ?? undefined,
    notiz: r.notiz ?? undefined,
    aktiv: r.aktiv ?? true,
  };
}

export function kundeToRow(w: Partial<CustomerWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set("name", w.name);
  set("typ", w.typ);
  set("ansprechpartner", w.ansprechpartner);
  set("telefon", w.telefon);
  set("offene_rechnungen", w.offeneRechnungen);
  set("email", w.email ?? null);
  set("adresse", w.adresse ?? null);
  set("vertragsstatus", w.vertragsstatus ?? null);
  set("konditionen", w.konditionen ?? null);
  set("zahlungsziel_tage", w.zahlungszielTage ?? null);
  set("kreditlimit", w.kreditlimit ?? null);
  set("umsatz_jahr", w.umsatzJahr ?? null);
  set("notiz", w.notiz ?? null);
  set("aktiv", w.aktiv);
  return row;
}
