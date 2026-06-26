// GHASI AI – Telefonie.
// Anrufprotokoll, Rückrufliste, Gesprächsnotizen und Anrufstatistik.
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Voicemail,
  type LucideIcon,
} from "lucide-react";

export type AnrufRichtung = "eingehend" | "ausgehend" | "verpasst" | "voicemail";

export type AnrufStatus = "offen" | "rueckruf" | "erledigt";

export type AnrufKategorie =
  | "Auftrag"
  | "Rückfrage"
  | "Terminänderung"
  | "Beschwerde"
  | "Sonstige";

export interface Anruf {
  id: string;
  richtung: AnrufRichtung;
  nummer: string;
  name?: string;
  /** ISO datetime */
  zeitpunkt: string;
  /** Gesprächsdauer in Sekunden */
  dauerSek: number;
  kategorie: AnrufKategorie;
  status: AnrufStatus;
  notiz?: string;
  /** Wurde aus diesem Anruf ein Auftrag erstellt? */
  auftragErstellt?: boolean;
}

export const ANRUF_RICHTUNG_META: Record<
  AnrufRichtung,
  { label: string; icon: LucideIcon; color: string }
> = {
  eingehend: { label: "Eingehend", icon: PhoneIncoming, color: "text-success" },
  ausgehend: { label: "Ausgehend", icon: PhoneOutgoing, color: "text-primary" },
  verpasst: { label: "Verpasst", icon: PhoneMissed, color: "text-destructive" },
  voicemail: { label: "Voicemail", icon: Voicemail, color: "text-warning" },
};

export const ANRUF_STATUS_META: Record<AnrufStatus, { label: string; badge: string }> = {
  offen: { label: "Offen", badge: "bg-warning/15 text-warning border-warning/30" },
  rueckruf: { label: "Rückruf nötig", badge: "bg-destructive/15 text-destructive border-destructive/30" },
  erledigt: { label: "Erledigt", badge: "bg-success/15 text-success border-success/30" },
};

export const ANRUF_KATEGORIEN: AnrufKategorie[] = [
  "Auftrag",
  "Rückfrage",
  "Terminänderung",
  "Beschwerde",
  "Sonstige",
];

function iso(minutenZurueck: number): string {
  return new Date(Date.now() - minutenZurueck * 60_000).toISOString();
}

export const INITIAL_ANRUFE: Anruf[] = [
  { id: "an-1", richtung: "eingehend", nummer: "030 9100100", name: "Dialysezentrum Nord", zeitpunkt: iso(18), dauerSek: 214, kategorie: "Auftrag", status: "erledigt", notiz: "Sammeltour Schicht 11:30 bestätigt.", auftragErstellt: true },
  { id: "an-2", richtung: "verpasst", nummer: "030 1234503", name: "Pflegeheim Sonnenhof", zeitpunkt: iso(42), dauerSek: 0, kategorie: "Terminänderung", status: "rueckruf", notiz: "Rückruf wegen verschobenem Arzttermin." },
  { id: "an-3", richtung: "ausgehend", nummer: "0151 22233344", name: "Margarete Hoffmann", zeitpunkt: iso(75), dauerSek: 96, kategorie: "Rückfrage", status: "erledigt", notiz: "Abholzeit für morgen bestätigt." },
  { id: "an-4", richtung: "voicemail", nummer: "030 9000200", name: "Augenklinik Mitte", zeitpunkt: iso(130), dauerSek: 38, kategorie: "Auftrag", status: "offen", notiz: "VM: Rücktransport nach ambulanter OP gewünscht." },
  { id: "an-5", richtung: "eingehend", nummer: "0170 99887766", name: undefined, zeitpunkt: iso(190), dauerSek: 152, kategorie: "Beschwerde", status: "offen", notiz: "Wartezeit beim letzten Transport zu lang – klären." },
  { id: "an-6", richtung: "eingehend", nummer: "030 1234500", name: "AOK Nordost", zeitpunkt: iso(240), dauerSek: 305, kategorie: "Rückfrage", status: "erledigt", notiz: "Abrechnungsrückfrage geklärt." },
];

export function nextAnrufId(vorhandene: Anruf[]): string {
  let max = 0;
  for (const a of vorhandene) {
    const n = Number(a.id.replace("an-", ""));
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `an-${max + 1}`;
}

export function formatDauer(sek: number): string {
  if (sek <= 0) return "—";
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${m}:${String(s).padStart(2, "0")} min`;
}

export function formatZeitpunkt(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface AnrufStatistik {
  gesamt: number;
  eingehend: number;
  ausgehend: number;
  verpasst: number;
  offen: number;
  schnittDauer: number;
}

export function berechneStatistik(anrufe: Anruf[]): AnrufStatistik {
  const beantwortet = anrufe.filter((a) => a.dauerSek > 0);
  const schnitt =
    beantwortet.length > 0
      ? Math.round(beantwortet.reduce((s, a) => s + a.dauerSek, 0) / beantwortet.length)
      : 0;
  return {
    gesamt: anrufe.length,
    eingehend: anrufe.filter((a) => a.richtung === "eingehend").length,
    ausgehend: anrufe.filter((a) => a.richtung === "ausgehend").length,
    verpasst: anrufe.filter((a) => a.richtung === "verpasst" || a.richtung === "voicemail").length,
    offen: anrufe.filter((a) => a.status !== "erledigt").length,
    schnittDauer: schnitt,
  };
}
