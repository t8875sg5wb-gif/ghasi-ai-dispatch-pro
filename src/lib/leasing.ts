// GHASI AI – Leasing.
// Verwaltet Leasing- und Finanzierungsverträge der Fahrzeugflotte.
import { CheckCircle2, AlertTriangle, XCircle, type LucideIcon } from "lucide-react";

export type LeasingStatus = "aktiv" | "endet_bald" | "beendet";

export interface Leasingvertrag {
  id: string;
  leasinggeber: string;
  vertragsnummer: string;
  /** Fahrzeug-Kennzeichen */
  fahrzeug: string;
  rateMonat: number;
  beginn: string; // ISO date
  ende: string; // ISO date
  restwert: number;
  laufzeitMonate: number;
  kmInklusive: number;
  kmAktuell: number;
  status: LeasingStatus;
  notiz?: string;
}

export const LEASING_STATUS_META: Record<
  LeasingStatus,
  { label: string; badge: string; icon: LucideIcon }
> = {
  aktiv: {
    label: "Aktiv",
    badge: "bg-success/15 text-success border-success/30",
    icon: CheckCircle2,
  },
  endet_bald: {
    label: "Endet bald",
    badge: "bg-warning/15 text-warning border-warning/30",
    icon: AlertTriangle,
  },
  beendet: {
    label: "Beendet",
    badge: "bg-muted text-muted-foreground border-border",
    icon: XCircle,
  },
};

export const INITIAL_LEASING: Leasingvertrag[] = [
  {
    id: "ls-1",
    leasinggeber: "Mercedes-Benz Financial",
    vertragsnummer: "MBFS-2024-0142",
    fahrzeug: "B-KT 142",
    rateMonat: 689,
    beginn: "2024-01-15",
    ende: "2027-01-14",
    restwert: 14500,
    laufzeitMonate: 36,
    kmInklusive: 90000,
    kmAktuell: 41200,
    status: "aktiv",
    notiz: "Wartungspaket inklusive",
  },
  {
    id: "ls-2",
    leasinggeber: "VW Leasing",
    vertragsnummer: "VWL-2023-0097",
    fahrzeug: "B-KT 097",
    rateMonat: 542,
    beginn: "2023-04-01",
    ende: "2026-09-30",
    restwert: 11200,
    laufzeitMonate: 42,
    kmInklusive: 120000,
    kmAktuell: 98700,
    status: "endet_bald",
    notiz: "Kilometerstand prüfen – Mehrkilometer drohen",
  },
  {
    id: "ls-3",
    leasinggeber: "Ford Lease",
    vertragsnummer: "FL-2024-0204",
    fahrzeug: "B-KT 204",
    rateMonat: 478,
    beginn: "2024-03-01",
    ende: "2027-02-28",
    restwert: 9800,
    laufzeitMonate: 36,
    kmInklusive: 75000,
    kmAktuell: 28400,
    status: "aktiv",
  },
  {
    id: "ls-4",
    leasinggeber: "Mercedes-Benz Financial",
    vertragsnummer: "MBFS-2024-0311",
    fahrzeug: "B-KT 311",
    rateMonat: 712,
    beginn: "2024-06-01",
    ende: "2027-05-31",
    restwert: 15900,
    laufzeitMonate: 36,
    kmInklusive: 90000,
    kmAktuell: 19800,
    status: "aktiv",
    notiz: "Liegendtransport-Umbau finanziert",
  },
  {
    id: "ls-5",
    leasinggeber: "ALD Automotive",
    vertragsnummer: "ALD-2022-0358",
    fahrzeug: "B-KT 358",
    rateMonat: 399,
    beginn: "2022-10-01",
    ende: "2026-07-31",
    restwert: 7600,
    laufzeitMonate: 46,
    kmInklusive: 130000,
    kmAktuell: 121500,
    status: "endet_bald",
    notiz: "Anschlussfahrzeug planen",
  },
];

export function nextLeasingId(vorhandene: Leasingvertrag[]): string {
  let max = 0;
  for (const l of vorhandene) {
    const n = Number(l.id.replace("ls-", ""));
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `ls-${max + 1}`;
}

export function tageBisEnde(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/** Auslastung der Inklusiv-Kilometer in Prozent. */
export function kmAuslastung(l: Leasingvertrag): number {
  if (l.kmInklusive <= 0) return 0;
  return Math.round((l.kmAktuell / l.kmInklusive) * 100);
}

export function abgeleiteterLeasingStatus(l: Leasingvertrag): LeasingStatus {
  if (l.status === "beendet") return "beendet";
  const tage = tageBisEnde(l.ende);
  if (tage < 0) return "beendet";
  if (tage <= 120 || kmAuslastung(l) >= 90) return "endet_bald";
  return "aktiv";
}

export const formatEUR = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
