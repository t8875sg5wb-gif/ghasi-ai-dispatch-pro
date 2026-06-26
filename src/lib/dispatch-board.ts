// ============================================================
// GHASI AI – Enterprise Dispatch Board
// Additive Erweiterung des bestehenden Dispatch-Centers:
//  • feingranulares 12-Spalten-Live-Board (abgeleitet aus dem
//    bestehenden LiveStatus – keine neuen persistierten Status)
//  • Such- & Filter-Engine
//  • Bulk-Export (CSV / Excel / Druck-Routenblatt / Transportliste)
//  • Lösungsvorschläge für die Konflikte des Alarm-Centers
// Bestehende Module bleiben unverändert. Deterministisch & client-safe.
// ============================================================
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Flag,
  HeartPulse,
  Inbox,
  MapPin,
  Navigation,
  Receipt,
  Route as RouteIcon,
  Sparkles,
  ThumbsUp,
  Truck,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

import {
  type AuftragPrioritaet,
  type Mobilitaet,
  MOBILITAET_META,
  VERORDNUNG_META,
  effektiveMobilitaet,
  effektiveVerordnung,
  verordnungFehlt,
} from "@/lib/auftraege";
import type { DispatchTransport, KonfliktTyp, LiveStatus } from "@/lib/dispatch";

/* ------------------------------------------------------------------ *
 * 12-Spalten Live-Board
 * ------------------------------------------------------------------ */

export type BoardSpalte =
  | "warten"
  | "neu"
  | "geplant"
  | "zugewiesen"
  | "fahrer_akzeptiert"
  | "anfahrt"
  | "am_abholort"
  | "patient_an_bord"
  | "fahrt_ziel"
  | "am_ziel"
  | "abgeschlossen"
  | "abrechnung";

export interface BoardSpalteMeta {
  key: BoardSpalte;
  label: string;
  icon: LucideIcon;
  ton: string;
}

export const BOARD_SPALTEN: BoardSpalteMeta[] = [
  { key: "warten", label: "Wartend", icon: Clock, ton: "border-info/40" },
  { key: "neu", label: "Neu", icon: Inbox, ton: "border-info/40" },
  { key: "geplant", label: "Geplant", icon: CalendarClock, ton: "border-info/40" },
  { key: "zugewiesen", label: "Zugewiesen", icon: UserCheck, ton: "border-accent/40" },
  { key: "fahrer_akzeptiert", label: "Fahrer akzeptiert", icon: ThumbsUp, ton: "border-accent/40" },
  { key: "anfahrt", label: "Anfahrt Patient", icon: Navigation, ton: "border-warning/40" },
  { key: "am_abholort", label: "Am Abholort", icon: MapPin, ton: "border-warning/40" },
  { key: "patient_an_bord", label: "Patient an Bord", icon: HeartPulse, ton: "border-primary/40" },
  { key: "fahrt_ziel", label: "Fahrt zum Ziel", icon: RouteIcon, ton: "border-primary/40" },
  { key: "am_ziel", label: "Am Ziel", icon: Flag, ton: "border-success/40" },
  { key: "abgeschlossen", label: "Abgeschlossen", icon: CheckCircle2, ton: "border-success/40" },
  { key: "abrechnung", label: "Abrechnung bereit", icon: Receipt, ton: "border-success/40" },
];

const BOARD_LABEL: Record<BoardSpalte, string> = BOARD_SPALTEN.reduce(
  (acc, s) => {
    acc[s.key] = s.label;
    return acc;
  },
  {} as Record<BoardSpalte, string>,
);

export function boardSpalteLabel(key: BoardSpalte): string {
  return BOARD_LABEL[key];
}

/** Leitet die Board-Spalte deterministisch aus dem Live-Status ab. */
export function boardSpalteVon(t: DispatchTransport): BoardSpalte {
  switch (t.liveStatus) {
    case "abgeschlossen":
      return t.abrechnungBereit ? "abrechnung" : "abgeschlossen";
    case "storniert":
      return "abgeschlossen";
    case "am_ziel":
      return "am_ziel";
    case "in_fahrt":
    case "verspaetet":
      return "fahrt_ziel";
    case "patient_an_bord":
      return "patient_an_bord";
    case "am_abholort":
      return "am_abholort";
    case "anfahrt":
      return "anfahrt";
    case "fahrzeug_zugewiesen":
      return t.fahrerAkzeptiert ? "fahrer_akzeptiert" : "zugewiesen";
    case "fahrer_zugewiesen":
      return "zugewiesen";
    case "geplant":
    default:
      if (!t.fahrer && !t.fahrzeug) {
        return t.status === "neu" ? "neu" : "warten";
      }
      return "geplant";
  }
}

