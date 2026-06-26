import {
  CheckCircle2,
  Truck,
  Wrench,
  Ban,
  type LucideIcon,
} from "lucide-react";

import type { Transportart } from "@/lib/auftraege";

export type FahrzeugStatus =
  | "frei"
  | "unterwegs"
  | "werkstatt"
  | "nicht_verfuegbar";

export type Fahrzeugtyp =
  | "KTW"
  | "RTW"
  | "Rollstuhlbus"
  | "Tragestuhlwagen"
  | "PKW";

export type Kraftstoffart = "Diesel" | "Benzin" | "Elektro" | "Hybrid";

export type Reifenstatus = "gut" | "mittel" | "wechseln";

export interface Reparatur {
  datum: string; // ISO date
  beschreibung: string;
  kosten: number;
}

export interface Fahrzeug {
  id: string;
  /** Fahrzeug-ID, e.g. KFZ-014 */
  nummer: string;
  kennzeichen: string;
  marke: string;
  modell: string;
  baujahr: number;
  typ: Fahrzeugtyp;
  rollstuhlGeeignet: boolean;
  liegendGeeignet: boolean;
  sitzplaetze: number;
  status: FahrzeugStatus;
  /** assigned driver name or null */
  fahrer: string | null;
  standort: string;
  gps: { lat: number; lng: number };
  kilometerstand: number;
  /** fuel level 0–100 % */
  tankstand: number;
  kraftstoff: Kraftstoffart;
  /** l/100km or kWh/100km */
  verbrauch: number;
  /** remaining range in km */
  reichweite: number;
  /** cost per km in EUR */
  kostenProKm: number;
  tagesumsatz: number;
  tagesgewinn: number;
  monatsumsatz: number;
  monatsgewinn: number;
  tuevBis: string; // ISO date
  /** odometer value at which next oil change is due */
  oelwechselBei: number;
  naechsteWartung: string; // ISO date
  reifenstatus: Reifenstatus;
  reparaturen: Reparatur[];
  versicherung: string;
  versicherungBis: string; // ISO date
  leasingrate: number;
  leasingEnde: string; // ISO date
  dokumente: string[];
  fotos: string[];
  notizen: string;
}

export interface StatusMeta {
  label: string;
  icon: LucideIcon;
  badge: string;
  dot: string;
  /** counts as available for new orders */
  einsetzbar: boolean;
}

export const FAHRZEUG_STATUS_META: Record<FahrzeugStatus, StatusMeta> = {
  frei: {
    label: "Frei",
    icon: CheckCircle2,
    badge: "border-success/30 bg-success/10 text-success",
    dot: "bg-success",
    einsetzbar: true,
  },
  unterwegs: {
    label: "Unterwegs",
    icon: Truck,
    badge: "border-info/30 bg-info/10 text-info",
    dot: "bg-info",
    einsetzbar: false,
  },
  werkstatt: {
    label: "Werkstatt",
    icon: Wrench,
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
    einsetzbar: false,
  },
  nicht_verfuegbar: {
    label: "Nicht verfügbar",
    icon: Ban,
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
    einsetzbar: false,
  },
};

export const FAHRZEUG_STATI: FahrzeugStatus[] = [
  "frei",
  "unterwegs",
  "werkstatt",
  "nicht_verfuegbar",
];

export const FAHRZEUGTYPEN: Fahrzeugtyp[] = [
  "KTW",
  "RTW",
  "Rollstuhlbus",
  "Tragestuhlwagen",
  "PKW",
];

export const KRAFTSTOFFARTEN: Kraftstoffart[] = [
  "Diesel",
  "Benzin",
  "Elektro",
  "Hybrid",
];

export const REIFENSTATI: Reifenstatus[] = ["gut", "mittel", "wechseln"];

