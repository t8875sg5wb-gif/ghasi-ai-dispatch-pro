import {
  CircleDot,
  ClipboardList,
  Truck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
  Clock,
  Footprints,
  Accessibility,
  Armchair,
  BedDouble,
  type LucideIcon,
} from "lucide-react";

import type { AdresseStruktur } from "@/lib/address";

export type AuftragStatus = "neu" | "disponiert" | "unterwegs" | "abgeschlossen" | "storniert";

export type AuftragPrioritaet = "niedrig" | "normal" | "hoch" | "dringend";

export type Transportart =
  | "Liegendtransport"
  | "Sitzendtransport"
  | "Rollstuhl"
  | "Dialysefahrt"
  | "Notfall";

/* ------------------------------------------------------------------ *
 * Medizinische Transportdetails (additiv)
 * ------------------------------------------------------------------ */

/** Status der ärztlichen Verordnung (Yes / No / Missing / Uploaded). */
export type VerordnungStatus =
  | "erhalten" // Yes
  | "nicht_erhalten" // No
  | "fehlt" // Missing
  | "hochgeladen"; // Uploaded

/** Mobilität des Patienten beim Transport. */
export type Mobilitaet =
  | "gehfaehig" // normal walker
  | "rollstuhl" // wheelchair
  | "tragestuhl" // carrying chair
  | "liegend"; // lying transport

export interface Auftrag {
  id: string;
  nummer: string;
  patient: string;
  transportart: Transportart;
  prioritaet: AuftragPrioritaet;
  status: AuftragStatus;
  /** Strukturierte Abholadresse; legacy `abholort` bleibt als rückwärtskompatible Anzeige erhalten. */
  pickup?: AdresseStruktur;
  /** Strukturierte Zieladresse; legacy `zielort` bleibt als rückwärtskompatible Anzeige erhalten. */
  destination?: AdresseStruktur;
  abholort: string;
  zielort: string;
  termin: string; // ISO datetime
  fahrer: string | null;
  fahrzeug: string | null;
  kostentraeger: string;
  notiz: string;
  // --- Medizinische Transportdetails (optional, additiv) ---
  /** Status der ärztlichen Verordnung */
  verordnung?: VerordnungStatus;
  /** Verknüpftes Verordnungsdokument im Dokumentencenter */
  verordnungDokumentId?: string | null;
  /** Mobilitätsart des Patienten */
  mobilitaet?: Mobilitaet;
  /** Begleitperson dabei? */
  begleitperson?: boolean;
  /** Anforderungen am Abholort (z. B. 3. OG ohne Aufzug) */
  abholanforderung?: string;
  /** Anforderungen am Zielort (z. B. Station 4, Aufnahme) */
  zielanforderung?: string;
  /** Hinweise zum Patienten (nicht-medizinisch) */
  patientennotiz?: string;
  /** Medizinische Hinweise (Sauerstoff, Infektion, etc.) */
  medizinischeNotiz?: string;
  // --- Dispatch-/Abrechnungs-Persistenz (optional, additiv) ---
  /** Persistierter feingranularer Dispatch-LiveStatus (z. B. "anfahrt"). */
  detailStatus?: string | null;
  /** Abrechnungsstatus (offen, bereit, abgerechnet …). */
  abrechnungStatus?: string;
  /** Verknüpfter Dauerauftrag (Serie). */
  dauerauftragId?: string | null;
}

export interface StatusMeta {
  label: string;
  icon: LucideIcon;
  /** tailwind classes for badge */
  badge: string;
  /** dot color class */
  dot: string;
}

