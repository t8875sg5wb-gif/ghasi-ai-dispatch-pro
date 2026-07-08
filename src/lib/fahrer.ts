import {
  CheckCircle2,
  Truck,
  Coffee,
  Plane,
  Thermometer,
  Moon,
  type LucideIcon,
} from "lucide-react";

export type FahrerStatus = "verfuegbar" | "unterwegs" | "pause" | "urlaub" | "krank" | "feierabend";

export type Vertragsart = "Vollzeit" | "Teilzeit" | "Minijob" | "Aushilfe";

export interface Nachweis {
  /** ISO date (yyyy-mm-dd) when the document expires */
  gueltigBis: string;
  /** extra info, e.g. license classes */
  info?: string;
}

export interface Fahrer {
  id: string;
  /** Fahrer-ID, e.g. F-014 */
  nummer: string;
  name: string;
  /** initials fallback handled by Avatar; foto optional URL */
  foto: string | null;
  telefon: string;
  email: string;
  adresse: string;
  fuehrerschein: Nachweis;
  pSchein: Nachweis;
  ersteHilfe: Nachweis;
  vertragsart: Vertragsart;
  /** working-time model, e.g. "Mo–Fr, 06:00–14:00" */
  arbeitszeiten: string;
  /** remaining vacation days this year */
  urlaubstage: number;
  /** sick days this year */
  krankheitstage: number;
  status: FahrerStatus;
  /** human-readable live location */
  standort: string;
  gps: { lat: number; lng: number };
  /** assigned vehicle plate or null */
  fahrzeug: string | null;
  /** today's shift, e.g. "06:00 – 14:00" */
  schicht: string;
  /** 0–5 rating */
  bewertung: number;
  /** punctuality percentage 0–100 */
  puenktlichkeit: number;
  beschwerden: number;
  lob: number;
  /** overtime hours (this month) */
  ueberstunden: number;
  kmHeute: number;
  umsatzHeute: number;
  gewinnHeute: number;
  // --- Compliance (Schiene A) ---
  /** Personenbeförderungsschein gültig bis (ISO-Datum). */
  pScheinGueltigBis?: string | null;
  /** Datum des zuletzt vorgelegten Führungszeugnisses (ISO-Datum). */
  fuehrungszeugnisDatum?: string | null;
  /** Sozialversicherungsausweis vorhanden? */
  svAusweisVorhanden?: boolean;
  /** Steuer-Identifikationsnummer. */
  steuerId?: string;
  // --- Lohn (Priority 4) ---
  /** Beschäftigungsart für die Lohnberechnung. */
  beschaeftigungsart?: Beschaeftigungsart;
  /** Vereinbartes Monatsbrutto in EUR. */
  monatsbrutto?: number;
}

export type Beschaeftigungsart = "minijob" | "midijob" | "svpflichtig";

export const BESCHAEFTIGUNGSART_LABEL: Record<Beschaeftigungsart, string> = {
  minijob: "Minijob (geringfügig)",
  midijob: "Midijob (Übergangsbereich)",
  svpflichtig: "Sozialversicherungspflichtig",
};

export interface StatusMeta {
  label: string;
  icon: LucideIcon;
  badge: string;
  dot: string;
  /** counts as available for new orders */
  einsetzbar: boolean;
}

export const FAHRER_STATUS_META: Record<FahrerStatus, StatusMeta> = {
  verfuegbar: {
    label: "Verfügbar",
    icon: CheckCircle2,
    badge: "border-success/30 bg-success/10 text-success",
    dot: "bg-success",
    einsetzbar: true,
  },
  unterwegs: {
    label: "Unterwegs",
    icon: Truck,
    badge: "border-warning/30 bg-warning/10 text-warning",
    dot: "bg-warning",
    einsetzbar: false,
  },
  pause: {
    label: "Pause",
    icon: Coffee,
    badge: "border-info/30 bg-info/10 text-info",
    dot: "bg-info",
    einsetzbar: true,
  },
  urlaub: {
    label: "Urlaub",
    icon: Plane,
    badge: "border-accent/30 bg-accent/10 text-accent",
    dot: "bg-accent",
    einsetzbar: false,
  },
  krank: {
    label: "Krank",
    icon: Thermometer,
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
    einsetzbar: false,
  },
  feierabend: {
    label: "Feierabend",
    icon: Moon,
    badge: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
    einsetzbar: false,
  },
};

export const FAHRER_STATI: FahrerStatus[] = [
  "verfuegbar",
  "unterwegs",
  "pause",
  "urlaub",
  "krank",
  "feierabend",
];

export const VERTRAGSARTEN: Vertragsart[] = ["Vollzeit", "Teilzeit", "Minijob", "Aushilfe"];