export const REIFEN_META: Record<Reifenstatus, { label: string; badge: string }> = {
  gut: { label: "Gut", badge: "border-success/30 bg-success/10 text-success" },
  mittel: { label: "Mittel", badge: "border-warning/30 bg-warning/10 text-warning" },
  wechseln: {
    label: "Wechseln",
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

export function formatEUR(value: number): string {
  return value.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export function formatKm(value: number): string {
  return `${value.toLocaleString("de-DE")} km`;
}

export function formatDatum(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Returns true when a date is within the next `tage` days (or already passed). */
export function laeuftAb(iso: string, tage = 30): boolean {
  if (!iso) return false;
  const ms = new Date(iso).getTime() - Date.now();
  return ms < tage * 24 * 60 * 60 * 1000;
}

export function istAbgelaufen(iso: string): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

/** Oil change is due soon when remaining km is below threshold. */
export function oelwechselFaellig(f: Fahrzeug, schwelleKm = 1500): boolean {
  return f.oelwechselBei - f.kilometerstand <= schwelleKm;
}

/** Aggregated warning flags used across overview, detail and maintenance. */
export interface FahrzeugWarnungen {
  tank: boolean;
  oel: boolean;
  wartung: boolean;
  tuev: boolean;
  versicherung: boolean;
  leasing: boolean;
  reifen: boolean;
  /** any maintenance/deadline warning active */
  hatWarnung: boolean;
}

export function fahrzeugWarnungen(f: Fahrzeug): FahrzeugWarnungen {
  const tank = f.tankstand <= 20;
  const oel = oelwechselFaellig(f);
  const wartung = laeuftAb(f.naechsteWartung);
  const tuev = laeuftAb(f.tuevBis, 45);
  const versicherung = laeuftAb(f.versicherungBis, 45);
  const leasing = laeuftAb(f.leasingEnde, 60);
  const reifen = f.reifenstatus === "wechseln";
  return {
    tank,
    oel,
    wartung,
    tuev,
    versicherung,
    leasing,
    reifen,
    hatWarnung: tank || oel || wartung || tuev || versicherung || leasing || reifen,
  };
}

export function reparaturkostenGesamt(f: Fahrzeug): number {
  return f.reparaturen.reduce((sum, r) => sum + r.kosten, 0);
}

let idCounter = 100;
export function nextFahrzeugId(): string {
  idCounter += 1;
  return `kfz-${idCounter}`;
}

/* ------------------------------------------------------------------ *
 * GHASI AI – vehicle intelligence
 * ------------------------------------------------------------------ */

/** Map order transport type to vehicle suitability requirements. */
function passtZuAuftrag(f: Fahrzeug, transportart: Transportart): boolean {
  switch (transportart) {
    case "Liegendtransport":
    case "Notfall":
      return f.liegendGeeignet;
    case "Rollstuhl":
      return f.rollstuhlGeeignet;
    case "Dialysefahrt":
    case "Sitzendtransport":
      return f.sitzplaetze >= 1;
    default:
      return true;
  }
}

export interface FahrzeugScore {
  fahrzeug: Fahrzeug;
  score: number;
  gruende: string[];
}

/**
 * Scoring used by GHASI AI to recommend the best vehicle for a new order.
 * Higher is better. Only `einsetzbar` vehicles that fit the transport type qualify.
 */
export function bewerteFahrzeug(
  fahrzeug: Fahrzeug,
  transportart?: Transportart,
): FahrzeugScore | null {
  const meta = FAHRZEUG_STATUS_META[fahrzeug.status];
  if (!meta.einsetzbar) return null;
  if (transportart && !passtZuAuftrag(fahrzeug, transportart)) return null;

  const gruende: string[] = [];
  let score = 0;
  const warn = fahrzeugWarnungen(fahrzeug);

  // Availability
  score += 40;
  gruende.push("Sofort einsatzbereit");

  // Suitability bonus
  if (transportart && passtZuAuftrag(fahrzeug, transportart)) {
    score += 18;
    gruende.push(`Geeignet für ${transportart}`);
  }

  // Fuel level (0–100 → up to 20)
  score += fahrzeug.tankstand * 0.2;
  if (fahrzeug.tankstand >= 60) gruende.push(`Tank ${fahrzeug.tankstand}%`);

  // Low running cost
  score += Math.max(0, 12 - fahrzeug.kostenProKm * 10);
  if (fahrzeug.kostenProKm <= 0.7) gruende.push("Niedrige km-Kosten");

  // Maintenance health penalties
  if (warn.tank) score -= 12;
  if (warn.oel || warn.wartung) score -= 10;
  if (warn.tuev || warn.versicherung) score -= 14;
  if (warn.reifen) score -= 8;
  if (!warn.hatWarnung) gruende.push("Keine offenen Wartungen");

  return { fahrzeug, score: Math.round(score), gruende: gruende.slice(0, 3) };
}

export function empfehleFahrzeug(
  fahrzeuge: Fahrzeug[],
  transportart?: Transportart,
  limit = 3,
): FahrzeugScore[] {
  return fahrzeuge
    .map((f) => bewerteFahrzeug(f, transportart))
    .filter((s): s is FahrzeugScore => s !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export type EmpfehlungAktion = "einsetzen" | "warten" | "reparieren" | "ersetzen";

export interface FlottenEmpfehlung {
  fahrzeug: Fahrzeug;
  aktion: EmpfehlungAktion;
  text: string;
  tone: "success" | "info" | "warning" | "destructive";
}

/**
 * GHASI AI fleet advice: should a vehicle be used more, serviced,
 * repaired or replaced?
 */
export function flottenEmpfehlung(f: Fahrzeug): FlottenEmpfehlung {
  const warn = fahrzeugWarnungen(f);
  const repkosten = reparaturkostenGesamt(f);
  const alter = new Date().getFullYear() - f.baujahr;

  // Replace: old + high repair cost + low profit
  if ((alter >= 10 || f.kilometerstand >= 280000) && repkosten >= 6000) {
    return {
      fahrzeug: f,
      aktion: "ersetzen",
      text: `Hohe Reparaturkosten (${formatEUR(repkosten)}) bei ${alter} Jahren – Ersatz prüfen.`,
      tone: "destructive",
    };
  }

  // Repair: active workshop / tyres / oil
  if (f.status === "werkstatt" || warn.reifen || warn.oel) {
    return {
      fahrzeug: f,
      aktion: "reparieren",
      text: warn.reifen
        ? "Reifen wechseln, danach wieder einsatzbereit."
        : "Wartung/Ölwechsel durchführen, dann freigeben.",
      tone: "warning",
    };
  }

  // Service soon
  if (warn.wartung || warn.tuev || warn.versicherung || warn.leasing) {
    return {
      fahrzeug: f,
      aktion: "warten",
      text: "Bald fällige Frist – Termin frühzeitig einplanen.",
      tone: "info",
    };
  }

  // Otherwise: use it more
  return {
    fahrzeug: f,
    aktion: "einsetzen",
    text: `Effizient (${formatEUR(f.monatsgewinn)} Monatsgewinn) – stärker einsetzen.`,
    tone: "success",
  };
}

export const AKTION_META: Record<
  EmpfehlungAktion,
  { label: string; badge: string }
> = {
  einsetzen: { label: "Stärker einsetzen", badge: "border-success/30 bg-success/10 text-success" },
  warten: { label: "Wartung planen", badge: "border-info/30 bg-info/10 text-info" },
  reparieren: { label: "Reparieren", badge: "border-warning/30 bg-warning/10 text-warning" },
  ersetzen: { label: "Ersetzen prüfen", badge: "border-destructive/30 bg-destructive/10 text-destructive" },
};

export const INITIAL_FAHRZEUGE: Fahrzeug[] = [
  {
    id: "kfz-1",
    nummer: "KFZ-001",
    kennzeichen: "B-KT 142",
    marke: "Mercedes-Benz",
    modell: "Sprinter 314 CDI",
    baujahr: 2021,
    typ: "KTW",
    rollstuhlGeeignet: true,
    liegendGeeignet: true,
    sitzplaetze: 2,
    status: "unterwegs",
    fahrer: "M. Keller",
    standort: "B96 Höhe Tempelhof",
    gps: { lat: 52.473, lng: 13.385 },
    kilometerstand: 142500,
    tankstand: 68,
    kraftstoff: "Diesel",
    verbrauch: 9.8,
    reichweite: 480,
    kostenProKm: 0.62,
    tagesumsatz: 480,
    tagesgewinn: 190,
    monatsumsatz: 9800,
    monatsgewinn: 3900,
    tuevBis: "2027-03-01",
    oelwechselBei: 150000,
    naechsteWartung: "2026-09-12",
    reifenstatus: "gut",
    reparaturen: [
      { datum: "2026-02-10", beschreibung: "Bremsen vorne erneuert", kosten: 540 },
    ],
    versicherung: "HUK-Coburg",
    versicherungBis: "2027-01-01",
    leasingrate: 690,
    leasingEnde: "2027-06-30",
    dokumente: ["Fahrzeugschein", "Leasingvertrag", "Versicherungspolice"],
    fotos: [],
    notizen: "Hauptfahrzeug für Liegendtransporte.",
  },
  {
    id: "kfz-2",
    nummer: "KFZ-002",
    kennzeichen: "B-KT 097",
    marke: "Volkswagen",
    modell: "Crafter 35",
    baujahr: 2020,
    typ: "Rollstuhlbus",
    rollstuhlGeeignet: true,
    liegendGeeignet: false,
    sitzplaetze: 4,
    status: "frei",
    fahrer: "S. Yilmaz",
    standort: "Betriebshof Neukölln",
    gps: { lat: 52.481, lng: 13.435 },
    kilometerstand: 198200,
    tankstand: 84,
    kraftstoff: "Diesel",
    verbrauch: 10.4,
    reichweite: 520,
    kostenProKm: 0.68,
    tagesumsatz: 220,
    tagesgewinn: 95,
    monatsumsatz: 8200,
    monatsgewinn: 3100,
    tuevBis: "2026-08-15",
    oelwechselBei: 200000,
    naechsteWartung: "2026-07-20",
    reifenstatus: "mittel",
    reparaturen: [
      { datum: "2025-11-04", beschreibung: "Klimaanlage Service", kosten: 280 },
      { datum: "2026-01-22", beschreibung: "Rollstuhlrampe justiert", kosten: 160 },
    ],
    versicherung: "Allianz",
    versicherungBis: "2026-07-10",
    leasingrate: 620,
    leasingEnde: "2026-12-31",
    dokumente: ["Fahrzeugschein", "Leasingvertrag"],
    fotos: [],
    notizen: "Ölwechsel bald fällig.",
  },
  {
    id: "kfz-3",
    nummer: "KFZ-003",
    kennzeichen: "B-KT 204",
    marke: "Ford",
    modell: "Transit Custom",
    baujahr: 2019,
    typ: "Tragestuhlwagen",
    rollstuhlGeeignet: true,
    liegendGeeignet: false,
    sitzplaetze: 3,
    status: "frei",
    fahrer: "P. Richter",
    standort: "Betriebshof Friedrichshain",
    gps: { lat: 52.515, lng: 13.454 },
    kilometerstand: 241800,
    tankstand: 16,
    kraftstoff: "Diesel",
    verbrauch: 8.9,
    reichweite: 90,
    kostenProKm: 0.74,
    tagesumsatz: 260,
    tagesgewinn: 100,
    monatsumsatz: 7600,
    monatsgewinn: 2400,
    tuevBis: "2026-07-05",
    oelwechselBei: 242500,
    naechsteWartung: "2026-07-02",
    reifenstatus: "wechseln",
    reparaturen: [
      { datum: "2025-09-15", beschreibung: "Getriebe instandgesetzt", kosten: 2400 },
      { datum: "2026-03-08", beschreibung: "Auspuffanlage", kosten: 880 },
      { datum: "2026-05-19", beschreibung: "Lichtmaschine", kosten: 540 },
    ],
    versicherung: "HUK-Coburg",
    versicherungBis: "2026-07-20",
    leasingrate: 0,
    leasingEnde: "",
    dokumente: ["Fahrzeugschein"],
    fotos: [],
    notizen: "Tankstand niedrig, Reifen wechseln, TÜV bald fällig.",
  },
  {
    id: "kfz-4",
    nummer: "KFZ-004",
    kennzeichen: "B-KT 311",
    marke: "Mercedes-Benz",
    modell: "Vito Tourer",
    baujahr: 2023,
    typ: "KTW",
    rollstuhlGeeignet: true,
    liegendGeeignet: true,
    sitzplaetze: 2,
    status: "frei",
    fahrer: "L. Schäfer",
    standort: "Betriebshof Charlottenburg",
    gps: { lat: 52.506, lng: 13.305 },
    kilometerstand: 54200,
    tankstand: 92,
    kraftstoff: "Diesel",
    verbrauch: 8.4,
    reichweite: 640,
    kostenProKm: 0.55,
    tagesumsatz: 0,
    tagesgewinn: 0,
    monatsumsatz: 9100,
    monatsgewinn: 4200,
    tuevBis: "2027-09-01",
    oelwechselBei: 60000,
    naechsteWartung: "2026-11-15",
    reifenstatus: "gut",
    reparaturen: [],
    versicherung: "Allianz",
    versicherungBis: "2027-04-01",
    leasingrate: 740,
    leasingEnde: "2028-02-28",
    dokumente: ["Fahrzeugschein", "Leasingvertrag", "Versicherungspolice"],
    fotos: [],
    notizen: "Neuestes und effizientestes Fahrzeug.",
  },
  {
    id: "kfz-5",
    nummer: "KFZ-005",
    kennzeichen: "B-KT 358",
    marke: "Renault",
    modell: "Master",
    baujahr: 2015,
    typ: "Rollstuhlbus",
    rollstuhlGeeignet: true,
    liegendGeeignet: false,
    sitzplaetze: 5,
    status: "werkstatt",
    fahrer: null,
    standort: "Werkstatt Kfz-Technik Mitte",
    gps: { lat: 52.521, lng: 13.401 },
    kilometerstand: 298400,
    tankstand: 40,
    kraftstoff: "Diesel",
    verbrauch: 11.8,
    reichweite: 300,
    kostenProKm: 0.92,
    tagesumsatz: 0,
    tagesgewinn: 0,
    monatsumsatz: 3200,
    monatsgewinn: 400,
    tuevBis: "2026-07-12",
    oelwechselBei: 300000,
    naechsteWartung: "2026-06-28",
    reifenstatus: "mittel",
    reparaturen: [
      { datum: "2025-08-01", beschreibung: "Turbolader", kosten: 2600 },
      { datum: "2025-12-12", beschreibung: "Kupplung erneuert", kosten: 1900 },
      { datum: "2026-04-05", beschreibung: "Kühler getauscht", kosten: 1200 },
      { datum: "2026-06-18", beschreibung: "Motorschaden Diagnose", kosten: 800 },
    ],
    versicherung: "HUK-Coburg",
    versicherungBis: "2026-09-01",
    leasingrate: 0,
    leasingEnde: "",
    dokumente: ["Fahrzeugschein"],
    fotos: [],
    notizen: "Hohe Reparaturkosten – Ersatz prüfen.",
  },
];