/** Patch, der einen Transport in die Zielspalte überführt (für Drag & Drop). */
export function boardSpaltePatch(spalte: BoardSpalte): Partial<DispatchTransport> {
  const live = (s: LiveStatus): Partial<DispatchTransport> => ({
    liveStatus: s,
    fahrerAkzeptiert: false,
    abrechnungBereit: false,
  });
  switch (spalte) {
    case "warten":
    case "neu":
    case "geplant":
      return live("geplant");
    case "zugewiesen":
      return live("fahrzeug_zugewiesen");
    case "fahrer_akzeptiert":
      return { liveStatus: "fahrzeug_zugewiesen", fahrerAkzeptiert: true, abrechnungBereit: false };
    case "anfahrt":
      return live("anfahrt");
    case "am_abholort":
      return live("am_abholort");
    case "patient_an_bord":
      return live("patient_an_bord");
    case "fahrt_ziel":
      return { liveStatus: "in_fahrt", fahrerAkzeptiert: true, abrechnungBereit: false, verspaetungMin: 0 };
    case "am_ziel":
      return live("am_ziel");
    case "abgeschlossen":
      return { liveStatus: "abgeschlossen", fahrerAkzeptiert: true, abrechnungBereit: false };
    case "abrechnung":
      return { liveStatus: "abgeschlossen", fahrerAkzeptiert: true, abrechnungBereit: true };
    default:
      return {};
  }
}

/* ------------------------------------------------------------------ *
 * Such- & Filter-Engine
 * ------------------------------------------------------------------ */

export interface DispatchFilter {
  text: string;
  fahrer: string | null;
  fahrzeug: string | null;
  kostentraeger: string | null;
  prioritaet: AuftragPrioritaet | null;
  spalte: BoardSpalte | null;
  verordnung: "ok" | "fehlt" | null;
  mobilitaet: Mobilitaet | null;
  begleitung: "ja" | "nein" | null;
  tageszeit: "vormittag" | "nachmittag" | null;
}

export const LEERER_FILTER: DispatchFilter = {
  text: "",
  fahrer: null,
  fahrzeug: null,
  kostentraeger: null,
  prioritaet: null,
  spalte: null,
  verordnung: null,
  mobilitaet: null,
  begleitung: null,
  tageszeit: null,
};

export function filterAktiv(f: DispatchFilter): boolean {
  return (
    f.text.trim() !== "" ||
    f.fahrer !== null ||
    f.fahrzeug !== null ||
    f.kostentraeger !== null ||
    f.prioritaet !== null ||
    f.spalte !== null ||
    f.verordnung !== null ||
    f.mobilitaet !== null ||
    f.begleitung !== null ||
    f.tageszeit !== null
  );
}

export function aktiveFilterAnzahl(f: DispatchFilter): number {
  let n = 0;
  if (f.text.trim() !== "") n += 1;
  if (f.fahrer) n += 1;
  if (f.fahrzeug) n += 1;
  if (f.kostentraeger) n += 1;
  if (f.prioritaet) n += 1;
  if (f.spalte) n += 1;
  if (f.verordnung) n += 1;
  if (f.mobilitaet) n += 1;
  if (f.begleitung) n += 1;
  if (f.tageszeit) n += 1;
  return n;
}

function stunde(hhmm: string): number {
  const [h] = hhmm.split(":");
  return parseInt(h, 10) || 0;
}

export function wendeFilterAn(
  transporte: DispatchTransport[],
  f: DispatchFilter,
): DispatchTransport[] {
  const q = f.text.trim().toLowerCase();
  return transporte.filter((t) => {
    if (q) {
      const heu = [
        t.nummer,
        t.patient,
        t.abholort,
        t.zielort,
        t.kostentraeger,
        t.fahrer ?? "",
        t.fahrzeug ?? "",
        t.serie ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!heu.includes(q)) return false;
    }
    if (f.fahrer && t.fahrer !== f.fahrer) return false;
    if (f.fahrzeug && t.fahrzeug !== f.fahrzeug) return false;
    if (f.kostentraeger && t.kostentraeger !== f.kostentraeger) return false;
    if (f.prioritaet && t.prioritaet !== f.prioritaet) return false;
    if (f.spalte && boardSpalteVon(t) !== f.spalte) return false;
    if (f.verordnung) {
      const fehlt = verordnungFehlt(effektiveVerordnung(t));
      if (f.verordnung === "fehlt" && !fehlt) return false;
      if (f.verordnung === "ok" && fehlt) return false;
    }
    if (f.mobilitaet && effektiveMobilitaet(t) !== f.mobilitaet) return false;
    if (f.begleitung) {
      const hat = Boolean(t.begleitperson);
      if (f.begleitung === "ja" && !hat) return false;
      if (f.begleitung === "nein" && hat) return false;
    }
    if (f.tageszeit) {
      const h = stunde(t.abholzeit);
      if (f.tageszeit === "vormittag" && h >= 12) return false;
      if (f.tageszeit === "nachmittag" && h < 12) return false;
    }
    return true;
  });
}

