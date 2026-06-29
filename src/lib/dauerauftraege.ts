// ============================================================
// GHASI AI – Daueraufträge / Recurring Orders
// Echte wiederkehrende Transportaufträge, die automatisch reale
// Transporte (Auftrag) in den bestehenden Betrieb erzeugen.
//
// Unterstützt: tägliche & wöchentliche Wiederholung, mehrere Wochentage,
// Dialyse-/Pflegeheim-/Krankenhaus-Serien, Start-/Enddatum, Pausenzeitraum,
// Feiertagsbehandlung, Patientenstornierung, manuelles Überspringen und
// automatische Generierung künftiger Tage.
//
// Generierte Transporte landen in INITIAL_AUFTRAEGE und erscheinen damit in
// Aufträgen, Dispatch-Center, Fahrer-App, Live-GPS, Abrechnung & AI Brain.
// Deterministisch & client-safe (keine Zufallsdaten).
// ============================================================
import {
  CalendarDays,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  PauseCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import {
  type Auftrag,
  type Mobilitaet,
  type Transportart,
  type VerordnungStatus,
  INITIAL_AUFTRAEGE,
  nextAuftragId,
} from "@/lib/auftraege";
import { type AdresseStruktur, formatAdresse } from "@/lib/address";

/* ------------------------------------------------------------------ *
 * Typen
 * ------------------------------------------------------------------ */

export type Rhythmus = "taeglich" | "woechentlich";

export type SerienKategorie = "dialyse" | "pflegeheim" | "krankenhaus" | "sonstige";

export type DauerauftragStatus = "aktiv" | "pausiert" | "beendet";

export interface Dauerauftrag {
  id: string;
  /** Sprechende Kennung der Serie, z. B. "DA-001". */
  kennung: string;
  patient: string;
  /** Strukturierte Abholadresse; legacy `abholort` bleibt als rückwärtskompatible Anzeige erhalten. */
  pickup?: AdresseStruktur;
  /** Strukturierte Zieladresse; legacy `zielort` bleibt als rückwärtskompatible Anzeige erhalten. */
  destination?: AdresseStruktur;
  abholort: string;
  zielort: string;
  /** Uhrzeit der Hinfahrt im Format HH:MM. */
  terminzeit: string;
  /** Rückfahrt automatisch mit anlegen? */
  rueckfahrt: boolean;
  /** Uhrzeit der Rückfahrt (HH:MM), falls rueckfahrt = true. */
  rueckfahrtzeit?: string;
  mobilitaet: Mobilitaet;
  begleitperson: boolean;
  /** Ist eine ärztliche Verordnung erforderlich? */
  verordnungErforderlich: boolean;
  /** Abrechnungskunde / Auftraggeber. */
  kostentraeger: string;
  /** Krankenkasse / Kostenträger der Leistung. */
  krankenkasse: string;
  bevorzugtesFahrzeug: string | null;
  bevorzugterFahrer: string | null;
  notiz: string;
  medizinischeNotiz: string;
  kategorie: SerienKategorie;

  // --- Wiederholungsregel ---
  rhythmus: Rhythmus;
  /** Wochentage (0 = Sonntag … 6 = Samstag) bei wöchentlicher Wiederholung. */
  wochentage: number[];
  startDatum: string; // ISO YYYY-MM-DD
  endDatum: string | null;

  // --- Steuerung ---
  /** Manuell pausiert (z. B. Patient im Urlaub). */
  pausiert: boolean;
  /** Optionaler Pausenzeitraum (inklusive). */
  pauseVon: string | null;
  pauseBis: string | null;
  /** An gesetzlichen Feiertagen keine Transporte erzeugen. */
  feiertageUeberspringen: boolean;
  /** Einzelne übersprungene Termine (manueller Skip / Patientenabsage). */
  uebersprungeneTermine: string[];
  /** Bereits in reale Transporte umgewandelte Termine (verhindert Duplikate). */
  generierteTermine: string[];

  erstellt: string; // ISO datetime
}

/* ------------------------------------------------------------------ *
 * Meta
 * ------------------------------------------------------------------ */

export const RHYTHMUS_LABEL: Record<Rhythmus, string> = {
  taeglich: "Täglich",
  woechentlich: "Wöchentlich",
};

export const KATEGORIE_META: Record<
  SerienKategorie,
  { label: string; badge: string; icon: LucideIcon }
> = {
  dialyse: {
    label: "Dialyse",
    badge: "border-info/30 bg-info/10 text-info",
    icon: CalendarClock,
  },
  pflegeheim: {
    label: "Pflegeheim",
    badge: "border-accent/30 bg-accent/10 text-accent",
    icon: CalendarRange,
  },
  krankenhaus: {
    label: "Krankenhaus",
    badge: "border-primary/30 bg-primary/10 text-primary",
    icon: CalendarDays,
  },
  sonstige: {
    label: "Sonstige",
    badge: "border-border bg-muted text-muted-foreground",
    icon: CalendarDays,
  },
};

export const STATUS_META: Record<
  DauerauftragStatus,
  { label: string; badge: string; icon: LucideIcon }
> = {
  aktiv: {
    label: "Aktiv",
    badge: "border-success/30 bg-success/10 text-success",
    icon: CheckCircle2,
  },
  pausiert: {
    label: "Pausiert",
    badge: "border-warning/30 bg-warning/10 text-warning",
    icon: PauseCircle,
  },
  beendet: {
    label: "Beendet",
    badge: "border-border bg-muted text-muted-foreground",
    icon: XCircle,
  },
};

export const WOCHENTAGE: { wert: number; kurz: string; label: string }[] = [
  { wert: 1, kurz: "Mo", label: "Montag" },
  { wert: 2, kurz: "Di", label: "Dienstag" },
  { wert: 3, kurz: "Mi", label: "Mittwoch" },
  { wert: 4, kurz: "Do", label: "Donnerstag" },
  { wert: 5, kurz: "Fr", label: "Freitag" },
  { wert: 6, kurz: "Sa", label: "Samstag" },
  { wert: 0, kurz: "So", label: "Sonntag" },
];

export const KATEGORIEN: SerienKategorie[] = ["dialyse", "pflegeheim", "krankenhaus", "sonstige"];

export const RHYTHMEN: Rhythmus[] = ["taeglich", "woechentlich"];

/* ------------------------------------------------------------------ *
 * Datums-Helfer (lokale Kalenderlogik, deterministisch)
 * ------------------------------------------------------------------ */

export const heuteISO = () => new Date().toISOString().slice(0, 10);

export function isoPlusTage(iso: string, tage: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + tage);
  return d.toISOString().slice(0, 10);
}

