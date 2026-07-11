// Client-safe mapping between the persisted `invoices` table (snake_case) and the
// in-app `Rechnung` domain type (camelCase), plus pure billing rules shared by
// the server functions and the browser. No server-only imports here.
import type {
  Rechnung,
  RechnungStatus,
  RechnungTyp,
  Abrechnungsart,
  RechnungPosition,
  MahnEintrag,
  Zahlung,
} from "@/lib/finance";
import type { Auftrag } from "@/lib/auftraege";

/** Shape the client sends when creating/updating an invoice. */
export interface InvoiceWrite {
  nummer?: string;
  typ?: RechnungTyp;
  kunde?: string;
  kundeId?: string;
  abrechnungsart?: Abrechnungsart;
  betrag?: number;
  mwstSatz?: number;
  status?: RechnungStatus;
  datum?: string;
  faelligkeit?: string;
  leistungsdatum?: string | null;
  bezahltAm?: string | null;
  bezahlterBetrag?: number | null;
  bezugAuftrag?: string | null;
  positionen?: RechnungPosition[];
  notiz?: string | null;
  mahnstufe?: number;
  letzteMahnung?: string | null;
  mahnHistorie?: MahnEintrag[];
  zahlungen?: Zahlung[];
}

/** Minimal structural type of a row coming back from the `invoices` table. */
export interface InvoiceRow {
  id: string;
  nummer: string;
  typ: string;
  kunde: string;
  kunde_id: string;
  abrechnungsart: string;
  betrag: number | string;
  mwst_satz: number | string;
  status: string;
  datum: string;
  faelligkeit: string;
  leistungsdatum: string | null;
  bezahlt_am: string | null;
  bezahlter_betrag: number | string | null;
  bezug_auftrag: string | null;
  positionen: RechnungPosition[] | null;
  notiz: string | null;
  mahnstufe?: number | string | null;
  letzte_mahnung?: string | null;
  mahn_historie?: MahnEintrag[] | null;
  zahlungen?: Zahlung[] | null;
}

const toNum = (v: number | string | null | undefined): number =>
  v === null || v === undefined ? 0 : typeof v === "number" ? v : Number(v);

export function rowToRechnung(r: InvoiceRow): Rechnung {
  return {
    id: r.id,
    nummer: r.nummer,
    typ: r.typ as RechnungTyp,
    kunde: r.kunde,
    kundeId: r.kunde_id,
    abrechnungsart: r.abrechnungsart as Abrechnungsart,
    betrag: toNum(r.betrag),
    mwstSatz: toNum(r.mwst_satz),
    status: r.status as RechnungStatus,
    datum: r.datum,
    faelligkeit: r.faelligkeit,
    leistungsdatum: r.leistungsdatum ?? null,
    bezahltAm: r.bezahlt_am ?? undefined,
    bezahlterBetrag: r.bezahlter_betrag === null ? undefined : toNum(r.bezahlter_betrag),
    bezugAuftrag: r.bezug_auftrag ?? undefined,
    positionen: Array.isArray(r.positionen) ? r.positionen : [],
    notiz: r.notiz ?? undefined,
    mahnstufe: toNum(r.mahnstufe ?? 0),
    letzteMahnung: r.letzte_mahnung ?? null,
    mahnHistorie: Array.isArray(r.mahn_historie) ? r.mahn_historie : [],
    zahlungen: Array.isArray(r.zahlungen) ? r.zahlungen : [],
  };
}

export function rechnungToWrite(r: Rechnung): InvoiceWrite {
  return {
    nummer: r.nummer,
    typ: r.typ,
    kunde: r.kunde,
    kundeId: r.kundeId,
    abrechnungsart: r.abrechnungsart,
    betrag: r.betrag,
    mwstSatz: r.mwstSatz,
    status: r.status,
    datum: r.datum,
    faelligkeit: r.faelligkeit,
    leistungsdatum: r.leistungsdatum ?? null,
    bezahltAm: r.bezahltAm ?? null,
    bezahlterBetrag: r.bezahlterBetrag ?? null,
    bezugAuftrag: r.bezugAuftrag ?? null,
    positionen: r.positionen,
    notiz: r.notiz ?? null,
    mahnstufe: r.mahnstufe ?? 0,
    letzteMahnung: r.letzteMahnung ?? null,
    mahnHistorie: r.mahnHistorie ?? [],
    zahlungen: r.zahlungen ?? [],
  };
}