/* ------------------------------------------------------------------ *
 * Schnellbefehle (lokale KI-Befehle für die Plantafel)
 * ------------------------------------------------------------------ */

export interface Schnellbefehl {
  id: string;
  label: string;
  icon: LucideIcon;
  patch: Partial<DispatchFilter>;
}

export const SCHNELLBEFEHLE: Schnellbefehl[] = [
  {
    id: "verspaetet",
    label: "Verspätete Transporte",
    icon: Clock,
    patch: { spalte: null, prioritaet: null, text: "" },
  },
  {
    id: "verordnung_fehlt",
    label: "Fehlende Verordnungen",
    icon: Sparkles,
    patch: { verordnung: "fehlt" },
  },
  {
    id: "rollstuhl",
    label: "Rollstuhl-Transporte",
    icon: Sparkles,
    patch: { mobilitaet: "rollstuhl" },
  },
  {
    id: "liegend",
    label: "Liegendtransporte",
    icon: Sparkles,
    patch: { mobilitaet: "liegend" },
  },
  {
    id: "abrechnung",
    label: "Abrechnung bereit",
    icon: Receipt,
    patch: { spalte: "abrechnung" },
  },
  {
    id: "begleitung",
    label: "Mit Begleitperson",
    icon: UserCheck,
    patch: { begleitung: "ja" },
  },
];

/* ------------------------------------------------------------------ *
 * Konflikt-Lösungsvorschläge (Alarm-Center)
 * ------------------------------------------------------------------ */

export const KONFLIKT_LOESUNG: Record<KonfliktTyp, string> = {
  doppelbuchung: "Einen der Transporte auf einen freien Fahrer umdisponieren oder Zeitfenster anpassen.",
  fahrer_nicht_verfuegbar: "Verfügbaren Fahrer per KI-Vorschlag zuweisen.",
  fahrzeug_nicht_verfuegbar: "Einsatzbereites Ersatzfahrzeug zuteilen.",
  ueberstunden: "Transport auf einen Fahrer mit freier Kapazität verteilen.",
  dokument: "Verordnung beim Kostenträger/Arzt anfordern, bevor der Fahrer startet.",
  wartung: "Fahrzeug vor Abfahrt tanken bzw. Wartungs-/TÜV-Termin einplanen.",
  verspaetung: "Patient & Zielort informieren, ggf. nächstgelegenes Fahrzeug nachsteuern.",
  ungeeignet: "Passendes Fahrzeug für die Mobilität des Patienten zuweisen.",
};

/* ------------------------------------------------------------------ *
 * Bulk-Export: CSV / Excel / Druck-Routenblatt
 * ------------------------------------------------------------------ */

const EXPORT_SPALTEN: { titel: string; wert: (t: DispatchTransport) => string }[] = [
  { titel: "Nummer", wert: (t) => t.nummer },
  { titel: "Patient", wert: (t) => t.patient },
  { titel: "Abholort", wert: (t) => t.abholort },
  { titel: "Zielort", wert: (t) => t.zielort },
  { titel: "Abholzeit", wert: (t) => t.abholzeit },
  { titel: "Ankunft", wert: (t) => t.ankunftzeit },
  { titel: "Fahrer", wert: (t) => t.fahrer ?? "—" },
  { titel: "Fahrzeug", wert: (t) => t.fahrzeug ?? "—" },
  { titel: "Priorität", wert: (t) => t.prioritaet },
  { titel: "Kostenträger", wert: (t) => t.kostentraeger },
  { titel: "Status", wert: (t) => boardSpalteLabel(boardSpalteVon(t)) },
  {
    titel: "Verordnung",
    wert: (t) => VERORDNUNG_META[effektiveVerordnung(t)].kurz,
  },
  { titel: "Mobilität", wert: (t) => MOBILITAET_META[effektiveMobilitaet(t)].kurz },
  { titel: "Begleitung", wert: (t) => (t.begleitperson ? "Ja" : "Nein") },
  { titel: "Distanz (km)", wert: (t) => String(t.distanzKm) },
  { titel: "Erlös (EUR)", wert: (t) => String(t.erloes) },
];