export function wochentagVon(iso: string): number {
  return new Date(iso + "T00:00:00").getDay();
}

export function formatDatumDe(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Gauß'sche Osterformel → Ostersonntag des Jahres als ISO-Datum. */
function ostersonntag(jahr: number): string {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
}

/** Gesetzliche Feiertage (bundesweit) für ein Jahr. */
function feiertageImJahr(jahr: number): Set<string> {
  const fest = [
    `${jahr}-01-01`, // Neujahr
    `${jahr}-05-01`, // Tag der Arbeit
    `${jahr}-10-03`, // Tag der Deutschen Einheit
    `${jahr}-12-25`, // 1. Weihnachtstag
    `${jahr}-12-26`, // 2. Weihnachtstag
  ];
  const ostern = ostersonntag(jahr);
  const beweglich = [
    isoPlusTage(ostern, -2), // Karfreitag
    isoPlusTage(ostern, 1), // Ostermontag
    isoPlusTage(ostern, 39), // Christi Himmelfahrt
    isoPlusTage(ostern, 50), // Pfingstmontag
  ];
  return new Set([...fest, ...beweglich]);
}

const feiertagCache = new Map<number, Set<string>>();

export function istFeiertag(iso: string): boolean {
  const jahr = Number(iso.slice(0, 4));
  if (!feiertagCache.has(jahr)) feiertagCache.set(jahr, feiertageImJahr(jahr));
  return feiertagCache.get(jahr)!.has(iso);
}

/* ------------------------------------------------------------------ *
 * Statuslogik
 * ------------------------------------------------------------------ */

export function abgeleiteterStatus(d: Dauerauftrag, stichtag = heuteISO()): DauerauftragStatus {
  if (d.endDatum && d.endDatum < stichtag) return "beendet";
  if (d.pausiert) return "pausiert";
  if (d.pauseVon && d.pauseBis && stichtag >= d.pauseVon && stichtag <= d.pauseBis)
    return "pausiert";
  return "aktiv";
}

/** Fällt an diesem Datum laut Regel ein Transport an (vor Skip/Pause/Feiertag)? */
export function regelTrifftZu(d: Dauerauftrag, iso: string): boolean {
  if (iso < d.startDatum) return false;
  if (d.endDatum && iso > d.endDatum) return false;
  if (d.rhythmus === "taeglich") return true;
  return d.wochentage.includes(wochentagVon(iso));
}

/** Innerhalb eines Pausenzeitraums? */
function inPause(d: Dauerauftrag, iso: string): boolean {
  if (d.pauseVon && d.pauseBis) return iso >= d.pauseVon && iso <= d.pauseBis;
  return false;
}

/** Wird an diesem Datum tatsächlich ein Transport erzeugt? */
export function transportFaelltAn(d: Dauerauftrag, iso: string): boolean {
  if (d.pausiert) return false;
  if (!regelTrifftZu(d, iso)) return false;
  if (inPause(d, iso)) return false;
  if (d.uebersprungeneTermine.includes(iso)) return false;
  if (d.feiertageUeberspringen && istFeiertag(iso)) return false;
  return true;
}

/** Die nächsten faelligen Termine ab einem Datum (max. anzahl). */
export function naechsteTermine(d: Dauerauftrag, anzahl = 5, abISO = heuteISO()): string[] {
  const treffer: string[] = [];
  let cursor = abISO < d.startDatum ? d.startDatum : abISO;
  const grenze = d.endDatum ?? isoPlusTage(cursor, 365);
  let sicherung = 0;
  while (cursor <= grenze && treffer.length < anzahl && sicherung < 800) {
    if (transportFaelltAn(d, cursor)) treffer.push(cursor);
    cursor = isoPlusTage(cursor, 1);
    sicherung += 1;
  }
  return treffer;
}

/* ------------------------------------------------------------------ *
 * Ableitungen für Transport-Erzeugung
 * ------------------------------------------------------------------ */

function transportartVon(d: Dauerauftrag): Transportart {
  if (d.kategorie === "dialyse") return "Dialysefahrt";
  switch (d.mobilitaet) {
    case "liegend":
      return "Liegendtransport";
    case "rollstuhl":
    case "tragestuhl":
      return "Rollstuhl";
    default:
      return "Sitzendtransport";
  }
}

function verordnungVon(d: Dauerauftrag): VerordnungStatus {
  // Dialyse-/Dauerverordnungen liegen i. d. R. vor; sonst "nicht erhalten".
  if (!d.verordnungErforderlich) return "erhalten";
  return d.kategorie === "dialyse" ? "erhalten" : "nicht_erhalten";
}

let nummernZaehler = 5000;
function naechsteNummer(): string {
  nummernZaehler += 1;
  return `A-${nummernZaehler}`;
}

function baueAuftrag(d: Dauerauftrag, iso: string, richtung: "hin" | "rueck"): Auftrag {
  const hin = richtung === "hin";
  const pickup = hin ? d.pickup : d.destination;
  const destination = hin ? d.destination : d.pickup;
  return {
    id: nextAuftragId(),
    nummer: naechsteNummer(),
    patient: d.patient,
    transportart: transportartVon(d),
    prioritaet: "normal",
    status: "neu",
    pickup,
    destination,
    abholort: pickup ? formatAdresse(pickup) : hin ? d.abholort : d.zielort,
    zielort: destination ? formatAdresse(destination) : hin ? d.zielort : d.abholort,
    termin: `${iso}T${hin ? d.terminzeit : d.rueckfahrtzeit || d.terminzeit}`,
    fahrer: d.bevorzugterFahrer,
    fahrzeug: d.bevorzugtesFahrzeug,
    kostentraeger: d.kostentraeger,
    notiz: `${hin ? "Hinfahrt" : "Rückfahrt"} aus Dauerauftrag ${d.kennung}${
      d.notiz ? " · " + d.notiz : ""
    }`,
    verordnung: verordnungVon(d),
    verordnungDokumentId: null,
    mobilitaet: d.mobilitaet,
    begleitperson: d.begleitperson,
    abholanforderung: "",
    zielanforderung: "",
    patientennotiz: "",
    medizinischeNotiz: d.medizinischeNotiz,
  };
}

/**
 * Generiert reale Transporte aus einem Dauerauftrag für den Zeitraum [vonISO, bisISO].
 * Schreibt die erzeugten Transporte in INITIAL_AUFTRAEGE und merkt sich die Termine,
 * sodass dieselbe Serie denselben Tag nicht doppelt erzeugt.
 * Gibt die neu erzeugten Transporte zurück (mutiert d.generierteTermine).
 */
export function generiereTransporte(d: Dauerauftrag, vonISO: string, bisISO: string): Auftrag[] {
  const neu: Auftrag[] = [];
  let cursor = vonISO < d.startDatum ? d.startDatum : vonISO;
  let sicherung = 0;
  while (cursor <= bisISO && sicherung < 800) {
    if (transportFaelltAn(d, cursor) && !d.generierteTermine.includes(cursor)) {
      neu.push(baueAuftrag(d, cursor, "hin"));
      if (d.rueckfahrt) neu.push(baueAuftrag(d, cursor, "rueck"));
      d.generierteTermine.push(cursor);
    }
    cursor = isoPlusTage(cursor, 1);
    sicherung += 1;
  }
  if (neu.length) INITIAL_AUFTRAEGE.push(...neu);
  return neu;
}

/** Zählt, wie viele Termine im Zeitraum erzeugt WÜRDEN (Vorschau). */
export function offeneTermineImZeitraum(d: Dauerauftrag, vonISO: string, bisISO: string): string[] {
  const treffer: string[] = [];
  let cursor = vonISO < d.startDatum ? d.startDatum : vonISO;
  let sicherung = 0;
  while (cursor <= bisISO && sicherung < 800) {
    if (transportFaelltAn(d, cursor) && !d.generierteTermine.includes(cursor)) {
      treffer.push(cursor);
    }
    cursor = isoPlusTage(cursor, 1);
    sicherung += 1;
  }
  return treffer;
}

/* ------------------------------------------------------------------ *
 * Persistente Transport-Erzeugung (DB-tauglich, client-safe)
 * ------------------------------------------------------------------ */

/**
 * Baut OrderWrite-Payloads für alle im Zeitraum [vonISO, bisISO] noch nicht
 * generierten Termine einer Serie. Mutiert NICHTS – gibt die neuen Termine und
 * die zugehörigen Schreib-Payloads zurück, damit der Aufrufer sie persistieren
 * kann (Aufträge-Tabelle) und anschließend generierteTermine fortschreiben.
 */
export function transportWritesFuer(
  d: Dauerauftrag,
  vonISO: string,
  bisISO: string,
): { neueTermine: string[]; writes: import("@/lib/orders-shared").OrderWrite[] } {
  const neueTermine: string[] = [];
  const writes: import("@/lib/orders-shared").OrderWrite[] = [];
  let cursor = vonISO < d.startDatum ? d.startDatum : vonISO;
  let sicherung = 0;
  const bauen = (iso: string, richtung: "hin" | "rueck") => {
    const hin = richtung === "hin";
    const pickup = hin ? d.pickup : d.destination;
    const destination = hin ? d.destination : d.pickup;
    const w: import("@/lib/orders-shared").OrderWrite = {
      patient: d.patient,
      transportart: transportartVon(d),
      prioritaet: "normal",
      status: "neu",
      pickup,
      destination,
      abholort: pickup ? "" : hin ? d.abholort : d.zielort,
      zielort: destination ? "" : hin ? d.zielort : d.abholort,
      termin: `${iso}T${hin ? d.terminzeit : d.rueckfahrtzeit || d.terminzeit}`,
      fahrer: d.bevorzugterFahrer,
      fahrzeug: d.bevorzugtesFahrzeug,
      kostentraeger: d.kostentraeger,
      notiz: `${hin ? "Hinfahrt" : "Rückfahrt"} aus Dauerauftrag ${d.kennung}${
        d.notiz ? " · " + d.notiz : ""
      }`,
      verordnung: verordnungVon(d),
      verordnungDokumentId: null,
      mobilitaet: d.mobilitaet,
      begleitperson: d.begleitperson,
      abholanforderung: "",
      zielanforderung: "",
      patientennotiz: "",
      medizinischeNotiz: d.medizinischeNotiz,
      dauerauftragId: d.id,
    };
    writes.push(w);
  };
  while (cursor <= bisISO && sicherung < 800) {
    if (transportFaelltAn(d, cursor) && !d.generierteTermine.includes(cursor)) {
      neueTermine.push(cursor);
      bauen(cursor, "hin");
      if (d.rueckfahrt) bauen(cursor, "rueck");
    }
    cursor = isoPlusTage(cursor, 1);
    sicherung += 1;
  }
  return { neueTermine, writes };
}

export function nextDauerId(vorhandene: Dauerauftrag[]): string {
  let max = 0;
  for (const x of vorhandene) {
    const n = Number(x.id.replace("da-", ""));
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `da-${max + 1}`;
}

export function naechsteKennung(vorhandene: Dauerauftrag[]): string {
  let max = 0;
  for (const x of vorhandene) {
    const n = Number(x.kennung.replace("DA-", ""));
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `DA-${String(max + 1).padStart(3, "0")}`;
}

/* ------------------------------------------------------------------ *
 * Seed: reale wiederkehrende Serien des Betriebs (Konfigurationsdaten)
 * ------------------------------------------------------------------ */

// Live in-memory array (mirrors the persisted recurring_orders via the store).
// Modules that read recurring series synchronously (AI tools, dispatch) use this.
export const DAUERAUFTRAEGE: Dauerauftrag[] = [
  {
    id: "da-1",
    kennung: "DA-001",
    patient: "Margarete Hoffmann",
    abholort: "Pflegeheim Sonnenhof, Berlin",
    zielort: "Dialysezentrum Nord, Berlin",
    terminzeit: "06:30",
    rueckfahrt: true,
    rueckfahrtzeit: "11:30",
    mobilitaet: "rollstuhl",
    begleitperson: false,
    verordnungErforderlich: true,
    kostentraeger: "Pflegeheim Sonnenhof",
    krankenkasse: "AOK Nordost",
    bevorzugtesFahrzeug: "B-KT 204",
    bevorzugterFahrer: "P. Richter",
    notiz: "Dialyse-Sammeltour Schicht 1",
    medizinischeNotiz: "Fistel rechter Arm – Arm schonen. Diabetikerin.",
    kategorie: "dialyse",
    rhythmus: "woechentlich",
    wochentage: [1, 3, 5],
    startDatum: "2026-01-06",
    endDatum: null,
    pausiert: false,
    pauseVon: null,
    pauseBis: null,
    feiertageUeberspringen: true,
    uebersprungeneTermine: [],
    generierteTermine: [],
    erstellt: "2026-01-02T09:00",
  },
  {
    id: "da-2",
    kennung: "DA-002",
    patient: "Johann Bauer",
    abholort: "Privatadresse Charlottenburg",
    zielort: "Dialysezentrum Süd, Berlin",
    terminzeit: "07:00",
    rueckfahrt: true,
    rueckfahrtzeit: "12:00",
    mobilitaet: "liegend",
    begleitperson: true,
    verordnungErforderlich: true,
    kostentraeger: "Techniker Krankenkasse",
    krankenkasse: "Techniker Krankenkasse",
    bevorzugtesFahrzeug: "B-KT 142",
    bevorzugterFahrer: "M. Keller",
    notiz: "Liegendtransport Dialyse",
    medizinischeNotiz: "Sauerstoff 2 l/min während der Fahrt.",
    kategorie: "dialyse",
    rhythmus: "woechentlich",
    wochentage: [2, 4, 6],
    startDatum: "2026-02-03",
    endDatum: null,
    pausiert: false,
    pauseVon: null,
    pauseBis: null,
    feiertageUeberspringen: true,
    uebersprungeneTermine: [],
    generierteTermine: [],
    erstellt: "2026-01-28T10:15",
  },
  {
    id: "da-3",
    kennung: "DA-003",
    patient: "Friedrich Schulz",
    abholort: "Pflegeheim Lindenhof, Berlin",
    zielort: "Hausarztpraxis Dr. Lang, Berlin",
    terminzeit: "09:30",
    rueckfahrt: true,
    rueckfahrtzeit: "11:00",
    mobilitaet: "rollstuhl",
    begleitperson: false,
    verordnungErforderlich: true,
    kostentraeger: "Pflegeheim Lindenhof",
    krankenkasse: "DAK Gesundheit",
    bevorzugtesFahrzeug: "B-KT 311",
    bevorzugterFahrer: "L. Schäfer",
    notiz: "Wöchentliche Kontrolle",
    medizinischeNotiz: "Leichte Demenz – ruhig ansprechen.",
    kategorie: "pflegeheim",
    rhythmus: "woechentlich",
    wochentage: [2],
    startDatum: "2026-03-10",
    endDatum: null,
    pausiert: true,
    pauseVon: null,
    pauseBis: null,
    feiertageUeberspringen: true,
    uebersprungeneTermine: [],
    generierteTermine: [],
    erstellt: "2026-03-04T08:30",
  },
  {
    id: "da-4",
    kennung: "DA-004",
    patient: "Elisabeth Wagner",
    abholort: "Privatadresse Charlottenburg",
    zielort: "Reha-Klinik Grunewald, Berlin",
    terminzeit: "08:00",
    rueckfahrt: false,
    mobilitaet: "gehfaehig",
    begleitperson: true,
    verordnungErforderlich: true,
    kostentraeger: "Barmer",
    krankenkasse: "Barmer",
    bevorzugtesFahrzeug: "B-KT 097",
    bevorzugterFahrer: "S. Yilmaz",
    notiz: "Ambulante Reha-Serie",
    medizinischeNotiz: "Nach Augen-OP – darf sich nicht bücken.",
    kategorie: "krankenhaus",
    rhythmus: "woechentlich",
    wochentage: [1, 4],
    startDatum: "2026-05-04",
    endDatum: "2026-08-31",
    pausiert: false,
    pauseVon: "2026-07-13",
    pauseBis: "2026-07-27",
    feiertageUeberspringen: true,
    uebersprungeneTermine: [],
    generierteTermine: [],
    erstellt: "2026-04-28T14:00",
  },
];

/**
 * Immutable snapshot of the originally configured series. Used to seed the
 * persisted `recurring_orders` table once; the live array above is replaced
 * in place by the store after the first DB fetch.
 */
export const SEED_DAUERAUFTRAEGE: Dauerauftrag[] = DAUERAUFTRAEGE.map((d) => ({
  ...d,
  wochentage: [...d.wochentage],
  uebersprungeneTermine: [...d.uebersprungeneTermine],
  generierteTermine: [...d.generierteTermine],
}));
