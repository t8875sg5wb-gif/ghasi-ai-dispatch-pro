// ============================================================
// GHASI AI — Enterprise Document Management
// ------------------------------------------------------------
// One central document center for the whole platform. Every
// document is categorised, taggable, versioned and linkable to a
// business object (patient, customer, driver, vehicle, transport,
// invoice, maintenance). Designed OCR-ready and audit-friendly.
//
// This module ships a deterministic seed index and pure helpers
// (search, filter, grouping). Upload/preview wiring lives in the UI
// and can later be connected to real storage without touching the
// data shape. Existing modules stay untouched.
// ============================================================
import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  ClipboardList,
  Stethoscope,
  ScrollText,
  Receipt,
  FileMinus,
  IdCard,
  Car,
  ShieldCheck,
  Wrench,
  FolderArchive,
  type LucideIcon,
} from "lucide-react";

export type DokumentKategorie =
  | "rezept"
  | "transportauftrag"
  | "patientendokument"
  | "vertrag"
  | "rechnung"
  | "gutschrift"
  | "fahrerdokument"
  | "fahrzeugdokument"
  | "versicherung"
  | "wartungsbeleg";

export type DokumentFormat = "pdf" | "bild" | "tabelle" | "text";

export type DokumentBezugTyp =
  | "patient"
  | "kunde"
  | "fahrer"
  | "fahrzeug"
  | "transport"
  | "rechnung"
  | "wartung";

export interface DokumentBezug {
  typ: DokumentBezugTyp;
  label: string;
  to: string;
}

export interface DokumentVersion {
  version: number;
  datum: string; // ISO
  von: string;
  notiz: string;
  groesseKb: number;
}

export interface Dokument {
  id: string;
  name: string;
  kategorie: DokumentKategorie;
  format: DokumentFormat;
  ordner: string;
  tags: string[];
  bezug?: DokumentBezug;
  hochgeladenVon: string;
  hochgeladenAm: string; // ISO
  /** OCR text already extracted (OCR-ready) */
  ocrText?: string;
  versionen: DokumentVersion[];
}

export interface KategorieMeta {
  label: string;
  icon: LucideIcon;
  badge: string;
}

export const KATEGORIE_META: Record<DokumentKategorie, KategorieMeta> = {
  rezept: {
    label: "Rezept / Verordnung",
    icon: Stethoscope,
    badge: "border-info/30 bg-info/10 text-info",
  },
  transportauftrag: {
    label: "Transportauftrag",
    icon: ClipboardList,
    badge: "border-accent/30 bg-accent/10 text-accent",
  },
  patientendokument: {
    label: "Patientendokument",
    icon: FileText,
    badge: "border-info/30 bg-info/10 text-info",
  },
  vertrag: {
    label: "Vertrag",
    icon: ScrollText,
    badge: "border-primary/30 bg-primary/10 text-primary",
  },
  rechnung: {
    label: "Rechnung",
    icon: Receipt,
    badge: "border-success/30 bg-success/10 text-success",
  },
  gutschrift: {
    label: "Gutschrift",
    icon: FileMinus,
    badge: "border-warning/30 bg-warning/10 text-warning",
  },
  fahrerdokument: {
    label: "Fahrerdokument",
    icon: IdCard,
    badge: "border-accent/30 bg-accent/10 text-accent",
  },
  fahrzeugdokument: {
    label: "Fahrzeugdokument",
    icon: Car,
    badge: "border-info/30 bg-info/10 text-info",
  },
  versicherung: {
    label: "Versicherung",
    icon: ShieldCheck,
    badge: "border-primary/30 bg-primary/10 text-primary",
  },
  wartungsbeleg: {
    label: "Wartungsbeleg",
    icon: Wrench,
    badge: "border-warning/30 bg-warning/10 text-warning",
  },
};

export const DOKUMENT_KATEGORIEN: DokumentKategorie[] = [
  "rezept",
  "transportauftrag",
  "patientendokument",
  "vertrag",
  "rechnung",
  "gutschrift",
  "fahrerdokument",
  "fahrzeugdokument",
  "versicherung",
  "wartungsbeleg",
];

