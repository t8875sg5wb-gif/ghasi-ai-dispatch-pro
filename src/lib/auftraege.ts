import {
  CircleDot,
  ClipboardList,
  Truck,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export type AuftragStatus =
  | "neu"
  | "disponiert"
  | "unterwegs"
  | "abgeschlossen"
  | "storniert";

export type AuftragPrioritaet = "niedrig" | "normal" | "hoch" | "dringend";

export type Transportart =
  | "Liegendtransport"
  | "Sitzendtransport"
  | "Rollstuhl"
  | "Dialysefahrt"
  | "Notfall";

export interface Auftrag {
  id: string;
  nummer: string;
  patient: string;
  transportart: Transportart;
  prioritaet: AuftragPrioritaet;
  status: AuftragStatus;
  abholort: string;
  zielort: string;
  termin: string; // ISO datetime
  fahrer: string | null;
  fahrzeug: string | null;
  kostentraeger: string;
  notiz: string;
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

/** Ordered list of statuses used for the workflow pipeline (excludes storniert). */
export const STATUS_PIPELINE: AuftragStatus[] = [
  "neu",
  "disponiert",
  "unterwegs",
  "abgeschlossen",
];

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

export const PRIORITAET_META: Record<
  AuftragPrioritaet,
  { label: string; badge: string }
> = {
  niedrig: { label: "Niedrig", badge: "border-border bg-muted text-muted-foreground" },
  normal: { label: "Normal", badge: "border-info/30 bg-info/10 text-info" },
  hoch: { label: "Hoch", badge: "border-warning/30 bg-warning/10 text-warning" },
  dringend: { label: "Dringend", badge: "border-destructive/30 bg-destructive/10 text-destructive" },
};

export const TRANSPORTARTEN: Transportart[] = [
  "Liegendtransport",
  "Sitzendtransport",
  "Rollstuhl",
  "Dialysefahrt",
  "Notfall",
];

export const PRIORITAETEN: AuftragPrioritaet[] = [
  "niedrig",
  "normal",
  "hoch",
  "dringend",
];

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

export const INITIAL_AUFTRAEGE: Auftrag[] = [
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
  },
];

export const FAHRER_OPTIONEN = [
  "M. Keller",
  "S. Yilmaz",
  "P. Richter",
  "L. Schäfer",
  "T. Wolf",
];

export const FAHRZEUG_OPTIONEN = [
  "B-KT 142",
  "B-KT 097",
  "B-KT 204",
  "B-KT 311",
  "B-KT 358",
];