export const STATUS_META: Record<AuftragStatus, StatusMeta> = {
  neu: {
    label: "Neu",
    icon: CircleDot,
    badge: "border-info/30 bg-info/10 text-info",
    dot: "bg-info",
  },
  disponiert: {
    label: "Disponiert",
    icon: ClipboardList,
    badge: "border-accent/30 bg-accent/10 text-accent",
    dot: "bg-accent",
  },
  unterwegs: {
    label: "Unterwegs",
    icon: Truck,
    badge: "border-warning/30 bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  abgeschlossen: {
    label: "Abgeschlossen",
    icon: CheckCircle2,
    badge: "border-success/30 bg-success/10 text-success",
    dot: "bg-success",
  },
  storniert: {
    label: "Storniert",
    icon: XCircle,
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

/* ------------------------------------------------------------------ *
 * Meta für Verordnung & Mobilität
 * ------------------------------------------------------------------ */

export interface VerordnungMeta {
  label: string;
  kurz: string;
  badge: string;
  icon: LucideIcon;
}

export const VERORDNUNG_META: Record<VerordnungStatus, VerordnungMeta> = {
  erhalten: {
    label: "Verordnung erhalten",
    kurz: "Erhalten",
    badge: "border-success/30 bg-success/10 text-success",
    icon: CheckCircle2,
  },
  hochgeladen: {
    label: "Verordnung hochgeladen",
    kurz: "Hochgeladen",
    badge: "border-info/30 bg-info/10 text-info",
    icon: FileCheck,
  },
  nicht_erhalten: {
    label: "Verordnung nicht erhalten",
    kurz: "Nicht erhalten",
    badge: "border-warning/30 bg-warning/10 text-warning",
    icon: Clock,
  },
  fehlt: {
    label: "Verordnung fehlt",
    kurz: "Fehlt",
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: AlertTriangle,
  },
};

export type FahrzeugBedarf = "standard" | "rollstuhl" | "liegend";

export interface MobilitaetMeta {
  label: string;
  kurz: string;
  badge: string;
  icon: LucideIcon;
  /** Welches Fahrzeug wird für diese Mobilität benötigt? */
  benoetigtFahrzeug: FahrzeugBedarf;
}

export const MOBILITAET_META: Record<Mobilitaet, MobilitaetMeta> = {
  gehfaehig: {
    label: "Gehfähig",
    kurz: "Gehfähig",
    badge: "border-success/30 bg-success/10 text-success",
    icon: Footprints,
    benoetigtFahrzeug: "standard",
  },
  rollstuhl: {
    label: "Rollstuhl",
    kurz: "Rollstuhl",
    badge: "border-info/30 bg-info/10 text-info",
    icon: Accessibility,
    benoetigtFahrzeug: "rollstuhl",
  },
  tragestuhl: {
    label: "Tragestuhl",
    kurz: "Tragestuhl",
    badge: "border-accent/30 bg-accent/10 text-accent",
    icon: Armchair,
    benoetigtFahrzeug: "rollstuhl",
  },
  liegend: {
    label: "Liegendtransport",
    kurz: "Liegend",
    badge: "border-warning/30 bg-warning/10 text-warning",
    icon: BedDouble,
    benoetigtFahrzeug: "liegend",
  },
};

export const VERORDNUNG_OPTIONEN: VerordnungStatus[] = [
  "erhalten",
  "hochgeladen",
  "nicht_erhalten",
  "fehlt",
];

export const MOBILITAET_OPTIONEN: Mobilitaet[] = [
  "gehfaehig",
  "rollstuhl",
  "tragestuhl",
  "liegend",
];

/** Liegt eine gültige Verordnung vor? */
export function verordnungVorhanden(s?: VerordnungStatus): boolean {
  return s === "erhalten" || s === "hochgeladen";
}

/** Fehlt die Verordnung (Fahrer-Warnung)? */
export function verordnungFehlt(s?: VerordnungStatus): boolean {
  return s === "fehlt" || s === "nicht_erhalten" || s === undefined;
}

/** Wenn keine explizite Mobilität gesetzt ist, aus der Transportart ableiten. */
export function effektiveMobilitaet(a: Pick<Auftrag, "mobilitaet" | "transportart">): Mobilitaet {
  if (a.mobilitaet) return a.mobilitaet;
  switch (a.transportart) {
    case "Liegendtransport":
    case "Notfall":
      return "liegend";
    case "Rollstuhl":
      return "rollstuhl";
    default:
      return "gehfaehig";
  }
}

/** Effektiver Verordnungsstatus (Default: nicht erhalten). */
export function effektiveVerordnung(a: Pick<Auftrag, "verordnung">): VerordnungStatus {
  return a.verordnung ?? "nicht_erhalten";
}

export interface FahrzeugEignung {
  rollstuhlGeeignet: boolean;
  liegendGeeignet: boolean;
}

/** Passt das Fahrzeug zur Mobilität des Patienten? */
export function fahrzeugPasstZuMobilitaet(m: Mobilitaet | undefined, f: FahrzeugEignung): boolean {
  const bedarf = MOBILITAET_META[m ?? "gehfaehig"].benoetigtFahrzeug;
  if (bedarf === "liegend") return f.liegendGeeignet;
  if (bedarf === "rollstuhl") return f.rollstuhlGeeignet;
  return true;
}

/** Empfohlener Fahrzeugtyp in Klartext für die KI / Disposition. */
export function empfohlenerFahrzeugtyp(m: Mobilitaet | undefined): string {
  const bedarf = MOBILITAET_META[m ?? "gehfaehig"].benoetigtFahrzeug;
  if (bedarf === "liegend") return "Liegend-/KTW-Fahrzeug (Trage)";
  if (bedarf === "rollstuhl") return "Rollstuhl-/Tragestuhl-taugliches Fahrzeug";
  return "Standard-Sitzendtransport";
}

/** Ordered list of statuses used for the workflow pipeline (excludes storniert). */
export const STATUS_PIPELINE: AuftragStatus[] = ["neu", "disponiert", "unterwegs", "abgeschlossen"];

/**
 * Allowed status transitions for the workflow.
 * Each status maps to the statuses it can move to next.
 */
export const STATUS_TRANSITIONS: Record<AuftragStatus, AuftragStatus[]> = {
  neu: ["disponiert", "storniert"],
  disponiert: ["unterwegs", "storniert"],
  unterwegs: ["abgeschlossen", "storniert"],
  abgeschlossen: [],
  storniert: ["neu"],
};

export const PRIORITAET_META: Record<AuftragPrioritaet, { label: string; badge: string }> = {
  niedrig: { label: "Niedrig", badge: "border-border bg-muted text-muted-foreground" },
  normal: { label: "Normal", badge: "border-info/30 bg-info/10 text-info" },
  hoch: { label: "Hoch", badge: "border-warning/30 bg-warning/10 text-warning" },
  dringend: {
    label: "Dringend",
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

export const TRANSPORTARTEN: Transportart[] = [
  "Liegendtransport",
  "Sitzendtransport",
  "Rollstuhl",
  "Dialysefahrt",
  "Notfall",
];

export const PRIORITAETEN: AuftragPrioritaet[] = ["niedrig", "normal", "hoch", "dringend"];

export function istAuftragStatus(value: unknown): value is AuftragStatus {
  return STATUS_PIPELINE.includes(value as AuftragStatus) || value === "storniert";
}

export function istAuftragPrioritaet(value: unknown): value is AuftragPrioritaet {
  return PRIORITAETEN.includes(value as AuftragPrioritaet);
}

export function istTransportart(value: unknown): value is Transportart {
  return TRANSPORTARTEN.includes(value as Transportart);
}

export function istMobilitaet(value: unknown): value is Mobilitaet {
  return MOBILITAET_OPTIONEN.includes(value as Mobilitaet);
}

export function istVerordnungStatus(value: unknown): value is VerordnungStatus {
  return VERORDNUNG_OPTIONEN.includes(value as VerordnungStatus);
}

export function formatTermin(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

let idCounter = 100;
export function nextAuftragId(): string {
  idCounter += 1;
  return `a-${idCounter}`;
}

/**
 * Demo orders — used ONLY as one-time seed data for the `orders` table (see
 * seedOrders). Production reads come from the database via `useOrders()`, which
 * mirrors persisted rows into `INITIAL_AUFTRAEGE`.
 */
export const SEED_AUFTRAEGE: Auftrag[] = [
  {
    id: "a-1",
    nummer: "A-2041",
    patient: "Margarete Hoffmann",
    transportart: "Dialysefahrt",
    prioritaet: "normal",
    status: "neu",
    abholort: "Pflegeheim Sonnenhof, Berlin",
    zielort: "Dialysezentrum Nord, Berlin",
    termin: "2026-06-26T08:30",
    fahrer: null,
    fahrzeug: null,
    kostentraeger: "AOK Nordost",
    notiz: "Patientin benötigt Rollstuhl-Unterstützung.",
    verordnung: "erhalten",
    verordnungDokumentId: "d-1",
    mobilitaet: "rollstuhl",
    begleitperson: false,
    abholanforderung: "Abholung im Zimmer 12, Erdgeschoss. Personal informiert.",
    zielanforderung: "Anmeldung Schicht 1, Rollstuhl bereitstellen.",
    patientennotiz: "Spricht wenig, etwas schwerhörig.",
    medizinischeNotiz: "Dialyse 3× pro Woche, Fistel rechter Arm – Arm schonen.",
  },
  {
    id: "a-2",
    nummer: "A-2042",
    patient: "Johann Bauer",
    transportart: "Liegendtransport",
    prioritaet: "hoch",
    status: "disponiert",
    abholort: "Klinikum West, Berlin",
    zielort: "Reha-Klinik Grunewald, Berlin",
    termin: "2026-06-26T10:15",
    fahrer: "M. Keller",
    fahrzeug: "B-KT 142",
    kostentraeger: "Techniker Krankenkasse",
    notiz: "Sauerstoffgerät erforderlich.",
    verordnung: "hochgeladen",
    verordnungDokumentId: "d-9",
    mobilitaet: "liegend",
    begleitperson: true,
    abholanforderung: "Station 4B, Bett 2. Übergabe durch Pflege.",
    zielanforderung: "Patientenaufnahme, Trage bis ins Zimmer.",
    patientennotiz: "Ehefrau begleitet den Transport.",
    medizinischeNotiz: "Sauerstoff 2 l/min, Monitor während Fahrt beobachten.",
  },
  {
    id: "a-3",
    nummer: "A-2043",
    patient: "Elisabeth Wagner",
    transportart: "Sitzendtransport",
    prioritaet: "normal",
    status: "unterwegs",
    abholort: "Privatadresse Charlottenburg",
    zielort: "Augenklinik Mitte, Berlin",
    termin: "2026-06-26T11:00",
    fahrer: "S. Yilmaz",
    fahrzeug: "B-KT 097",
    kostentraeger: "Barmer",
    notiz: "",
    verordnung: "erhalten",
    verordnungDokumentId: null,
    mobilitaet: "gehfaehig",
    begleitperson: true,
    abholanforderung: "2. OG mit Aufzug, am Eingang klingeln.",
    zielanforderung: "Augenklinik Anmeldung, Wartebereich.",
    patientennotiz: "Nach Eingriff sehbehindert – Begleitung nötig.",
    medizinischeNotiz: "Nach Augen-OP, darf sich nicht bücken.",
  },
  {
    id: "a-4",
    nummer: "A-2039",
    patient: "Friedrich Schulz",
    transportart: "Rollstuhl",
    prioritaet: "niedrig",
    status: "abgeschlossen",
    abholort: "Pflegeheim Lindenhof, Berlin",
    zielort: "Hausarztpraxis Dr. Lang, Berlin",
    termin: "2026-06-25T14:30",
    fahrer: "P. Richter",
    fahrzeug: "B-KT 204",
    kostentraeger: "DAK Gesundheit",
    notiz: "Rückfahrt separat gebucht.",
    verordnung: "erhalten",
    verordnungDokumentId: null,
    mobilitaet: "rollstuhl",
    begleitperson: false,
    abholanforderung: "Eigener Rollstuhl mitnehmen.",
    zielanforderung: "Praxis im EG, barrierefrei.",
    patientennotiz: "",
    medizinischeNotiz: "Leichte Demenz – ruhig ansprechen.",
  },
  {
    id: "a-5",
    nummer: "A-2044",
    patient: "Anna Klein",
    transportart: "Notfall",
    prioritaet: "dringend",
    status: "neu",
    abholort: "Privatadresse Neukölln",
    zielort: "Klinikum West, Notaufnahme",
    termin: "2026-06-26T07:45",
    fahrer: null,
    fahrzeug: null,
    kostentraeger: "Selbstzahler",
    notiz: "Sofortige Disposition erforderlich.",
    verordnung: "fehlt",
    verordnungDokumentId: null,
    mobilitaet: "liegend",
    begleitperson: false,
    abholanforderung: "3. OG ohne Aufzug – Tragestuhl/Trage erforderlich.",
    zielanforderung: "Direkt Notaufnahme, Anmeldung vorab telefonisch.",
    patientennotiz: "Patientin allein zu Hause, Nachbarin öffnet.",
    medizinischeNotiz: "Verdacht Sturzverletzung – Verordnung wird nachgereicht.",
  },
  {
    id: "a-6",
    nummer: "A-2038",
    patient: "Karl Neumann",
    transportart: "Sitzendtransport",
    prioritaet: "normal",
    status: "storniert",
    abholort: "Pflegeheim Sonnenhof, Berlin",
    zielort: "Zahnklinik Süd, Berlin",
    termin: "2026-06-24T09:00",
    fahrer: null,
    fahrzeug: null,
    kostentraeger: "AOK Nordost",
    notiz: "Termin vom Patienten abgesagt.",
    verordnung: "nicht_erhalten",
    verordnungDokumentId: null,
    mobilitaet: "gehfaehig",
    begleitperson: false,
    abholanforderung: "",
    zielanforderung: "",
    patientennotiz: "",
    medizinischeNotiz: "",
  },
];

/**
 * Live orders mirror. Empty at module load; `useOrders()` fills it from the
 * database on every fetch (the AppShell prefetches it app-wide). This is the
 * production source of truth — never the demo `SEED_AUFTRAEGE` above.
 */
export const INITIAL_AUFTRAEGE: Auftrag[] = [];

export const FAHRER_OPTIONEN = ["M. Keller", "S. Yilmaz", "P. Richter", "L. Schäfer", "T. Wolf"];

export const FAHRZEUG_OPTIONEN = ["B-KT 142", "B-KT 097", "B-KT 204", "B-KT 311", "B-KT 358"];