export function initials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\s.-]/gu, "")
    .split(/[\s.-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatEUR(value: number): string {
  return value.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export function formatDatum(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Returns true when a document expires within the next 30 days (or is expired). */
export function laeuftAb(iso: string, tage = 30): boolean {
  const ms = new Date(iso).getTime() - Date.now();
  return ms < tage * 24 * 60 * 60 * 1000;
}

export function istAbgelaufen(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

let idCounter = 100;
export function nextFahrerId(): string {
  idCounter += 1;
  return `f-${idCounter}`;
}

/**
 * Scoring used by GHASI AI to recommend the best driver for a new order.
 * Higher is better. Only drivers whose status is `einsetzbar` qualify.
 */
export interface FahrerScore {
  fahrer: Fahrer;
  score: number;
  gruende: string[];
}

export function bewerteFahrer(fahrer: Fahrer): FahrerScore | null {
  const meta = FAHRER_STATUS_META[fahrer.status];
  if (!meta.einsetzbar) return null;

  const gruende: string[] = [];
  let score = 0;

  // Availability weight
  if (fahrer.status === "verfuegbar") {
    score += 40;
    gruende.push("Sofort verfügbar");
  } else if (fahrer.status === "pause") {
    score += 22;
    gruende.push("In Pause – bald einsetzbar");
  }

  // Rating (0–5 → up to 25)
  score += fahrer.bewertung * 5;
  if (fahrer.bewertung >= 4.6) gruende.push(`Top-Bewertung ${fahrer.bewertung.toFixed(1)}★`);

  // Punctuality (0–100 → up to 20)
  score += fahrer.puenktlichkeit * 0.2;
  if (fahrer.puenktlichkeit >= 95) gruende.push(`${fahrer.puenktlichkeit}% pünktlich`);

  // Vehicle assigned
  if (fahrer.fahrzeug) {
    score += 10;
    gruende.push(`Fahrzeug ${fahrer.fahrzeug} bereit`);
  }

  // Overtime penalty (fair workload distribution)
  score -= Math.min(fahrer.ueberstunden, 20) * 0.6;
  if (fahrer.ueberstunden <= 5) gruende.push("Geringe Überstunden");

  // Complaints penalty
  score -= fahrer.beschwerden * 4;

  return { fahrer, score: Math.round(score), gruende: gruende.slice(0, 3) };
}

export function empfehleFahrer(fahrer: Fahrer[], limit = 3): FahrerScore[] {
  return fahrer
    .map(bewerteFahrer)
    .filter((s): s is FahrerScore => s !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Demo drivers — used ONLY as one-time seed data for the `drivers` table (see
 * seedDrivers). Production reads come from the database via `useDrivers()`,
 * which mirrors persisted rows into `INITIAL_FAHRER`.
 */
export const SEED_FAHRER: Fahrer[] = [
  {
    id: "f-1",
    nummer: "F-001",
    name: "M. Keller",
    foto: null,
    telefon: "+49 151 2345 6789",
    email: "m.keller@ghasi-transport.de",
    adresse: "Lindenstraße 12, 32423 Minden",
    fuehrerschein: { gueltigBis: "2031-04-30", info: "Klasse B, C1" },
    pSchein: { gueltigBis: "2027-09-15" },
    ersteHilfe: { gueltigBis: "2026-08-01" },
    vertragsart: "Vollzeit",
    arbeitszeiten: "Mo–Fr, 06:00–14:00",
    urlaubstage: 18,
    krankheitstage: 2,
    status: "unterwegs",
    standort: "B482 Höhe Minden",
    gps: { lat: 52.473, lng: 13.385 },
    fahrzeug: "B-KT 142",
    schicht: "06:00 – 14:00",
    bewertung: 4.8,
    puenktlichkeit: 97,
    beschwerden: 0,
    lob: 12,
    ueberstunden: 6,
    kmHeute: 142,
    umsatzHeute: 480,
    gewinnHeute: 190,
  },
  {
    id: "f-2",
    nummer: "F-002",
    name: "S. Yilmaz",
    foto: null,
    telefon: "+49 152 9876 5432",
    email: "s.yilmaz@ghasi-transport.de",
    adresse: "Sonnenallee 88, 32423 Minden",
    fuehrerschein: { gueltigBis: "2029-11-20", info: "Klasse B" },
    pSchein: { gueltigBis: "2026-07-10" },
    ersteHilfe: { gueltigBis: "2027-02-12" },
    vertragsart: "Vollzeit",
    arbeitszeiten: "Mo–Fr, 08:00–16:00",
    urlaubstage: 22,
    krankheitstage: 0,
    status: "verfuegbar",
    standort: "Betriebshof Minden",
    gps: { lat: 52.481, lng: 13.435 },
    fahrzeug: "B-KT 097",
    schicht: "08:00 – 16:00",
    bewertung: 4.9,
    puenktlichkeit: 99,
    beschwerden: 0,
    lob: 18,
    ueberstunden: 3,
    kmHeute: 64,
    umsatzHeute: 220,
    gewinnHeute: 95,
  },
  {
    id: "f-3",
    nummer: "F-003",
    name: "P. Richter",
    foto: null,
    telefon: "+49 170 1122 3344",
    email: "p.richter@ghasi-transport.de",
    adresse: "Frankfurter Allee 210, 32457 Porta Westfalica",
    fuehrerschein: { gueltigBis: "2028-03-05", info: "Klasse B, BE" },
    pSchein: { gueltigBis: "2026-07-25" },
    ersteHilfe: { gueltigBis: "2026-07-18" },
    vertragsart: "Teilzeit",
    arbeitszeiten: "Mo–Mi, 06:00–12:00",
    urlaubstage: 9,
    krankheitstage: 4,
    status: "pause",
    standort: "Rastplatz Porta Westfalica",
    gps: { lat: 52.515, lng: 13.454 },
    fahrzeug: "B-KT 204",
    schicht: "06:00 – 12:00",
    bewertung: 4.4,
    puenktlichkeit: 92,
    beschwerden: 1,
    lob: 7,
    ueberstunden: 11,
    kmHeute: 88,
    umsatzHeute: 260,
    gewinnHeute: 100,
  },
  {
    id: "f-4",
    nummer: "F-004",
    name: "L. Schäfer",
    foto: null,
    telefon: "+49 160 5566 7788",
    email: "l.schaefer@ghasi-transport.de",
    adresse: "Kantstraße 45, 32545 Bad Oeynhausen",
    fuehrerschein: { gueltigBis: "2030-09-12", info: "Klasse B" },
    pSchein: { gueltigBis: "2028-01-30" },
    ersteHilfe: { gueltigBis: "2027-05-09" },
    vertragsart: "Vollzeit",
    arbeitszeiten: "Mo–Fr, 14:00–22:00",
    urlaubstage: 25,
    krankheitstage: 1,
    status: "verfuegbar",
    standort: "Betriebshof Bad Oeynhausen",
    gps: { lat: 52.506, lng: 13.305 },
    fahrzeug: "B-KT 311",
    schicht: "14:00 – 22:00",
    bewertung: 4.7,
    puenktlichkeit: 96,
    beschwerden: 0,
    lob: 9,
    ueberstunden: 2,
    kmHeute: 0,
    umsatzHeute: 0,
    gewinnHeute: 0,
  },
  {
    id: "f-5",
    nummer: "F-005",
    name: "T. Wolf",
    foto: null,
    telefon: "+49 176 4433 2211",
    email: "t.wolf@ghasi-transport.de",
    adresse: "Müllerstraße 130, 32423 Minden",
    fuehrerschein: { gueltigBis: "2027-12-01", info: "Klasse B, C1" },
    pSchein: { gueltigBis: "2026-06-29" },
    ersteHilfe: { gueltigBis: "2028-03-22" },
    vertragsart: "Vollzeit",
    arbeitszeiten: "Mo–Fr, 06:00–14:00",
    urlaubstage: 12,
    krankheitstage: 6,
    status: "krank",
    standort: "—",
    gps: { lat: 52.545, lng: 13.355 },
    fahrzeug: null,
    schicht: "06:00 – 14:00",
    bewertung: 4.2,
    puenktlichkeit: 88,
    beschwerden: 2,
    lob: 4,
    ueberstunden: 14,
    kmHeute: 0,
    umsatzHeute: 0,
    gewinnHeute: 0,
  },
  {
    id: "f-6",
    nummer: "F-006",
    name: "A. Demir",
    foto: null,
    telefon: "+49 157 9988 7766",
    email: "a.demir@ghasi-transport.de",
    adresse: "Karl-Marx-Straße 5, 32423 Minden",
    fuehrerschein: { gueltigBis: "2032-02-18", info: "Klasse B" },
    pSchein: { gueltigBis: "2029-04-04" },
    ersteHilfe: { gueltigBis: "2027-10-15" },
    vertragsart: "Teilzeit",
    arbeitszeiten: "Do–Sa, 10:00–18:00",
    urlaubstage: 20,
    krankheitstage: 0,
    status: "urlaub",
    standort: "—",
    gps: { lat: 52.478, lng: 13.441 },
    fahrzeug: null,
    schicht: "10:00 – 18:00",
    bewertung: 4.6,
    puenktlichkeit: 94,
    beschwerden: 0,
    lob: 11,
    ueberstunden: 1,
    kmHeute: 0,
    umsatzHeute: 0,
    gewinnHeute: 0,
  },
];

/**
 * Live drivers mirror. Empty at module load; `useDrivers()` fills it from the
 * database on every fetch (the AppShell prefetches it app-wide). This is the
 * production source of truth — never the demo `SEED_FAHRER` above.
 */
export const INITIAL_FAHRER: Fahrer[] = [];
