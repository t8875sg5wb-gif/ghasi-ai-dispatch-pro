// ============================================================
// GHASI AI – Smart Dispatch Engine
// Intelligente Disposition für Krankentransporte.
// Verzahnt Aufträge, Fahrer und Fahrzeuge zu einem echten
// Dispatch-Center mit KI-Empfehlungen, Konflikterkennung,
// Live-Status, Routenoptimierung und Kennzahlen.
//
// Bewusst client-seitig & deterministisch (kein Date.now() im
// Seed), damit SSR/Hydration stabil bleibt. Bestehende Module
// (Aufträge, Fahrer, Fahrzeuge) bleiben unangetastet.
// ============================================================
import {
  CalendarClock,
  UserCheck,
  Truck,
  Navigation,
  MapPin,
  HeartPulse,
  Route as RouteIcon,
  Flag,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";

import type { Auftrag, Transportart, AuftragPrioritaet } from "@/lib/auftraege";
import {
  INITIAL_AUFTRAEGE,
  MOBILITAET_META,
  effektiveMobilitaet,
  effektiveVerordnung,
  empfohlenerFahrzeugtyp,
  fahrzeugPasstZuMobilitaet,
  verordnungFehlt,
} from "@/lib/auftraege";
import {
  type Fahrer,
  FAHRER_STATUS_META,
  bewerteFahrer,
} from "@/lib/fahrer";
import {
  type Fahrzeug,
  FAHRZEUG_STATUS_META,
  bewerteFahrzeug,
  fahrzeugWarnungen,
  laeuftAb,
} from "@/lib/fahrzeuge";

/* ------------------------------------------------------------------ *
 * Live-Status
 * ------------------------------------------------------------------ */

export type LiveStatus =
  | "geplant"
  | "fahrer_zugewiesen"
  | "fahrzeug_zugewiesen"
  | "anfahrt"
  | "am_abholort"
  | "patient_an_bord"
  | "in_fahrt"
  | "am_ziel"
  | "abgeschlossen"
  | "storniert"
  | "verspaetet";

export type DispatchSpalte = "warten" | "aktiv" | "verspaetet" | "abgeschlossen";

export interface LiveStatusMeta {
  label: string;
  icon: LucideIcon;
  badge: string;
  dot: string;
  /** position in the live pipeline (storniert/verspaetet excluded) */
  stufe: number;
  spalte: DispatchSpalte;
}

export const LIVE_STATUS_META: Record<LiveStatus, LiveStatusMeta> = {
  geplant: {
    label: "Geplant",
    icon: CalendarClock,
    badge: "border-info/30 bg-info/10 text-info",
    dot: "bg-info",
    stufe: 0,
    spalte: "warten",
  },
  fahrer_zugewiesen: {
    label: "Fahrer zugewiesen",
    icon: UserCheck,
    badge: "border-accent/30 bg-accent/10 text-accent",
    dot: "bg-accent",
    stufe: 1,
    spalte: "warten",
  },
  fahrzeug_zugewiesen: {
    label: "Fahrzeug zugewiesen",
    icon: Truck,
    badge: "border-accent/30 bg-accent/10 text-accent",
    dot: "bg-accent",
    stufe: 2,
    spalte: "warten",
  },
  anfahrt: {
    label: "Anfahrt",
    icon: Navigation,
    badge: "border-warning/30 bg-warning/10 text-warning",
    dot: "bg-warning",
    stufe: 3,
    spalte: "aktiv",
  },
  am_abholort: {
    label: "Am Abholort",
    icon: MapPin,
    badge: "border-warning/30 bg-warning/10 text-warning",
    dot: "bg-warning",
    stufe: 4,
    spalte: "aktiv",
  },
  patient_an_bord: {
    label: "Patient an Bord",
    icon: HeartPulse,
    badge: "border-primary/30 bg-primary/10 text-primary",
    dot: "bg-primary",
    stufe: 5,
    spalte: "aktiv",
  },
  in_fahrt: {
    label: "In Fahrt",
    icon: RouteIcon,
    badge: "border-primary/30 bg-primary/10 text-primary",
    dot: "bg-primary",
    stufe: 6,
    spalte: "aktiv",
  },
  am_ziel: {
    label: "Am Ziel",
    icon: Flag,
    badge: "border-success/30 bg-success/10 text-success",
    dot: "bg-success",
    stufe: 7,
    spalte: "aktiv",
  },
  abgeschlossen: {
    label: "Abgeschlossen",
    icon: CheckCircle2,
    badge: "border-success/30 bg-success/10 text-success",
    dot: "bg-success",
    stufe: 8,
    spalte: "abgeschlossen",
  },
  storniert: {
    label: "Storniert",
    icon: XCircle,
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
    stufe: -1,
    spalte: "abgeschlossen",
  },
  verspaetet: {
    label: "Verspätet",
    icon: AlertTriangle,
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
    stufe: -1,
    spalte: "verspaetet",
  },
};

/** Ordered pipeline used in the detail timeline. */
export const LIVE_PIPELINE: LiveStatus[] = [
  "geplant",
  "fahrer_zugewiesen",
  "fahrzeug_zugewiesen",
  "anfahrt",
  "am_abholort",
  "patient_an_bord",
  "in_fahrt",
  "am_ziel",
  "abgeschlossen",
];

/** The next status in the live pipeline (or null at the end). */
export function naechsterStatus(s: LiveStatus): LiveStatus | null {
  const i = LIVE_PIPELINE.indexOf(s);
  if (i < 0 || i >= LIVE_PIPELINE.length - 1) return null;
  return LIVE_PIPELINE[i + 1];
}

export const DISPATCH_SPALTEN: { key: DispatchSpalte; label: string }[] = [
  { key: "warten", label: "Wartend" },
  { key: "aktiv", label: "Aktiv" },
  { key: "verspaetet", label: "Verspätet" },
  { key: "abgeschlossen", label: "Abgeschlossen" },
];

export function spalteVon(t: DispatchTransport): DispatchSpalte {
  if (t.verspaetungMin >= 10 && t.liveStatus !== "abgeschlossen" && t.liveStatus !== "storniert")
    return "verspaetet";
  return LIVE_STATUS_META[t.liveStatus].spalte;
}

/* ------------------------------------------------------------------ *
 * Transport-Modell
 * ------------------------------------------------------------------ */

export type SerienTyp =
  | "Dialyse"
  | "Strahlentherapie"
  | "Physiotherapie"
  | "Klinik-Termin"
  | "Pflegeheim"
  | "Schulfahrt";

export interface DispatchTransport extends Auftrag {
  liveStatus: LiveStatus;
  /** geplante Abholzeit "HH:MM" */
  abholzeit: string;
  /** geplante Ankunft "HH:MM" */
  ankunftzeit: string;
  distanzKm: number;
  leerKm: number;
  verspaetungMin: number;
  wiederkehrend: boolean;
  serie?: SerienTyp;
  /** Erlös in EUR */
  erloes: number;
  rollstuhl: boolean;
  liegend: boolean;
  istNotfall: boolean;
  /** Fahrer hat den Auftrag bestätigt (Live-Board-Spalte „Fahrer akzeptiert"). */
  fahrerAkzeptiert?: boolean;
  /** Transport ist abgerechnet/abrechnungsbereit (Spalte „Abrechnung bereit"). */
  abrechnungBereit?: boolean;
}

export function formatEUR(value: number): string {
  return value.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

/* ------------------------------------------------------------------ *
 * Seed: deterministische Transporte für ein volles Board
 * ------------------------------------------------------------------ */

const STATUS_MAP: Record<Auftrag["status"], LiveStatus> = {
  neu: "geplant",
  disponiert: "fahrzeug_zugewiesen",
  unterwegs: "in_fahrt",
  abgeschlossen: "abgeschlossen",
  storniert: "storniert",
};

function abgeleiteteFelder(a: Auftrag): Pick<
  DispatchTransport,
  "rollstuhl" | "liegend" | "istNotfall"
> {
  const liegend = a.transportart === "Liegendtransport" || a.transportart === "Notfall";
  const rollstuhl = a.transportart === "Rollstuhl";
  return { liegend, rollstuhl, istNotfall: a.transportart === "Notfall" };
}

function uhrzeit(iso: string): string {
  const m = iso.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : "—";
}

function plus(iso: string, minuten: number): string {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  if (!m) return "—";
  let total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + minuten;
  total = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const min = total % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Build the dispatch dataset: existing orders + generated recurring trips. */
export function generateDispatchTransporte(): DispatchTransport[] {
  const basis: DispatchTransport[] = INITIAL_AUFTRAEGE.map((a, idx) => {
    const abgeleitet = abgeleiteteFelder(a);
    const distanz = 8 + ((idx * 7) % 22);
    const fahrtMin = Math.round(distanz * 2.4);
    return {
      ...a,
      ...abgeleitet,
      liveStatus: STATUS_MAP[a.status],
      abholzeit: uhrzeit(a.termin),
      ankunftzeit: plus(a.termin, fahrtMin),
      distanzKm: distanz,
      leerKm: 2 + (idx % 5),
      verspaetungMin: 0,
      wiederkehrend: a.transportart === "Dialysefahrt",
      serie: a.transportart === "Dialysefahrt" ? "Dialyse" : undefined,
      erloes: 95 + distanz * 6,
      istNotfall: abgeleitet.istNotfall,
    };
  });

  // Make one active trip delayed for demonstration.
  const verspaetet = basis.find((t) => t.liveStatus === "in_fahrt");
  if (verspaetet) verspaetet.verspaetungMin = 18;

  const extra: DispatchTransport[] = [
    mkTransport({
      nummer: "A-2045",
      patient: "Hannah Voigt",
      transportart: "Dialysefahrt",
      prioritaet: "normal",
      abholort: "Pflegeheim Lindenhof, Berlin",
      zielort: "Dialysezentrum Nord, Berlin",
      abholzeit: "09:15",
      distanzKm: 14,
      kostentraeger: "AOK Nordost",
      serie: "Dialyse",
      liveStatus: "fahrer_zugewiesen",
      fahrer: "L. Schäfer",
      fahrzeug: null,
    }),
    mkTransport({
      nummer: "A-2046",
      patient: "Werner Brandt",
      transportart: "Sitzendtransport",
      prioritaet: "normal",
      abholort: "Privatadresse Steglitz",
      zielort: "Strahlentherapie Süd, Berlin",
      abholzeit: "09:45",
      distanzKm: 11,
      kostentraeger: "Barmer",
      serie: "Strahlentherapie",
      wiederkehrend: true,
      liveStatus: "geplant",
    }),
    mkTransport({
      nummer: "A-2047",
      patient: "Ingrid Sommer",
      transportart: "Rollstuhl",
      prioritaet: "hoch",
      abholort: "Pflegeheim Sonnenhof, Berlin",
      zielort: "Orthopädie Klinikum West, Berlin",
      abholzeit: "10:00",
      distanzKm: 9,
      kostentraeger: "DAK Gesundheit",
      liveStatus: "anfahrt",
      fahrer: "M. Keller",
      fahrzeug: "B-KT 142",
    }),
    mkTransport({
      nummer: "A-2048",
      patient: "Dialysezentrum Nord (Sammelfahrt)",
      transportart: "Dialysefahrt",
      prioritaet: "normal",
      abholort: "Pflegeheim Lindenhof, Berlin",
      zielort: "Dialysezentrum Nord, Berlin",
      abholzeit: "09:20",
      distanzKm: 13,
      kostentraeger: "AOK Nordost",
      serie: "Dialyse",
      wiederkehrend: true,
      liveStatus: "geplant",
    }),
    mkTransport({
      nummer: "A-2049",
      patient: "Notfall – Sturzverletzung",
      transportart: "Notfall",
      prioritaet: "dringend",
      abholort: "Privatadresse Wedding",
      zielort: "Klinikum West, Notaufnahme",
      abholzeit: "08:05",
      distanzKm: 7,
      kostentraeger: "Selbstzahler",
      liveStatus: "geplant",
      istNotfall: true,
    }),
    mkTransport({
      nummer: "A-2050",
      patient: "Gerda Lindner",
      transportart: "Sitzendtransport",
      prioritaet: "niedrig",
      abholort: "Privatadresse Pankow",
      zielort: "Physiotherapie Mitte, Berlin",
      abholzeit: "13:30",
      distanzKm: 12,
      kostentraeger: "Techniker Krankenkasse",
      serie: "Physiotherapie",
      wiederkehrend: true,
      liveStatus: "geplant",
    }),
  ];

  return [...basis, ...extra];
}

interface MkInput {
  nummer: string;
  patient: string;
  transportart: Transportart;
  prioritaet: AuftragPrioritaet;
  abholort: string;
  zielort: string;
  abholzeit: string;
  distanzKm: number;
  kostentraeger: string;
  liveStatus: LiveStatus;
  fahrer?: string | null;
  fahrzeug?: string | null;
  serie?: SerienTyp;
  wiederkehrend?: boolean;
  istNotfall?: boolean;
}

let seq = 500;
function mkTransport(i: MkInput): DispatchTransport {
  seq += 1;
  const fahrtMin = Math.round(i.distanzKm * 2.4);
  const liegend = i.transportart === "Liegendtransport" || i.transportart === "Notfall";
  const rollstuhl = i.transportart === "Rollstuhl";
  return {
    id: `d-${seq}`,
    nummer: i.nummer,
    patient: i.patient,
    transportart: i.transportart,
    prioritaet: i.prioritaet,
    status: "neu",
    abholort: i.abholort,
    zielort: i.zielort,
    termin: `2026-06-26T${i.abholzeit}`,
    fahrer: i.fahrer ?? null,
    fahrzeug: i.fahrzeug ?? null,
    kostentraeger: i.kostentraeger,
    notiz: "",
    liveStatus: i.liveStatus,
    abholzeit: i.abholzeit,
    ankunftzeit: plus(`2026-06-26T${i.abholzeit}`, fahrtMin),
    distanzKm: i.distanzKm,
    leerKm: 2 + (seq % 4),
    verspaetungMin: 0,
    wiederkehrend: i.wiederkehrend ?? false,
    serie: i.serie,
    erloes: 95 + i.distanzKm * 6,
    rollstuhl,
    liegend,
    istNotfall: i.istNotfall ?? i.transportart === "Notfall",
  };
}

/* ------------------------------------------------------------------ *
 * KI-Dispatch-Engine: bester Fahrer + bestes Fahrzeug
 * ------------------------------------------------------------------ */

export interface DispoEmpfehlung {
  fahrer: Fahrer | null;
  fahrzeug: Fahrzeug | null;
  fahrerScore: number;
  fahrzeugScore: number;
  gesamtScore: number;
  erklaerung: string;
  gruende: string[];
}

function fahrzeugPasst(f: Fahrzeug, t: DispatchTransport): boolean {
  if (t.liegend) return f.liegendGeeignet;
  if (t.rollstuhl) return f.rollstuhlGeeignet;
  return f.sitzplaetze >= 1;
}

/**
 * GHASI AI berechnet den besten Fahrer und das beste Fahrzeug für einen
 * Transport – inkl. nachvollziehbarer Begründung.
 */
export function empfehleDisposition(
  t: DispatchTransport,
  fahrer: Fahrer[],
  fahrzeuge: Fahrzeug[],
): DispoEmpfehlung {
  // Fahrer-Ranking
  const fahrerRang = fahrer
    .map((f) => bewerteFahrer(f))
    .filter((s): s is NonNullable<ReturnType<typeof bewerteFahrer>> => s !== null)
    .sort((a, b) => b.score - a.score);

  // Fahrzeug-Ranking, nur geeignete
  const fahrzeugRang = fahrzeuge
    .filter((f) => fahrzeugPasst(f, t))
    .map((f) => bewerteFahrzeug(f, t.transportart))
    .filter((s): s is NonNullable<ReturnType<typeof bewerteFahrzeug>> => s !== null)
    .sort((a, b) => b.score - a.score);

  const bestFahrer = fahrerRang[0]?.fahrer ?? null;
  const bestFahrzeug = fahrzeugRang[0]?.fahrzeug ?? null;

  const gruende: string[] = [];
  if (bestFahrer) {
    if (bestFahrer.status === "verfuegbar") gruende.push("Fahrer sofort verfügbar");
    if (bestFahrer.puenktlichkeit >= 95)
      gruende.push(`${bestFahrer.puenktlichkeit}% Pünktlichkeit`);
    if (bestFahrer.bewertung >= 4.6)
      gruende.push(`Top-Bewertung ${bestFahrer.bewertung.toFixed(1)}★`);
    if (bestFahrer.ueberstunden <= 5) gruende.push("Geringe Überstunden");
  }
  if (bestFahrzeug) {
    if (t.rollstuhl) gruende.push("Rollstuhl-tauglich");
    if (t.liegend) gruende.push("Liegend-tauglich");
    if (bestFahrzeug.tankstand >= 50) gruende.push(`Tank ${bestFahrzeug.tankstand}%`);
  }

  let erklaerung = "Keine passende Ressource verfügbar.";
  if (bestFahrer && bestFahrzeug) {
    const merkmale: string[] = [];
    if (bestFahrer.status === "verfuegbar") merkmale.push("ist verfügbar");
    if (t.rollstuhl) merkmale.push("Fahrzeug ist rollstuhltauglich");
    else if (t.liegend) merkmale.push("Fahrzeug ist für Liegendtransport geeignet");
    if (bestFahrer.puenktlichkeit >= 95)
      merkmale.push(`hat ${bestFahrer.puenktlichkeit}% Pünktlichkeit`);
    if (bestFahrer.ueberstunden <= 5) merkmale.push("hat wenige Überstunden");
    erklaerung = `${bestFahrer.name} mit ${bestFahrzeug.kennzeichen} vorgeschlagen, weil ${
      merkmale.slice(0, 3).join(", ") || "die beste Gesamteffizienz erreicht wird"
    }.`;
  }

  const fahrerScore = fahrerRang[0]?.score ?? 0;
  const fahrzeugScore = fahrzeugRang[0]?.score ?? 0;

  return {
    fahrer: bestFahrer,
    fahrzeug: bestFahrzeug,
    fahrerScore,
    fahrzeugScore,
    gesamtScore: Math.round((fahrerScore + fahrzeugScore) / 2),
    erklaerung,
    gruende: gruende.slice(0, 4),
  };
}

/* ------------------------------------------------------------------ *
 * Konflikterkennung
 * ------------------------------------------------------------------ */

export type KonfliktTyp =
  | "doppelbuchung"
  | "fahrer_nicht_verfuegbar"
  | "fahrzeug_nicht_verfuegbar"
  | "ueberstunden"
  | "dokument"
  | "wartung"
  | "verspaetung"
  | "ungeeignet";

export interface Konflikt {
  id: string;
  typ: KonfliktTyp;
  schwere: "warnung" | "kritisch";
  text: string;
  transportId?: string;
}

function zeitInMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

export function erkenneKonflikte(
  transporte: DispatchTransport[],
  fahrer: Fahrer[],
  fahrzeuge: Fahrzeug[],
): Konflikt[] {
  const konflikte: Konflikt[] = [];
  const offene = transporte.filter(
    (t) => t.liveStatus !== "abgeschlossen" && t.liveStatus !== "storniert",
  );

  // Doppelbuchung: gleicher Fahrer, überlappende Zeitfenster
  const proFahrer = new Map<string, DispatchTransport[]>();
  for (const t of offene) {
    if (!t.fahrer) continue;
    const list = proFahrer.get(t.fahrer) ?? [];
    list.push(t);
    proFahrer.set(t.fahrer, list);
  }
  for (const [name, list] of proFahrer) {
    const sorted = [...list].sort((a, b) => zeitInMin(a.abholzeit) - zeitInMin(b.abholzeit));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (zeitInMin(cur.abholzeit) < zeitInMin(prev.ankunftzeit)) {
        konflikte.push({
          id: `dop-${cur.id}`,
          typ: "doppelbuchung",
          schwere: "kritisch",
          text: `Doppelbuchung: ${name} ist ${prev.abholzeit}–${prev.ankunftzeit} (${prev.nummer}) und überschneidet sich mit ${cur.nummer} um ${cur.abholzeit}.`,
          transportId: cur.id,
        });
      }
    }
  }

  // Fahrer-/Fahrzeug-Verfügbarkeit & Eignung
  for (const t of offene) {
    if (verordnungFehlt(effektiveVerordnung(t))) {
      konflikte.push({
        id: `verord-${t.id}`,
        typ: "dokument",
        schwere: "warnung",
        text: `${t.nummer}: Verordnung fehlt – Fahrer darf nicht ohne gültige Verordnung starten.`,
        transportId: t.id,
      });
    }
    if (t.fahrer) {
      const f = fahrer.find((x) => x.name === t.fahrer);
      if (f && !FAHRER_STATUS_META[f.status].einsetzbar) {
        konflikte.push({
          id: `fnv-${t.id}`,
          typ: "fahrer_nicht_verfuegbar",
          schwere: "kritisch",
          text: `${t.nummer}: Fahrer ${f.name} ist ${FAHRER_STATUS_META[f.status].label.toLowerCase()} und nicht einsetzbar.`,
          transportId: t.id,
        });
      }
      if (f && f.ueberstunden >= 12) {
        konflikte.push({
          id: `ueb-${t.id}`,
          typ: "ueberstunden",
          schwere: "warnung",
          text: `${f.name} hat ${f.ueberstunden}h Überstunden – Auslastung prüfen (${t.nummer}).`,
          transportId: t.id,
        });
      }
    }
    if (t.fahrzeug) {
      const v = fahrzeuge.find((x) => x.kennzeichen === t.fahrzeug);
      if (v && !FAHRZEUG_STATUS_META[v.status].einsetzbar) {
        konflikte.push({
          id: `vnv-${t.id}`,
          typ: "fahrzeug_nicht_verfuegbar",
          schwere: "kritisch",
          text: `${t.nummer}: Fahrzeug ${v.kennzeichen} ist ${FAHRZEUG_STATUS_META[v.status].label.toLowerCase()}.`,
          transportId: t.id,
        });
      }
      if (v) {
        const warn = fahrzeugWarnungen(v);
        if (t.rollstuhl && !v.rollstuhlGeeignet) {
          konflikte.push({
            id: `geig-r-${t.id}`,
            typ: "ungeeignet",
            schwere: "kritisch",
            text: `${t.nummer}: ${v.kennzeichen} ist nicht rollstuhltauglich.`,
            transportId: t.id,
          });
        }
        if (t.liegend && !v.liegendGeeignet) {
          konflikte.push({
            id: `geig-l-${t.id}`,
            typ: "ungeeignet",
            schwere: "kritisch",
            text: `${t.nummer}: ${v.kennzeichen} ist nicht für Liegendtransport geeignet.`,
            transportId: t.id,
          });
        }
        if (!fahrzeugPasstZuMobilitaet(effektiveMobilitaet(t), v)) {
          konflikte.push({
            id: `mob-${t.id}`,
            typ: "ungeeignet",
            schwere: "kritisch",
            text: `${t.nummer}: ${v.kennzeichen} passt nicht zur Mobilität „${MOBILITAET_META[effektiveMobilitaet(t)].label}" – benötigt ${empfohlenerFahrzeugtyp(effektiveMobilitaet(t))}.`,
            transportId: t.id,
          });
        }
        if (warn.tank) {
          konflikte.push({
            id: `tank-${t.id}`,
            typ: "wartung",
            schwere: "warnung",
            text: `${t.nummer}: ${v.kennzeichen} hat nur ${v.tankstand}% Tank – vor Abfahrt tanken.`,
            transportId: t.id,
          });
        }
        if (laeuftAb(v.tuevBis, 14) || laeuftAb(v.naechsteWartung, 7)) {
          konflikte.push({
            id: `war-${t.id}`,
            typ: "wartung",
            schwere: "warnung",
            text: `${t.nummer}: ${v.kennzeichen} hat eine baldige Wartungs-/TÜV-Frist.`,
            transportId: t.id,
          });
        }
      }
    }
    // Verspätung
    if (t.verspaetungMin >= 10) {
      konflikte.push({
        id: `ver-${t.id}`,
        typ: "verspaetung",
        schwere: "warnung",
        text: `${t.nummer}: ${t.verspaetungMin} Min Verspätung – Ankunft beim Patienten gefährdet.`,
        transportId: t.id,
      });
    }
    // Notfall ohne Disposition
    if (t.istNotfall && (!t.fahrer || !t.fahrzeug)) {
      konflikte.push({
        id: `not-${t.id}`,
        typ: "fahrer_nicht_verfuegbar",
        schwere: "kritisch",
        text: `Notfall ${t.nummer} ist noch nicht vollständig disponiert!`,
        transportId: t.id,
      });
    }
  }

  return konflikte.sort((a, b) => (a.schwere === b.schwere ? 0 : a.schwere === "kritisch" ? -1 : 1));
}

/* ------------------------------------------------------------------ *
 * Kennzahlen (Business Intelligence)
 * ------------------------------------------------------------------ */

export interface DispatchKpis {
  gesamt: number;
  abgeschlossen: number;
  aktiv: number;
  wartend: number;
  verspaetet: number;
  storniert: number;
  notfall: number;
  freieFahrer: number;
  freieFahrzeuge: number;
  umsatzHeute: number;
  gewinnHeute: number;
  leerKmGesamt: number;
  distanzGesamt: number;
  fahrzeugAuslastung: number;
  fahrerAuslastung: number;
  schnittVerspaetung: number;
  effizienz: number;
}

export function berechneKpis(
  transporte: DispatchTransport[],
  fahrer: Fahrer[],
  fahrzeuge: Fahrzeug[],
): DispatchKpis {
  const abgeschlossen = transporte.filter((t) => t.liveStatus === "abgeschlossen");
  const storniert = transporte.filter((t) => t.liveStatus === "storniert").length;
  const aktiv = transporte.filter((t) => spalteVon(t) === "aktiv").length;
  const wartend = transporte.filter((t) => spalteVon(t) === "warten").length;
  const verspaetet = transporte.filter((t) => spalteVon(t) === "verspaetet").length;
  const notfall = transporte.filter(
    (t) => t.istNotfall && t.liveStatus !== "abgeschlossen" && t.liveStatus !== "storniert",
  ).length;

  const umsatzHeute = transporte
    .filter((t) => t.liveStatus !== "storniert")
    .reduce((s, t) => s + t.erloes, 0);
  const leerKmGesamt = transporte.reduce((s, t) => s + t.leerKm, 0);
  const distanzGesamt = transporte.reduce((s, t) => s + t.distanzKm, 0);
  const gewinnHeute = Math.round(umsatzHeute * 0.38);

  const verspaetungen = transporte.filter((t) => t.verspaetungMin > 0);
  const schnittVerspaetung = verspaetungen.length
    ? Math.round(verspaetungen.reduce((s, t) => s + t.verspaetungMin, 0) / verspaetungen.length)
    : 0;

  const freieFahrer = fahrer.filter((f) => FAHRER_STATUS_META[f.status].einsetzbar).length;
  const freieFahrzeuge = fahrzeuge.filter((f) => FAHRZEUG_STATUS_META[f.status].einsetzbar).length;
  const fahrzeugAuslastung = fahrzeuge.length
    ? Math.round((fahrzeuge.filter((f) => f.status === "unterwegs").length / fahrzeuge.length) * 100)
    : 0;
  const fahrerAuslastung = fahrer.length
    ? Math.round((fahrer.filter((f) => f.status === "unterwegs").length / fahrer.length) * 100)
    : 0;

  const gesamtPlanbar = transporte.length - storniert;
  const effizienz = gesamtPlanbar
    ? Math.max(
        40,
        Math.round(
          100 -
            (verspaetet * 12 + (gesamtPlanbar - abgeschlossen.length - aktiv) * 2) /
              Math.max(1, gesamtPlanbar),
        ),
      )
    : 100;

  return {
    gesamt: transporte.length,
    abgeschlossen: abgeschlossen.length,
    aktiv,
    wartend,
    verspaetet,
    storniert,
    notfall,
    freieFahrer,
    freieFahrzeuge,
    umsatzHeute,
    gewinnHeute,
    leerKmGesamt,
    distanzGesamt,
    fahrzeugAuslastung,
    fahrerAuslastung,
    schnittVerspaetung,
    effizienz: Math.min(99, effizienz),
  };
}

/* ------------------------------------------------------------------ *
 * Executive AI – proaktive Hinweise & Routenoptimierung
 * ------------------------------------------------------------------ */

export interface ExecHinweis {
  id: string;
  text: string;
  tone: "success" | "info" | "warning" | "destructive";
  icon: LucideIcon;
}

export function executiveHinweise(
  transporte: DispatchTransport[],
  fahrer: Fahrer[],
  fahrzeuge: Fahrzeug[],
): ExecHinweis[] {
  const hinweise: ExecHinweis[] = [];
  const offene = transporte.filter(
    (t) => t.liveStatus !== "abgeschlossen" && t.liveStatus !== "storniert",
  );

  // Verspätungen
  for (const t of offene.filter((t) => t.verspaetungMin >= 10)) {
    const wer = t.fahrer ?? "Ein Fahrer";
    hinweise.push({
      id: `exh-ver-${t.id}`,
      text: `${wer} läuft ${t.verspaetungMin} Minuten hinter dem Plan (${t.nummer}).`,
      tone: "destructive",
      icon: AlertTriangle,
    });
  }

  // Zusammenlegbare Fahrten (gleiches Ziel + nahe Zeit, beide noch wartend)
  const mergeKandidaten = new Map<string, DispatchTransport[]>();
  for (const t of offene.filter((t) => spalteVon(t) === "warten")) {
    const key = t.zielort;
    const list = mergeKandidaten.get(key) ?? [];
    list.push(t);
    mergeKandidaten.set(key, list);
  }
  for (const [ziel, list] of mergeKandidaten) {
    if (list.length >= 2) {
      const km = list.reduce((s, t) => s + t.leerKm, 0);
      hinweise.push({
        id: `exh-mrg-${ziel}`,
        text: `${list.length} Fahrten nach „${ziel}" können zusammengelegt werden – spart ca. ${km + 9} km Leerfahrt.`,
        tone: "success",
        icon: RouteIcon,
      });
    }
  }

  // Wartung morgen fällig
  for (const v of fahrzeuge) {
    if (laeuftAb(v.naechsteWartung, 2) || laeuftAb(v.tuevBis, 2)) {
      hinweise.push({
        id: `exh-war-${v.id}`,
        text: `Fahrzeug ${v.kennzeichen} benötigt in Kürze Wartung/TÜV – heute einplanen.`,
        tone: "warning",
        icon: Truck,
      });
    }
  }

  // Überstunden-Balance
  const ueberlastet = fahrer.filter((f) => f.ueberstunden >= 12);
  if (ueberlastet.length) {
    hinweise.push({
      id: "exh-ueb",
      text: `${ueberlastet.map((f) => f.name).join(", ")} mit hohen Überstunden – Last auf verfügbare Fahrer verteilen.`,
      tone: "warning",
      icon: UserCheck,
    });
  }

  // Gewinn-Potenzial
  const wartend = offene.filter((t) => !t.fahrer || !t.fahrzeug).length;
  if (wartend > 0) {
    hinweise.push({
      id: "exh-profit",
      text: `${wartend} Transporte noch ohne vollständige Disposition – sofortige Zuteilung erhöht den Tagesgewinn um ca. ${wartend * 4}%.`,
      tone: "info",
      icon: CheckCircle2,
    });
  }

  return hinweise.slice(0, 8);
}