export const FORMAT_META: Record<DokumentFormat, { label: string; icon: LucideIcon }> = {
  pdf: { label: "PDF", icon: FileText },
  bild: { label: "Bild", icon: ImageIcon },
  tabelle: { label: "Tabelle", icon: FileSpreadsheet },
  text: { label: "Text", icon: FolderArchive },
};

export function formatDatum(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function aktuelleVersion(d: Dokument): DokumentVersion {
  return d.versionen[d.versionen.length - 1];
}

export function formatGroesse(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

const v = (
  version: number,
  datum: string,
  von: string,
  notiz: string,
  groesseKb: number,
): DokumentVersion => ({
  version,
  datum,
  von,
  notiz,
  groesseKb,
});

export const INITIAL_DOKUMENTE: Dokument[] = [
  {
    id: "d-1",
    name: "Verordnung Krankenfahrt – M. Hoffmann.pdf",
    kategorie: "rezept",
    format: "pdf",
    ordner: "Patienten/Hoffmann",
    tags: ["dialyse", "verordnung", "aok"],
    bezug: { typ: "patient", label: "Margarete Hoffmann", to: "/patienten" },
    hochgeladenVon: "Disposition",
    hochgeladenAm: "2026-06-02",
    ocrText:
      "Verordnung einer Krankenbeförderung, Dialyse, 3× wöchentlich, Kostenträger AOK Nordost.",
    versionen: [v(1, "2026-06-02", "Disposition", "Erstupload", 240)],
  },
  {
    id: "d-2",
    name: "Transportauftrag A-2042.pdf",
    kategorie: "transportauftrag",
    format: "pdf",
    ordner: "Transporte/2026-06",
    tags: ["liegendtransport", "klinikum-west"],
    bezug: { typ: "transport", label: "A-2042 · Johann Bauer", to: "/auftraege" },
    hochgeladenVon: "GHASI AI",
    hochgeladenAm: "2026-06-10",
    versionen: [v(1, "2026-06-10", "GHASI AI", "Automatisch erzeugt", 120)],
  },
  {
    id: "d-3",
    name: "Rahmenvertrag Klinikum West.pdf",
    kategorie: "vertrag",
    format: "pdf",
    ordner: "Kunden/Klinikum West",
    tags: ["rahmenvertrag", "konditionen", "2026"],
    bezug: { typ: "kunde", label: "Klinikum West", to: "/kunden" },
    hochgeladenVon: "Verwaltung",
    hochgeladenAm: "2026-01-15",
    versionen: [
      v(1, "2025-01-10", "Verwaltung", "Vertrag 2025", 980),
      v(2, "2026-01-15", "Verwaltung", "Konditionen 2026 aktualisiert", 1024),
    ],
  },
  {
    id: "d-4",
    name: "Rechnung RE-2026-0045.pdf",
    kategorie: "rechnung",
    format: "pdf",
    ordner: "Finanzen/Rechnungen/2026-06",
    tags: ["klinikum-west", "offen"],
    bezug: { typ: "rechnung", label: "RE-2026-0045", to: "/rechnungen" },
    hochgeladenVon: "Buchhaltung",
    hochgeladenAm: "2026-06-15",
    versionen: [v(1, "2026-06-15", "Buchhaltung", "Erstellt", 88)],
  },
  {
    id: "d-5",
    name: "Führerschein – M. Keller.jpg",
    kategorie: "fahrerdokument",
    format: "bild",
    ordner: "Fahrer/Keller",
    tags: ["führerschein", "klasse-b", "ablauf-2028"],
    bezug: { typ: "fahrer", label: "M. Keller", to: "/fahrer" },
    hochgeladenVon: "Personal",
    hochgeladenAm: "2026-03-01",
    ocrText: "Führerschein Klasse B, C1, gültig bis 2028.",
    versionen: [v(1, "2026-03-01", "Personal", "Scan", 640)],
  },
  {
    id: "d-6",
    name: "Fahrzeugschein B-KT 142.pdf",
    kategorie: "fahrzeugdokument",
    format: "pdf",
    ordner: "Fahrzeuge/B-KT 142",
    tags: ["zulassung", "sprinter"],
    bezug: { typ: "fahrzeug", label: "B-KT 142", to: "/fahrzeuge" },
    hochgeladenVon: "Verwaltung",
    hochgeladenAm: "2026-02-20",
    versionen: [v(1, "2026-02-20", "Verwaltung", "Erstupload", 210)],
  },
  {
    id: "d-7",
    name: "Versicherungspolice HUK – Flotte.pdf",
    kategorie: "versicherung",
    format: "pdf",
    ordner: "Versicherung/2026",
    tags: ["huk-coburg", "flotte", "police"],
    bezug: { typ: "fahrzeug", label: "B-KT 142", to: "/versicherungen" },
    hochgeladenVon: "Verwaltung",
    hochgeladenAm: "2026-01-02",
    versionen: [v(1, "2026-01-02", "Verwaltung", "Police 2026", 540)],
  },
  {
    id: "d-8",
    name: "Werkstattrechnung Bremsen B-KT 142.pdf",
    kategorie: "wartungsbeleg",
    format: "pdf",
    ordner: "Wartung/B-KT 142",
    tags: ["bremsen", "reparatur", "540eur"],
    bezug: { typ: "wartung", label: "B-KT 142 · Bremsen", to: "/wartung" },
    hochgeladenVon: "Werkstatt",
    hochgeladenAm: "2026-02-11",
    ocrText: "Bremsen vorne erneuert, Gesamtbetrag 540,00 EUR.",
    versionen: [v(1, "2026-02-11", "Werkstatt", "Beleg", 96)],
  },
  {
    id: "d-9",
    name: "Patientenakte – J. Bauer.pdf",
    kategorie: "patientendokument",
    format: "pdf",
    ordner: "Patienten/Bauer",
    tags: ["sauerstoff", "liegend", "tk"],
    bezug: { typ: "patient", label: "Johann Bauer", to: "/patienten" },
    hochgeladenVon: "Disposition",
    hochgeladenAm: "2026-05-18",
    versionen: [v(1, "2026-05-18", "Disposition", "Erstupload", 320)],
  },
  {
    id: "d-10",
    name: "Gutschrift GU-2026-0007.pdf",
    kategorie: "gutschrift",
    format: "pdf",
    ordner: "Finanzen/Gutschriften/2026-05",
    tags: ["sonnenhof", "storno"],
    bezug: { typ: "rechnung", label: "GU-2026-0007", to: "/rechnungen" },
    hochgeladenVon: "Buchhaltung",
    hochgeladenAm: "2026-05-20",
    versionen: [v(1, "2026-05-20", "Buchhaltung", "Erstellt", 72)],
  },
];

let idCounter = 100;
export function nextDokumentId(): string {
  idCounter += 1;
  return `d-${idCounter}`;
}

export function searchDokumente(
  query: string,
  kategorie: DokumentKategorie | "alle" = "alle",
  dokumente: Dokument[] = INITIAL_DOKUMENTE,
): Dokument[] {
  const q = query.trim().toLowerCase();
  return dokumente.filter((d) => {
    if (kategorie !== "alle" && d.kategorie !== kategorie) return false;
    if (!q) return true;
    const hay =
      `${d.name} ${d.ordner} ${d.tags.join(" ")} ${d.bezug?.label ?? ""} ${d.ocrText ?? ""}`.toLowerCase();
    return q.split(/\s+/).every((t) => hay.includes(t));
  });
}

export interface OrdnerKnoten {
  ordner: string;
  anzahl: number;
}

export function ordnerStruktur(dokumente: Dokument[] = INITIAL_DOKUMENTE): OrdnerKnoten[] {
  const map = new Map<string, number>();
  for (const d of dokumente) {
    const top = d.ordner.split("/")[0];
    map.set(top, (map.get(top) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([ordner, anzahl]) => ({ ordner, anzahl }))
    .sort((a, b) => b.anzahl - a.anzahl);
}
