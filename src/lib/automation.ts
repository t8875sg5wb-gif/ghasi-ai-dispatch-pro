// ============================================================
// GHASI AI — Automation Center
// ------------------------------------------------------------
// Declares recurring jobs (billing, maintenance, patient transport,
// notifications, reports). NOTHING executes automatically — every
// job produces a proposal that waits for explicit human approval,
// consistent with the platform-wide AI safety rule.
// ============================================================
import { Receipt, Wrench, HeartPulse, BellRing, BarChart3, type LucideIcon } from "lucide-react";

export type AutomationKategorie =
  | "abrechnung"
  | "wartung"
  | "patiententransport"
  | "benachrichtigung"
  | "bericht";

export type AutomationRhythmus = "täglich" | "wöchentlich" | "monatlich" | "quartalsweise";

export type AutomationStatus = "aktiv" | "pausiert";

export interface Automation {
  id: string;
  name: string;
  kategorie: AutomationKategorie;
  rhythmus: AutomationRhythmus;
  status: AutomationStatus;
  beschreibung: string;
  /** human-readable next run, e.g. "Mo 06:00" */
  naechsteAusfuehrung: string;
  letzteAusfuehrung?: string;
  /** what the next run would propose (for the approval card) */
  vorschlag: string;
  /** how many drafts are waiting for approval */
  offeneFreigaben: number;
  to: string;
}

export interface KategorieMeta {
  label: string;
  icon: LucideIcon;
  badge: string;
}

export const AUTOMATION_KATEGORIE_META: Record<AutomationKategorie, KategorieMeta> = {
  abrechnung: {
    label: "Abrechnung",
    icon: Receipt,
    badge: "border-success/30 bg-success/10 text-success",
  },
  wartung: {
    label: "Wartung",
    icon: Wrench,
    badge: "border-warning/30 bg-warning/10 text-warning",
  },
  patiententransport: {
    label: "Patiententransport",
    icon: HeartPulse,
    badge: "border-info/30 bg-info/10 text-info",
  },
  benachrichtigung: {
    label: "Benachrichtigung",
    icon: BellRing,
    badge: "border-accent/30 bg-accent/10 text-accent",
  },
  bericht: {
    label: "Bericht",
    icon: BarChart3,
    badge: "border-primary/30 bg-primary/10 text-primary",
  },
};

export const AUTOMATION_STATUS_META: Record<
  AutomationStatus,
  { label: string; badge: string; dot: string }
> = {
  aktiv: {
    label: "Aktiv",
    badge: "border-success/30 bg-success/10 text-success",
    dot: "bg-success",
  },
  pausiert: {
    label: "Pausiert",
    badge: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

export const INITIAL_AUTOMATIONEN: Automation[] = [
  {
    id: "auto-1",
    name: "Monatliche Sammelrechnung Krankenkassen",
    kategorie: "abrechnung",
    rhythmus: "monatlich",
    status: "aktiv",
    beschreibung: "Bündelt alle abgeschlossenen Kassenfahrten des Monats zu Sammelrechnungen.",
    naechsteAusfuehrung: "01. des Monats, 07:00",
    letzteAusfuehrung: "01.06.2026",
    vorschlag: "3 Sammelrechnungen (AOK, TK, Barmer) als Entwurf vorbereitet.",
    offeneFreigaben: 3,
    to: "/rechnungen",
  },
  {
    id: "auto-2",
    name: "Wiederkehrende Dialyse-Touren",
    kategorie: "patiententransport",
    rhythmus: "wöchentlich",
    status: "aktiv",
    beschreibung: "Erzeugt Serientermine für regelmäßige Dialysepatienten (3× pro Woche).",
    naechsteAusfuehrung: "So 18:00 (für Folgewoche)",
    letzteAusfuehrung: "22.06.2026",
    vorschlag: "12 Dialysefahrten für M. Hoffmann als Entwurf eingeplant.",
    offeneFreigaben: 1,
    to: "/tourenplanung",
  },
  {
    id: "auto-3",
    name: "Wartungs- & TÜV-Erinnerungen",
    kategorie: "wartung",
    rhythmus: "wöchentlich",
    status: "aktiv",
    beschreibung: "Prüft anstehende Wartungen, TÜV und Versicherungsfristen der Flotte.",
    naechsteAusfuehrung: "Mo 06:00",
    letzteAusfuehrung: "23.06.2026",
    vorschlag: "Werkstatttermin für B-KT 204 (Reifen) vorschlagen.",
    offeneFreigaben: 2,
    to: "/wartung",
  },
  {
    id: "auto-4",
    name: "Mahnlauf offene Posten",
    kategorie: "benachrichtigung",
    rhythmus: "wöchentlich",
    status: "aktiv",
    beschreibung: "Erstellt Mahnungs-Entwürfe für überfällige Rechnungen (kein Auto-Versand).",
    naechsteAusfuehrung: "Mi 09:00",
    letzteAusfuehrung: "18.06.2026",
    vorschlag: "2 Zahlungserinnerungen (Sonnenhof, AOK) als Entwurf.",
    offeneFreigaben: 2,
    to: "/aktions-center",
  },
  {
    id: "auto-5",
    name: "Monatsbericht Geschäftsführung",
    kategorie: "bericht",
    rhythmus: "monatlich",
    status: "aktiv",
    beschreibung: "Erstellt Umsatz-, Gewinn- und Auslastungsbericht für die Geschäftsführung.",
    naechsteAusfuehrung: "01. des Monats, 08:00",
    letzteAusfuehrung: "01.06.2026",
    vorschlag: "Executive-Monatsbericht Mai als PDF-Entwurf bereit.",
    offeneFreigaben: 0,
    to: "/berichte",
  },
  {
    id: "auto-6",
    name: "Termin-Erinnerung an Patienten",
    kategorie: "benachrichtigung",
    rhythmus: "täglich",
    status: "pausiert",
    beschreibung: "Bereitet SMS/WhatsApp-Erinnerungen für Fahrten des Folgetags vor.",
    naechsteAusfuehrung: "Täglich 17:00",
    vorschlag: "Erinnerungen für 6 Fahrten morgen als Entwurf.",
    offeneFreigaben: 0,
    to: "/aktions-center",
  },
];

export function offeneFreigabenGesamt(autos: Automation[] = INITIAL_AUTOMATIONEN): number {
  return autos.reduce((s, a) => s + a.offeneFreigaben, 0);
}