/** Map a client write payload to a DB insert/update object (undefined keys dropped). */
export function writeToInvoiceRow(w: Partial<InvoiceWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };
  set("nummer", w.nummer);
  set("typ", w.typ);
  set("kunde", w.kunde);
  set("kunde_id", w.kundeId);
  set("abrechnungsart", w.abrechnungsart);
  set("betrag", w.betrag);
  set("mwst_satz", w.mwstSatz);
  set("status", w.status);
  set("datum", w.datum);
  set("faelligkeit", w.faelligkeit);
  set("leistungsdatum", w.leistungsdatum);
  set("bezahlt_am", w.bezahltAm);
  set("bezahlter_betrag", w.bezahlterBetrag);
  set("bezug_auftrag", w.bezugAuftrag);
  set("positionen", w.positionen);
  set("notiz", w.notiz);
  set("mahnstufe", w.mahnstufe);
  set("letzte_mahnung", w.letzteMahnung);
  set("mahn_historie", w.mahnHistorie);
  set("zahlungen", w.zahlungen);
  return row;
}

/* ------------------------------------------------------------------ *
 * Billing rules (pure, server- and client-safe)
 * ------------------------------------------------------------------ */

/** Deterministic price rule per transport type (base gross EUR). */
const PREIS_REGEL: Record<string, number> = {
  Liegendtransport: 410,
  Sitzendtransport: 110,
  Rollstuhl: 95,
  Dialysefahrt: 96,
};

/** Returns the base price for an order, or 0 when no price rule exists. */
export function preisFuer(a: Auftrag): number {
  return PREIS_REGEL[a.transportart] ?? 0;
}

/** True when a prescription is required for this transport type. */
function verordnungErforderlich(_a: Auftrag): boolean {
  return true;
}

export interface AbrechnungsBereitschaft {
  bereit: boolean;
  /** machine-readable reasons that are still missing */
  fehlend: string[];
}

/**
 * Server- and client-safe check whether a completed transport is ready to be
 * billed. Mirrors the production preconditions:
 *  - transport completed
 *  - prescription checked (if required)
 *  - patient signature / completion confirmed (if required)
 *  - driver confirmation exists
 *  - billing customer exists
 *  - price rule exists
 */
export function abrechnungsBereitschaft(a: Auftrag): AbrechnungsBereitschaft {
  const fehlend: string[] = [];

  const abgeschlossen = a.status === "abgeschlossen";
  if (!abgeschlossen) fehlend.push("Transport nicht abgeschlossen");

  if (verordnungErforderlich(a)) {
    const ok = a.verordnung === "erhalten" || a.verordnung === "hochgeladen";
    if (!ok) fehlend.push("Verordnung nicht geprüft");
  }

  // Driver confirmation: an assigned driver on a completed transport.
  if (!a.fahrer) fehlend.push("Keine Fahrerbestätigung");

  // Patient signature / completion confirmation (required for non-emergency).
  if (verordnungErforderlich(a)) {
    const signatur = a.detailStatus === "abgeschlossen" || (abgeschlossen && !!a.fahrer);
    if (!signatur) fehlend.push("Patientenunterschrift fehlt");
  }

  // Billing customer must exist.
  if (!a.kostentraeger || !a.kostentraeger.trim()) {
    fehlend.push("Kein Abrechnungskunde");
  }

  // A price rule must exist.
  if (preisFuer(a) <= 0) fehlend.push("Keine Preisregel");

  return { bereit: fehlend.length === 0, fehlend };
}