function escapeCsv(value: string): string {
  if (/[";\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function transporteAlsCsv(transporte: DispatchTransport[]): string {
  const kopf = EXPORT_SPALTEN.map((s) => s.titel).join(";");
  const zeilen = transporte.map((t) =>
    EXPORT_SPALTEN.map((s) => escapeCsv(s.wert(t))).join(";"),
  );
  return [kopf, ...zeilen].join("\r\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function ladeDatei(name: string, inhalt: string, mime: string) {
  if (typeof document === "undefined") return;
  const blob = new Blob(["\ufeff" + inhalt], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const heute = () => new Date().toISOString().slice(0, 10);

export function exportiereCsv(transporte: DispatchTransport[]) {
  ladeDatei(`dispatch-${heute()}.csv`, transporteAlsCsv(transporte), "text/csv");
}

/** Excel-kompatibler Export über eine HTML-Tabelle (.xls öffnet in Excel). */
export function exportiereExcel(transporte: DispatchTransport[]) {
  const kopf = EXPORT_SPALTEN.map((s) => `<th>${escapeHtml(s.titel)}</th>`).join("");
  const zeilen = transporte
    .map(
      (t) =>
        `<tr>${EXPORT_SPALTEN.map((s) => `<td>${escapeHtml(s.wert(t))}</td>`).join("")}</tr>`,
    )
    .join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8" /></head><body><table border="1"><thead><tr>${kopf}</tr></thead><tbody>${zeilen}</tbody></table></body></html>`;
  ladeDatei(`dispatch-${heute()}.xls`, html, "application/vnd.ms-excel");
}

/** Öffnet ein druckfertiges Routenblatt (Browser-Druck → „Als PDF speichern"). */
export function druckeRoutenblatt(transporte: DispatchTransport[]) {
  if (typeof window === "undefined") return;
  const fenster = window.open("", "_blank", "width=900,height=1200");
  if (!fenster) return;
  const datum = new Date().toLocaleString("de-DE");
  const karten = transporte
    .map((t) => {
      const mob = MOBILITAET_META[effektiveMobilitaet(t)].label;
      const ver = VERORDNUNG_META[effektiveVerordnung(t)].label;
      return `
        <div class="karte">
          <div class="kopf">
            <span class="nr">${escapeHtml(t.nummer)}</span>
            <span class="zeit">${escapeHtml(t.abholzeit)} → ${escapeHtml(t.ankunftzeit)}</span>
          </div>
          <div class="patient">${escapeHtml(t.patient)}</div>
          <div class="route">
            <div><b>Von:</b> ${escapeHtml(t.abholort)}</div>
            <div><b>Nach:</b> ${escapeHtml(t.zielort)}</div>
          </div>
          <div class="meta">
            <span><b>Fahrer:</b> ${escapeHtml(t.fahrer ?? "—")}</span>
            <span><b>Fahrzeug:</b> ${escapeHtml(t.fahrzeug ?? "—")}</span>
            <span><b>Mobilität:</b> ${escapeHtml(mob)}</span>
            <span><b>Begleitung:</b> ${t.begleitperson ? "Ja" : "Nein"}</span>
            <span><b>Verordnung:</b> ${escapeHtml(ver)}</span>
            <span><b>Kostenträger:</b> ${escapeHtml(t.kostentraeger)}</span>
          </div>
          ${
            t.medizinischeNotiz
              ? `<div class="notiz"><b>Medizinisch:</b> ${escapeHtml(t.medizinischeNotiz)}</div>`
              : ""
          }
          <div class="sign">Unterschrift Patient/Übergabe: ______________________________</div>
        </div>`;
    })
    .join("");
  fenster.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8" />
    <title>GHASI AI – Routenblatt ${escapeHtml(datum)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #0f172a; margin: 24px; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      .sub { color: #64748b; font-size: 12px; margin-bottom: 16px; }
      .karte { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; page-break-inside: avoid; }
      .kopf { display: flex; justify-content: space-between; font-weight: 700; }
      .nr { color: #1d4ed8; }
      .zeit { font-variant-numeric: tabular-nums; }
      .patient { font-size: 15px; font-weight: 600; margin: 4px 0; }
      .route div { font-size: 13px; }
      .meta { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 8px; font-size: 12px; color: #334155; }
      .notiz { margin-top: 8px; font-size: 12px; color: #b45309; }
      .sign { margin-top: 12px; font-size: 12px; color: #475569; }
      @media print { .karte { border-color: #94a3b8; } }
    </style></head><body>
    <h1>GHASI AI – Routenblatt / Transportliste</h1>
    <div class="sub">${transporte.length} Transporte · Stand ${escapeHtml(datum)}</div>
    ${karten}
    <script>window.onload = function () { window.print(); };</script>
    </body></html>`);
  fenster.document.close();
}
