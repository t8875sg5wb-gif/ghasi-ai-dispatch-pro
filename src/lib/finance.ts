// ============================================================
// GHASI AI — Finance & Billing Engine
// ------------------------------------------------------------
// One enterprise finance layer for the whole platform. Builds on
// the existing operational data (drivers, vehicles, transports,
// customers) and adds invoices, credit notes, payments, a full
// cost breakdown, finance KPIs and AI-based anomaly detection.
//
// IMPORTANT: The AI never sends invoices automatically. It only
// detects issues and prepares drafts that wait for manual approval.
// The numeric seed is deterministic (SSR/hydration safe); only the
// time-relative helpers (overdue detection) read the current date.
// ============================================================
import { Receipt, FileMinus, type LucideIcon } from "lucide-react";

import { INITIAL_FAHRER } from "@/lib/fahrer";
import { INITIAL_FAHRZEUGE, reparaturkostenGesamt } from "@/lib/fahrzeuge";
import { INITIAL_AUFTRAEGE, type Auftrag } from "@/lib/auftraege";
import { KUNDEN } from "@/lib/stammdaten";

export const EUR = (n: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

export const EUR2 = (n: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);

const round = (n: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/* ------------------------------------------------------------------ *
 * Domain types
 * ------------------------------------------------------------------ */

export type RechnungStatus =
  | "entwurf"
  | "offen"
  | "bezahlt"
  | "teilbezahlt"
  | "ueberfaellig"
  | "storniert";

export type RechnungTyp = "rechnung" | "gutschrift";

export type Abrechnungsart = "Krankenkasse" | "Patient" | "Kunde";

export interface RechnungPosition {
  beschreibung: string;
  menge: number;
  einzelpreis: number;
}

export interface Rechnung {
  id: string;
  nummer: string;
  typ: RechnungTyp;
  kunde: string;
  kundeId: string;
  abrechnungsart: Abrechnungsart;
  /** gross amount in EUR (negative for credit notes) */
  betrag: number;
  /** VAT rate in percent */
  mwstSatz: number;
  status: RechnungStatus;
  /** ISO date issued */
  datum: string;
  /** ISO date due */
  faelligkeit: string;
  /** ISO date paid (when applicable) */
  bezahltAm?: string;
  bezahlterBetrag?: number;
  /** linked transport order number */
  bezugAuftrag?: string;
  positionen: RechnungPosition[];
  notiz?: string;
}

export interface RechnungStatusMeta {
  label: string;
  badge: string;
  dot: string;
}

export const RECHNUNG_STATUS_META: Record<RechnungStatus, RechnungStatusMeta> = {
  entwurf: {
    label: "Entwurf",
    badge: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  offen: { label: "Offen", badge: "border-info/30 bg-info/10 text-info", dot: "bg-info" },
  bezahlt: {
    label: "Bezahlt",
    badge: "border-success/30 bg-success/10 text-success",
    dot: "bg-success",
  },
  teilbezahlt: {
    label: "Teilbezahlt",
    badge: "border-accent/30 bg-accent/10 text-accent",
    dot: "bg-accent",
  },
  ueberfaellig: {
    label: "Überfällig",
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  storniert: {
    label: "Storniert",
    badge: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

export const RECHNUNG_STATI: RechnungStatus[] = [
  "entwurf",
  "offen",
  "teilbezahlt",
  "bezahlt",
  "ueberfaellig",
  "storniert",
];

export const TYP_META: Record<RechnungTyp, { label: string; icon: LucideIcon }> = {
  rechnung: { label: "Rechnung", icon: Receipt },
  gutschrift: { label: "Gutschrift", icon: FileMinus },
};

export function formatDatum(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Days a (non-paid) invoice is past its due date; ≤0 means not overdue. */
export function tageUeberfaellig(r: Rechnung): number {
  if (r.status === "bezahlt" || r.status === "storniert") return 0;
  const ms = Date.now() - new Date(r.faelligkeit).getTime();
  return Math.floor(ms / 86_400_000);
}

export function istUeberfaellig(r: Rechnung): boolean {
  return tageUeberfaellig(r) > 0;
}

/* ------------------------------------------------------------------ *
 * Seed data — deterministic invoices & credit notes
 * ------------------------------------------------------------------ */

const pos = (beschreibung: string, menge: number, einzelpreis: number): RechnungPosition => ({
  beschreibung,
  menge,
  einzelpreis,
});

/**
 * Demo invoices — used ONLY as one-time seed data for the `invoices` table
 * (see seedInvoices). Production reads come from the database via
 * `useInvoices()`, which mirrors persisted rows into `INITIAL_RECHNUNGEN`.
 */
export const SEED_RECHNUNGEN: Rechnung[] = [
  {
    id: "r-1",
    nummer: "RE-2026-0041",
    typ: "rechnung",
    kunde: "AOK Nordost",
    kundeId: "k-1",
    abrechnungsart: "Krankenkasse",
    betrag: 1240,
    mwstSatz: 7,
    status: "ueberfaellig",
    datum: "2026-05-02",
    faelligkeit: "2026-05-16",
    bezugAuftrag: "A-2041",
    positionen: [pos("Dialysefahrten Mai (12×)", 12, 96), pos("Wartezeitpauschale", 4, 22)],
    notiz: "Sammelrechnung Dialyse.",
  },
  {
    id: "r-2",
    nummer: "RE-2026-0042",
    typ: "rechnung",
    kunde: "Techniker Krankenkasse",
    kundeId: "k-2",
    abrechnungsart: "Krankenkasse",
    betrag: 860,
    mwstSatz: 7,
    status: "offen",
    datum: "2026-06-10",
    faelligkeit: "2026-06-24",
    bezugAuftrag: "A-2042",
    positionen: [
      pos("Liegendtransport Klinikum → Reha", 1, 410),
      pos("Sauerstoff-Zuschlag", 1, 45),
      pos("Begleitung", 1, 405),
    ],
  },
  {
    id: "r-3",
    nummer: "RE-2026-0043",
    typ: "rechnung",
    kunde: "Pflegeheim Sonnenhof",
    kundeId: "k-4",
    abrechnungsart: "Kunde",
    betrag: 2180,
    mwstSatz: 19,
    status: "ueberfaellig",
    datum: "2026-04-28",
    faelligkeit: "2026-05-12",
    positionen: [pos("Regelfahrten April", 22, 95), pos("Tragehilfe", 6, 15)],
    notiz: "2. Mahnstufe empfohlen.",
  },
  {
    id: "r-4",
    nummer: "RE-2026-0044",
    typ: "rechnung",
    kunde: "Barmer",
    kundeId: "k-5",
    abrechnungsart: "Krankenkasse",
    betrag: 540,
    mwstSatz: 7,
    status: "bezahlt",
    datum: "2026-05-30",
    faelligkeit: "2026-06-13",
    bezahltAm: "2026-06-08",
    bezahlterBetrag: 540,
    bezugAuftrag: "A-2043",
    positionen: [pos("Sitzendtransport Charlottenburg → Augenklinik", 1, 540)],
  },
  {
    id: "r-5",
    nummer: "RE-2026-0045",
    typ: "rechnung",
    kunde: "Klinikum West",
    kundeId: "k-3",
    abrechnungsart: "Kunde",
    betrag: 3260,
    mwstSatz: 19,
    status: "offen",
    datum: "2026-06-15",
    faelligkeit: "2026-06-29",
    positionen: [
      pos("Rahmenvertrag Krankentransporte Juni", 28, 110),
      pos("Bereitschaftspauschale", 1, 180),
    ],
  },
  {
    id: "r-6",
    nummer: "RE-2026-0046",
    typ: "rechnung",
    kunde: "DAK Gesundheit",
    kundeId: "k-2",
    abrechnungsart: "Krankenkasse",
    betrag: 320,
    mwstSatz: 7,
    status: "teilbezahlt",
    datum: "2026-06-01",
    faelligkeit: "2026-06-15",
    bezahlterBetrag: 160,
    bezugAuftrag: "A-2039",
    positionen: [pos("Rollstuhltransport Lindenhof → Praxis", 1, 320)],
    notiz: "Teilzahlung eingegangen, Differenz offen.",
  },
  {
    id: "r-7",
    nummer: "RE-2026-0047",
    typ: "rechnung",
    kunde: "Selbstzahler A. Klein",
    kundeId: "k-3",
    abrechnungsart: "Patient",
    betrag: 410,
    mwstSatz: 19,
    status: "offen",
    datum: "2026-06-20",
    faelligkeit: "2026-07-04",
    bezugAuftrag: "A-2044",
    positionen: [pos("Notfalltransport Neukölln → Klinikum West", 1, 410)],
  },
  {
    id: "r-8",
    nummer: "RE-2026-0040",
    typ: "rechnung",
    kunde: "AOK Nordost",
    kundeId: "k-1",
    abrechnungsart: "Krankenkasse",
    betrag: 1240,
    mwstSatz: 7,
    status: "offen",
    datum: "2026-05-02",
    faelligkeit: "2026-05-16",
    bezugAuftrag: "A-2041",
    positionen: [pos("Dialysefahrten Mai (12×)", 12, 96), pos("Wartezeitpauschale", 4, 22)],
    notiz: "Möglicher Doppeleintrag zu RE-2026-0041 – prüfen.",
  },
  {
    id: "r-9",
    nummer: "GU-2026-0007",
    typ: "gutschrift",
    kunde: "Pflegeheim Sonnenhof",
    kundeId: "k-4",
    abrechnungsart: "Kunde",
    betrag: -180,
    mwstSatz: 19,
    status: "bezahlt",
    datum: "2026-05-20",
    faelligkeit: "2026-05-20",
    bezahltAm: "2026-05-20",
    bezahlterBetrag: -180,
    positionen: [pos("Storno doppelt berechnete Fahrt", 1, -180)],
  },
  {
    id: "r-10",
    nummer: "RE-2026-0038",
    typ: "rechnung",
    kunde: "Techniker Krankenkasse",
    kundeId: "k-2",
    abrechnungsart: "Krankenkasse",
    betrag: 980,
    mwstSatz: 7,
    status: "bezahlt",
    datum: "2026-04-12",
    faelligkeit: "2026-04-26",
    bezahltAm: "2026-04-22",
    bezahlterBetrag: 980,
    positionen: [pos("Sitzendtransporte April", 10, 98)],
  },
];

let idCounter = 100;
export function nextRechnungId(): string {
  idCounter += 1;
  return `r-${idCounter}`;
}

export function netto(r: Rechnung): number {
  return round(r.betrag / (1 + r.mwstSatz / 100), 2);
}

export function mwstBetrag(r: Rechnung): number {
  return round(r.betrag - netto(r), 2);
}

/* ------------------------------------------------------------------ *
 * Cost breakdown (derived from the live fleet & driver data)
 * ------------------------------------------------------------------ */

export interface Kostenaufstellung {
  fahrzeugkosten: number;
  kraftstoffkosten: number;
  wartungskosten: number;
  fahrerkosten: number;
  leasingkosten: number;
  gesamt: number;
}

const DIESELPREIS = 1.75; // €/l, deterministic assumption for fuel cost estimate
const ARBEITSTAGE_MONAT = 21;

export function computeKostenaufstellung(): Kostenaufstellung {
  // Fuel: monthly distance estimate × consumption × price (non-electric only).
  const kmMonat = INITIAL_FAHRER.reduce((s, f) => s + f.kmHeute, 0) * ARBEITSTAGE_MONAT;
  const avgVerbrauch =
    INITIAL_FAHRZEUGE.filter((v) => v.kraftstoff !== "Elektro").reduce(
      (s, v) => s + v.verbrauch,
      0,
    ) / Math.max(1, INITIAL_FAHRZEUGE.filter((v) => v.kraftstoff !== "Elektro").length);
  const kraftstoffkosten = round((kmMonat / 100) * avgVerbrauch * DIESELPREIS);

  // Maintenance: accumulated repairs across the fleet.
  const wartungskosten = INITIAL_FAHRZEUGE.reduce((s, v) => s + reparaturkostenGesamt(v), 0);

  // Leasing: sum of monthly leasing rates.
  const leasingkosten = INITIAL_FAHRZEUGE.reduce((s, v) => s + v.leasingrate, 0);

  // Vehicle running cost (per-km cost × monthly distance), excl. fuel/leasing.
  const fahrzeugkosten = round(
    (INITIAL_FAHRZEUGE.reduce((s, v) => s + v.kostenProKm, 0) / INITIAL_FAHRZEUGE.length) *
      kmMonat *
      0.4,
  );

  // Driver cost: profit-vs-revenue gap as a proxy for personnel + overheads.
  const fahrerkosten = round(
    INITIAL_FAHRER.reduce((s, f) => s + (f.umsatzHeute - f.gewinnHeute), 0) *
      ARBEITSTAGE_MONAT *
      0.55,
  );

  const gesamt = fahrzeugkosten + kraftstoffkosten + wartungskosten + fahrerkosten + leasingkosten;
  return { fahrzeugkosten, kraftstoffkosten, wartungskosten, fahrerkosten, leasingkosten, gesamt };
}

/* ------------------------------------------------------------------ *
 * Finance KPIs
 * ------------------------------------------------------------------ */

export interface FinanzKpis {
  umsatzMonat: number;
  gewinnMonat: number;
  ausgabenMonat: number;
  margeProzent: number;
  offenePosten: number;
  ueberfaelligeSumme: number;
  bezahltSumme: number;
  gutschriftenSumme: number;
  anzahlOffen: number;
  anzahlUeberfaellig: number;
  anzahlBezahlt: number;
  kosten: Kostenaufstellung;
}

export function computeFinanzKpis(rechnungen: Rechnung[] = INITIAL_RECHNUNGEN): FinanzKpis {
  const aktiv = rechnungen.filter((r) => r.status !== "storniert");

  const offen = aktiv.filter(
    (r) => r.status === "offen" || r.status === "teilbezahlt" || r.status === "ueberfaellig",
  );
  const bezahlt = aktiv.filter((r) => r.status === "bezahlt");
  const ueberfaellig = aktiv.filter((r) => istUeberfaellig(r) || r.status === "ueberfaellig");
  const gutschriften = aktiv.filter((r) => r.typ === "gutschrift");

  const offenePosten = offen.reduce((s, r) => s + (r.betrag - (r.bezahlterBetrag ?? 0)), 0);
  const ueberfaelligeSumme = ueberfaellig.reduce(
    (s, r) => s + (r.betrag - (r.bezahlterBetrag ?? 0)),
    0,
  );
  const bezahltSumme = bezahlt.reduce((s, r) => s + (r.bezahlterBetrag ?? r.betrag), 0);
  const gutschriftenSumme = gutschriften.reduce((s, r) => s + Math.abs(r.betrag), 0);

  const kosten = computeKostenaufstellung();
  const umsatzMonat = INITIAL_FAHRZEUGE.reduce((s, v) => s + v.monatsumsatz, 0);
  const gewinnMonat = INITIAL_FAHRZEUGE.reduce((s, v) => s + v.monatsgewinn, 0);
  const ausgabenMonat = kosten.gesamt;
  const margeProzent = umsatzMonat > 0 ? round((gewinnMonat / umsatzMonat) * 100) : 0;

  return {
    umsatzMonat,
    gewinnMonat,
    ausgabenMonat,
    margeProzent,
    offenePosten: round(offenePosten),
    ueberfaelligeSumme: round(ueberfaelligeSumme),
    bezahltSumme: round(bezahltSumme),
    gutschriftenSumme: round(gutschriftenSumme),
    anzahlOffen: offen.length,
    anzahlUeberfaellig: ueberfaellig.length,
    anzahlBezahlt: bezahlt.length,
    kosten,
  };
}

/** Open-items aging per customer for cash-flow management. */
export interface OffenerPosten {
  kunde: string;
  kundeId: string;
  betrag: number;
  anzahl: number;
  maxTageUeberfaellig: number;
}

export function offenePostenJeKunde(rechnungen: Rechnung[] = INITIAL_RECHNUNGEN): OffenerPosten[] {
  const map = new Map<string, OffenerPosten>();
  for (const r of rechnungen) {
    if (r.status === "bezahlt" || r.status === "storniert" || r.typ === "gutschrift") continue;
    const rest = r.betrag - (r.bezahlterBetrag ?? 0);
    if (rest <= 0) continue;
    const cur = map.get(r.kundeId) ?? {
      kunde: r.kunde,
      kundeId: r.kundeId,
      betrag: 0,
      anzahl: 0,
      maxTageUeberfaellig: 0,
    };
    cur.betrag += rest;
    cur.anzahl += 1;
    cur.maxTageUeberfaellig = Math.max(cur.maxTageUeberfaellig, tageUeberfaellig(r));
    map.set(r.kundeId, cur);
  }
  return [...map.values()].sort((a, b) => b.betrag - a.betrag);
}

/* ------------------------------------------------------------------ *
 * AI anomaly detection — never auto-sends, only prepares findings
 * ------------------------------------------------------------------ */

export type AnomalieTyp =
  | "ueberfaellig"
  | "fehlend"
  | "duplikat"
  | "unbezahlter_transport"
  | "inkonsistenz";

export type AnomalieSchwere = "hoch" | "mittel" | "niedrig";

export interface FinanzAnomalie {
  id: string;
  typ: AnomalieTyp;
  titel: string;
  /** WHY this was flagged */
  grund: string;
  /** where the evidence comes from */
  quelle: string;
  /** business impact */
  wirkung: string;
  /** 0–100 model confidence */
  konfidenz: number;
  schwere: AnomalieSchwere;
  /** prepared (non-executing) suggested action */
  empfehlung: string;
  to: string;
}

export const ANOMALIE_META: Record<AnomalieTyp, { label: string; badge: string }> = {
  ueberfaellig: {
    label: "Überfällig",
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  fehlend: { label: "Fehlende Rechnung", badge: "border-warning/30 bg-warning/10 text-warning" },
  duplikat: { label: "Mögliches Duplikat", badge: "border-accent/30 bg-accent/10 text-accent" },
  unbezahlter_transport: {
    label: "Unbezahlter Transport",
    badge: "border-warning/30 bg-warning/10 text-warning",
  },
  inkonsistenz: { label: "Inkonsistenz", badge: "border-info/30 bg-info/10 text-info" },
};

export function detectFinanzAnomalien(
  rechnungen: Rechnung[] = INITIAL_RECHNUNGEN,
  auftraege: Auftrag[] = INITIAL_AUFTRAEGE,
): FinanzAnomalie[] {
  const out: FinanzAnomalie[] = [];

  // 1) Overdue invoices.
  for (const r of rechnungen) {
    const tage = tageUeberfaellig(r);
    if (tage > 0 && r.typ === "rechnung") {
      out.push({
        id: `anom-ueberfaellig-${r.id}`,
        typ: "ueberfaellig",
        titel: `${r.nummer} ist ${tage} Tage überfällig`,
        grund: `Fälligkeit ${formatDatum(r.faelligkeit)} überschritten, offen ${EUR(r.betrag - (r.bezahlterBetrag ?? 0))}.`,
        quelle: `Buchhaltung · ${r.kunde}`,
        wirkung: `Gebundene Liquidität ${EUR(r.betrag - (r.bezahlterBetrag ?? 0))}.`,
        konfidenz: 98,
        schwere: tage > 21 ? "hoch" : "mittel",
        empfehlung: "Mahnungs-Entwurf vorbereiten (Versand nur nach Freigabe).",
        to: "/rechnungen",
      });
    }
  }

  // 2) Possible duplicates: same customer + same gross amount + ≤7 days apart.
  for (let i = 0; i < rechnungen.length; i++) {
    for (let j = i + 1; j < rechnungen.length; j++) {
      const a = rechnungen[i];
      const b = rechnungen[j];
      if (a.typ !== "rechnung" || b.typ !== "rechnung") continue;
      if (a.kundeId !== b.kundeId || a.betrag !== b.betrag) continue;
      const diff = Math.abs(new Date(a.datum).getTime() - new Date(b.datum).getTime()) / 86_400_000;
      if (diff <= 7) {
        out.push({
          id: `anom-duplikat-${a.id}-${b.id}`,
          typ: "duplikat",
          titel: `Mögliches Duplikat: ${a.nummer} ↔ ${b.nummer}`,
          grund: `Gleicher Kunde (${a.kunde}), gleicher Betrag (${EUR(a.betrag)}), ${Math.round(diff)} Tage Abstand.`,
          quelle: "Buchhaltung · Dublettenprüfung",
          wirkung: `Doppelberechnung von ${EUR(a.betrag)} möglich.`,
          konfidenz: 76,
          schwere: "mittel",
          empfehlung: "Beide Rechnungen vergleichen und ggf. eine stornieren.",
          to: "/rechnungen",
        });
      }
    }
  }

  // 3) Missing invoices: completed transports without a linked invoice.
  const berechneteAuftraege = new Set(rechnungen.map((r) => r.bezugAuftrag).filter(Boolean));
  for (const a of auftraege) {
    if (a.status === "abgeschlossen" && !berechneteAuftraege.has(a.nummer)) {
      out.push({
        id: `anom-fehlend-${a.id}`,
        typ: "fehlend",
        titel: `Keine Rechnung zu ${a.nummer}`,
        grund: `Transport (${a.transportart}) ist abgeschlossen, aber es existiert keine verknüpfte Rechnung.`,
        quelle: `Dispatch · ${a.patient}`,
        wirkung: "Entgangener Umsatz, wenn nicht abgerechnet.",
        konfidenz: 88,
        schwere: "hoch",
        empfehlung: "Rechnungs-Entwurf aus dem Auftrag erstellen.",
        to: "/rechnungen",
      });
    }
  }

  // 4) Unpaid transports: open invoices linked to an in-progress/late transport.
  for (const r of rechnungen) {
    if ((r.status === "offen" || r.status === "teilbezahlt") && r.bezugAuftrag) {
      const a = auftraege.find((x) => x.nummer === r.bezugAuftrag);
      if (a && (a.status === "unterwegs" || a.status === "disponiert")) {
        out.push({
          id: `anom-unbezahlt-${r.id}`,
          typ: "unbezahlter_transport",
          titel: `Transport ${a.nummer} noch nicht beglichen`,
          grund: `Rechnung ${r.nummer} ist ${RECHNUNG_STATUS_META[r.status].label.toLowerCase()}, Transport ist ${a.status}.`,
          quelle: `Buchhaltung ↔ Dispatch`,
          wirkung: `Offener Betrag ${EUR(r.betrag - (r.bezahlterBetrag ?? 0))}.`,
          konfidenz: 70,
          schwere: "niedrig",
          empfehlung: "Zahlungsstatus nach Abschluss der Fahrt prüfen.",
          to: "/rechnungen",
        });
      }
    }
  }

  // 5) Inconsistencies: explicit duplicate note marker.
  for (const r of rechnungen) {
    if (r.notiz && /doppel/i.test(r.notiz)) {
      out.push({
        id: `anom-inkonsistenz-${r.id}`,
        typ: "inkonsistenz",
        titel: `Hinweis auf Inkonsistenz bei ${r.nummer}`,
        grund: r.notiz,
        quelle: "Buchhaltung · Notizen",
        wirkung: "Manuelle Klärung erforderlich.",
        konfidenz: 64,
        schwere: "niedrig",
        empfehlung: "Beleg manuell prüfen und korrigieren.",
        to: "/rechnungen",
      });
    }
  }

  const rang: Record<AnomalieSchwere, number> = { hoch: 0, mittel: 1, niedrig: 2 };
  // De-duplicate by id (overdue + inconsistency can overlap) and sort by severity.
  const seen = new Set<string>();
  return out
    .filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)))
    .sort((a, b) => rang[a.schwere] - rang[b.schwere]);
}

/** Open invoices per customer for the AI knowledge snapshot. */
export function offeneRechnungenGesamt(rechnungen: Rechnung[] = INITIAL_RECHNUNGEN): number {
  return rechnungen.filter(
    (r) => r.status === "offen" || r.status === "teilbezahlt" || r.status === "ueberfaellig",
  ).length;
}

/** Lightweight enriched accessor for the customer module. */
export function rechnungenJeKunde(
  kundeId: string,
  rechnungen: Rechnung[] = INITIAL_RECHNUNGEN,
): Rechnung[] {
  return rechnungen.filter((r) => r.kundeId === kundeId);
}

/** Re-export for convenience in finance UIs. */
export { KUNDEN };
