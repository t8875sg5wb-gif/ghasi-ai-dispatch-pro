// GHASI AI – Versicherungen.
// Verwaltet Fahrzeug- und Betriebsversicherungen und verknüpft sie mit der Flotte.
import { ShieldCheck, ShieldAlert, ShieldX, type LucideIcon } from "lucide-react";

export type VersicherungsArt =
  | "Haftpflicht"
  | "Vollkasko"
  | "Teilkasko"
  | "Insassenunfall"
  | "Betriebshaftpflicht"
  | "Rechtsschutz";

export type VersicherungsStatus = "aktiv" | "laeuft_ab" | "gekuendigt";

export interface Versicherung {
  id: string;
  versicherer: string;
  policennummer: string;
  art: VersicherungsArt;
  /** Fahrzeug-Kennzeichen oder "Flotte" für betriebsweite Policen */
  fahrzeug: string;
  beitragMonat: number;
  selbstbeteiligung: number;
  beginn: string; // ISO date
  ablauf: string; // ISO date
  status: VersicherungsStatus;
  notiz?: string;
}

export const VERSICHERUNGS_ARTEN: VersicherungsArt[] = [
  "Haftpflicht",
  "Vollkasko",
  "Teilkasko",
  "Insassenunfall",
  "Betriebshaftpflicht",
  "Rechtsschutz",
];

export const VERSICHERUNG_STATUS_META: Record<
  VersicherungsStatus,
  { label: string; badge: string; icon: LucideIcon }
> = {
  aktiv: {
    label: "Aktiv",
    badge: "bg-success/15 text-success border-success/30",
    icon: ShieldCheck,
  },
  laeuft_ab: {
    label: "Läuft ab",
    badge: "bg-warning/15 text-warning border-warning/30",
    icon: ShieldAlert,
  },
  gekuendigt: {
    label: "Gekündigt",
    badge: "bg-destructive/15 text-destructive border-destructive/30",
    icon: ShieldX,
  },
};

export const INITIAL_VERSICHERUNGEN: Versicherung[] = [
  {
    id: "vs-1",
    versicherer: "HUK-Coburg",
    policennummer: "HUK-9920-014",
    art: "Haftpflicht",
    fahrzeug: "B-KT 142",
    beitragMonat: 96,
    selbstbeteiligung: 0,
    beginn: "2024-01-01",
    ablauf: "2026-12-31",
    status: "aktiv",
    notiz: "SF-Klasse 12",
  },
  {
    id: "vs-2",
    versicherer: "HUK-Coburg",
    policennummer: "HUK-9920-014V",
    art: "Vollkasko",
    fahrzeug: "B-KT 142",
    beitragMonat: 78,
    selbstbeteiligung: 500,
    beginn: "2024-01-01",
    ablauf: "2026-12-31",
    status: "aktiv",
  },
  {
    id: "vs-3",
    versicherer: "Allianz",
    policennummer: "AZ-KT-0097",
    art: "Haftpflicht",
    fahrzeug: "B-KT 097",
    beitragMonat: 102,
    selbstbeteiligung: 0,
    beginn: "2023-07-01",
    ablauf: "2026-07-31",
    status: "laeuft_ab",
    notiz: "Verlängerung anstoßen",
  },
  {
    id: "vs-4",
    versicherer: "Allianz",
    policennummer: "AZ-KT-0204",
    art: "Teilkasko",
    fahrzeug: "B-KT 204",
    beitragMonat: 54,
    selbstbeteiligung: 300,
    beginn: "2024-03-01",
    ablauf: "2027-02-28",
    status: "aktiv",
  },
  {
    id: "vs-5",
    versicherer: "R+V Versicherung",
    policennummer: "RV-BTR-1001",
    art: "Betriebshaftpflicht",
    fahrzeug: "Flotte",
    beitragMonat: 240,
    selbstbeteiligung: 1000,
    beginn: "2024-01-01",
    ablauf: "2026-12-31",
    status: "aktiv",
    notiz: "Deckt gesamten Betrieb",
  },
  {
    id: "vs-6",
    versicherer: "ADAC",
    policennummer: "ADAC-RS-552",
    art: "Rechtsschutz",
    fahrzeug: "Flotte",
    beitragMonat: 65,
    selbstbeteiligung: 150,
    beginn: "2024-01-01",
    ablauf: "2026-12-31",
    status: "aktiv",
  },
];

export function nextVersicherungId(vorhandene: Versicherung[]): string {
  let max = 0;
  for (const v of vorhandene) {
    const n = Number(v.id.replace("vs-", ""));
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `vs-${max + 1}`;
}

/** Tage bis zum Ablauf (negativ = abgelaufen). */
export function tageBisAblauf(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/** Leitet den Status anhand des Ablaufdatums ab (außer gekündigt). */
export function abgeleiteterStatus(v: Versicherung): VersicherungsStatus {
  if (v.status === "gekuendigt") return "gekuendigt";
  const tage = tageBisAblauf(v.ablauf);
  if (tage < 0) return "gekuendigt";
  if (tage <= 60) return "laeuft_ab";
  return "aktiv";
}

export const formatEUR = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
