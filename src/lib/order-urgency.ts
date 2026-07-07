// Dringlichkeit, Warnstufen, Countdown und Datums-Gruppierung für Aufträge.
//
// Kernregeln (laut Anforderung):
//   > 60 Min vor Termin & nicht zugewiesen  → normal
//   ≤ 60 Min vor Termin & nicht zugewiesen  → gelb  (Warnung)
//   ≤ 30 Min vor Termin & nicht zugewiesen  → orange (Warnung)
//   ≤ 15 Min vor Termin & nicht zugewiesen  → rot   (kritisch)
//   nach Termin & weiterhin nicht zugewiesen → überfällig (kritisch)
// Zugewiesene, aber verspätete Aufträge bleiben sichtbar (orange) oben stehen.

import {
  type Auftrag,
  type AuftragStatus,
  effektiveMobilitaet,
  fahrzeugPasstZuMobilitaet,
  MOBILITAET_META,
  empfohlenerFahrzeugtyp,
} from "@/lib/auftraege";
import { adresseAusStrukturOderLegacy, adresseGefuellt } from "@/lib/address";
import { INITIAL_FAHRZEUGE } from "@/lib/fahrzeuge";

export type WarnStufe = "normal" | "gelb" | "orange" | "rot" | "ueberfaellig";

const AKTIVE_STATI: AuftragStatus[] = ["neu", "disponiert", "unterwegs"];

export function istAktiv(a: Pick<Auftrag, "status">): boolean {
  return AKTIVE_STATI.includes(a.status);
}

/** Aktiver Auftrag ohne Fahrer oder ohne Fahrzeug. */
export function istUnzugewiesen(a: Pick<Auftrag, "status" | "fahrer" | "fahrzeug">): boolean {
  return istAktiv(a) && (!a.fahrer || !a.fahrzeug);
}

/** Welche Zuweisungsfelder fehlen? */
export function fehlendeFelder(a: Pick<Auftrag, "fahrer" | "fahrzeug">): string[] {
  const fehlt: string[] = [];
  if (!a.fahrer) fehlt.push("Fahrer");
  if (!a.fahrzeug) fehlt.push("Fahrzeug");
  return fehlt;
}

/** Minuten bis zum Termin (negativ = überfällig). */
export function minutenBis(a: Pick<Auftrag, "termin">, now = Date.now()): number {
  const ms = new Date(a.termin ?? "").getTime();
  if (Number.isNaN(ms)) return Number.POSITIVE_INFINITY;
  return Math.round((ms - now) / 60000);
}

/** Berechnet die Warnstufe eines Auftrags. */
export function warnStufe(
  a: Pick<Auftrag, "status" | "fahrer" | "fahrzeug" | "termin">,
  now = Date.now(),
): WarnStufe {
  if (!istAktiv(a)) return "normal";
  const m = minutenBis(a, now);
  const unzugewiesen = !a.fahrer || !a.fahrzeug;

  if (m < 0) {
    // Termin überschritten
    return unzugewiesen ? "ueberfaellig" : "orange";
  }
  if (!unzugewiesen) return "normal";
  if (m <= 15) return "rot";
  if (m <= 30) return "orange";
  if (m <= 60) return "gelb";
  return "normal";
}

export interface WarnMeta {
  label: string;
  /** Tabellenzeilen-/Karten-Hintergrund */
  row: string;
  /** Badge-Klassen */
  badge: string;
  /** Punkt-/Akzentfarbe */
  dot: string;
  rang: number;
}

export const WARN_META: Record<WarnStufe, WarnMeta> = {
  normal: {
    label: "Planmäßig",
    row: "",
    badge: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
    rang: 4,
  },
  gelb: {
    label: "Warnung",
    row: "bg-warning/5 hover:bg-warning/10",
    badge: "border-warning/30 bg-warning/10 text-warning",
    dot: "bg-warning",
    rang: 3,
  },
  orange: {
    label: "Dringend",
    row: "bg-warning/10 hover:bg-warning/15",
    badge: "border-warning/40 bg-warning/20 text-warning",
    dot: "bg-warning",
    rang: 2,
  },
  rot: {
    label: "Kritisch",
    row: "bg-destructive/5 hover:bg-destructive/10",
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
    rang: 1,
  },
  ueberfaellig: {
    label: "Überfällig",
    row: "bg-destructive/10 hover:bg-destructive/15",
    badge: "border-destructive/40 bg-destructive/20 text-destructive",
    dot: "bg-destructive",
    rang: 0,
  },
};

/** Soll dieser Auftrag eine sichtbare Warnung auslösen? */
export function hatWarnung(stufe: WarnStufe): boolean {
  return stufe !== "normal";
}

/** Menschlich lesbarer Countdown. */
export function formatCountdown(minuten: number): string {
  if (minuten < 0) {
    const abs = Math.abs(minuten);
    if (abs < 60) return `vor ${abs} Min`;
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return m ? `vor ${h} Std ${m} Min` : `vor ${h} Std`;
  }
  if (minuten < 60) return `in ${minuten} Min`;
  const h = Math.floor(minuten / 60);
  const m = minuten % 60;
  return m ? `in ${h} Std ${m} Min` : `in ${h} Std`;
}

/* ------------------------------------------------------------------ *
 * Datums-Gruppierung
 * ------------------------------------------------------------------ */

export type GruppenId = string;

export interface AuftragGruppe {
  id: GruppenId;
  label: string;
  auftraege: Auftrag[];
}

const TAG_MS = 86_400_000;

function tagesStart(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function labelFuerDiff(diffTage: number, date: Date): string {
  if (diffTage === 0) return "Heute";
  if (diffTage === 1) return "Morgen";
  if (diffTage === 2) return "Übermorgen";
  return date.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" });
}

function terminMs(a: Pick<Auftrag, "termin">): number {
  const ms = new Date(a.termin ?? "").getTime();
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

function gruppeFuer(a: Auftrag, now: number): { id: GruppenId; label: string; sort: number } {
  const termin = new Date(a.termin).getTime();
  if (Number.isNaN(termin)) return { id: "ohne-termin", label: "Ohne gültigen Termin", sort: 98 };
  const heute = tagesStart(new Date(now));
  const terminTag = tagesStart(new Date(termin));
  const diffTage = Math.round((terminTag - heute) / TAG_MS);

  // Keep today's overdue transports inside today's card instead of creating one endless special list.
  if (istAktiv(a) && termin < now && diffTage < 0) {
    return { id: "ueberfaellig", label: "Überfällig", sort: -1 };
  }

  if (diffTage >= 0 && diffTage <= 7) {
    return {
      id: `tag-${diffTage}`,
      label: labelFuerDiff(diffTage, new Date(terminTag)),
      sort: diffTage,
    };
  }
  return { id: "spaeter", label: "Später", sort: 99 };
}

/**
 * Gruppiert Aufträge nach Datum und sortiert innerhalb jeder Gruppe nach
 * Terminzeit aufsteigend. Der nächste anstehende Auftrag steht damit oben.
 * Leere Gruppen werden ausgelassen.
 */
export function gruppiereNachDatum(auftraege: Auftrag[], now = Date.now()): AuftragGruppe[] {
  const buckets = new Map<GruppenId, AuftragGruppe & { sort: number }>();

  for (const a of auftraege) {
    const gruppe = gruppeFuer(a, now);
    if (!buckets.has(gruppe.id)) {
      buckets.set(gruppe.id, {
        id: gruppe.id,
        label: gruppe.label,
        sort: gruppe.sort,
        auftraege: [],
      });
    }
    buckets.get(gruppe.id)!.auftraege.push(a);
  }

  const byDringlichkeitDannTermin = (a: Auftrag, b: Auftrag) => {
    const ar = WARN_META[warnStufe(a, now)].rang;
    const br = WARN_META[warnStufe(b, now)].rang;
    if (ar !== br) return ar - br;
    return terminMs(a) - terminMs(b);
  };

  return Array.from(buckets.values())
    .sort((a, b) => a.sort - b.sort)
    .map(({ sort: _sort, ...g }) => ({
      ...g,
      auftraege: g.auftraege.sort(byDringlichkeitDannTermin),
    }));
}

/** Liefert die dringend unzugewiesenen Aufträge (Warnstufe ≥ gelb), sortiert. */
export function dringendeUnzugewiesene(auftraege: Auftrag[], now = Date.now()): Auftrag[] {
  return auftraege
    .filter((a) => istUnzugewiesen(a) && hatWarnung(warnStufe(a, now)))
    .sort((a, b) => {
      const rang = WARN_META[warnStufe(a, now)].rang - WARN_META[warnStufe(b, now)].rang;
      if (rang !== 0) return rang;
      return terminMs(a) - terminMs(b);
    });
}

/* ------------------------------------------------------------------ *
 * Automatische Auftrags-Warnungen
 * ------------------------------------------------------------------ */

export type ProblemTyp =
  | "kein_fahrer"
  | "adresse_fehlt"
  | "telefon_fehlt"
  | "fahrzeug_mismatch"
  | "doppelt_eingeplant";

export interface AuftragProblem {
  typ: ProblemTyp;
  label: string;
  text: string;
  /** kritisch = rot, warnung = gelb/orange */
  stufe: "kritisch" | "warnung";
}

/** Angenommene Dauer eines Transports für die Doppelbuchungs-Erkennung. */
const TRANSPORT_DAUER_MIN = 60;

/** Ist die Abhol- oder Zieladresse unvollständig? */
export function adresseFehlt(a: Auftrag): boolean {
  const pickup = adresseAusStrukturOderLegacy(a.pickup, a.abholort);
  const destination = adresseAusStrukturOderLegacy(a.destination, a.zielort);
  return !adresseGefuellt(pickup) || !adresseGefuellt(destination);
}

/** Fehlt eine Telefonnummer? */
export function telefonFehlt(a: Auftrag): boolean {
  return !(a.telefon ?? "").trim();
}

/** Passt das zugewiesene Fahrzeug nicht zur Mobilität (Rollstuhl/Liegend)? */
export function fahrzeugUnpassend(a: Auftrag): boolean {
  if (!a.fahrzeug) return false;
  const v = INITIAL_FAHRZEUGE.find((f) => f.kennzeichen === a.fahrzeug);
  if (!v) return false;
  const mob = effektiveMobilitaet(a);
  return !fahrzeugPasstZuMobilitaet(mob, {
    rollstuhlGeeignet: v.rollstuhlGeeignet,
    liegendGeeignet: v.liegendGeeignet,
  });
}

/** Ist der Fahrer im selben Zeitfenster mehrfach eingeplant? */
export function doppeltEingeplant(a: Auftrag, alle: Auftrag[]): boolean {
  if (!a.fahrer || !istAktiv(a)) return false;
  const start = new Date(a.termin ?? "").getTime();
  if (Number.isNaN(start)) return false;
  const fenster = TRANSPORT_DAUER_MIN * 60000;
  return alle.some((b) => {
    if (b.id === a.id || b.fahrer !== a.fahrer || !istAktiv(b)) return false;
    const bs = new Date(b.termin ?? "").getTime();
    if (Number.isNaN(bs)) return false;
    // Überschneidung zweier je TRANSPORT_DAUER langer Intervalle
    return Math.abs(bs - start) < fenster;
  });
}

/**
 * Ermittelt alle automatischen Warnungen für einen Auftrag.
 * `alle` wird nur für die Doppelbuchungs-Prüfung benötigt.
 */
export function auftragProbleme(
  a: Auftrag,
  alle: Auftrag[] = [],
  now = Date.now(),
): AuftragProblem[] {
  const probleme: AuftragProblem[] = [];
  if (!istAktiv(a)) return probleme;

  const m = minutenBis(a, now);
  if (!a.fahrer || !a.fahrzeug) {
    const bald = m <= 60;
    probleme.push({
      typ: "kein_fahrer",
      label: "Kein Fahrer/Fahrzeug",
      text: bald
        ? `Fahrt ${formatCountdown(m)}, aber ${fehlendeFelder(a).join(" & ")} fehlt.`
        : `${fehlendeFelder(a).join(" & ")} noch nicht zugewiesen.`,
      stufe: bald ? "kritisch" : "warnung",
    });
  }
  if (adresseFehlt(a)) {
    probleme.push({
      typ: "adresse_fehlt",
      label: "Adresse fehlt",
      text: "Abhol- oder Zieladresse ist unvollständig.",
      stufe: "kritisch",
    });
  }
  if (telefonFehlt(a)) {
    probleme.push({
      typ: "telefon_fehlt",
      label: "Telefonnummer fehlt",
      text: "Keine Kontakt-Telefonnummer hinterlegt.",
      stufe: "warnung",
    });
  }
  if (fahrzeugUnpassend(a)) {
    const mob = effektiveMobilitaet(a);
    probleme.push({
      typ: "fahrzeug_mismatch",
      label: "Fahrzeugtyp prüfen",
      text: `Fahrzeug passt nicht zur Mobilität „${MOBILITAET_META[mob].label}". Benötigt: ${empfohlenerFahrzeugtyp(mob)}.`,
      stufe: "warnung",
    });
  }
  if (doppeltEingeplant(a, alle)) {
    probleme.push({
      typ: "doppelt_eingeplant",
      label: "Fahrer doppelt eingeplant",
      text: `${a.fahrer} ist im selben Zeitfenster mehrfach eingeplant.`,
      stufe: "kritisch",
    });
  }
  return probleme;
}

/* ------------------------------------------------------------------ *
 * Tab-Gruppierung (Heute / Morgen / Übermorgen / Diese Woche / …)
 * ------------------------------------------------------------------ */

export type TabId =
  | "heute"
  | "morgen"
  | "uebermorgen"
  | "diese_woche"
  | "naechste_woche"
  | "weitere";

export interface TabDef {
  id: TabId;
  label: string;
}

export const AUFTRAG_TABS: TabDef[] = [
  { id: "heute", label: "Heute" },
  { id: "morgen", label: "Morgen" },
  { id: "uebermorgen", label: "Übermorgen" },
  { id: "diese_woche", label: "Diese Woche" },
  { id: "naechste_woche", label: "Nächste Woche" },
  { id: "weitere", label: "Weitere" },
];

/** Start des Wochentags (Montag = Wochenbeginn) als Zeitstempel. */
function wochenEnde(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=So..6=Sa
  const tageBisSonntag = dow === 0 ? 0 : 7 - dow;
  return tagesStart(new Date(d.getTime() + tageBisSonntag * TAG_MS));
}

/** Ordnet einen Auftrag einem Tab zu. */
export function auftragTab(a: Auftrag, now = Date.now()): TabId {
  const termin = new Date(a.termin ?? "").getTime();
  if (Number.isNaN(termin)) return "weitere";
  const heute = tagesStart(new Date(now));
  const terminTag = tagesStart(new Date(termin));
  const diffTage = Math.round((terminTag - heute) / TAG_MS);

  // Heutige und überfällige aktive Fahrten bleiben im Tab „Heute".
  if (diffTage <= 0) return istAktiv(a) || diffTage === 0 ? "heute" : "weitere";
  if (diffTage === 1) return "morgen";
  if (diffTage === 2) return "uebermorgen";

  const endeDieseWoche = wochenEnde(now);
  const endeNaechsteWoche = endeDieseWoche + 7 * TAG_MS;
  if (terminTag <= endeDieseWoche) return "diese_woche";
  if (terminTag <= endeNaechsteWoche) return "naechste_woche";
  return "weitere";
}

export interface TabGruppe extends TabDef {
  auftraege: Auftrag[];
}

/** Gruppiert Aufträge in die Tabs und sortiert je Tab nach Dringlichkeit/Termin. */
export function gruppiereNachTab(auftraege: Auftrag[], now = Date.now()): TabGruppe[] {
  const byDringlichkeitDannTermin = (a: Auftrag, b: Auftrag) => {
    const ar = WARN_META[warnStufe(a, now)].rang;
    const br = WARN_META[warnStufe(b, now)].rang;
    if (ar !== br) return ar - br;
    return terminMs(a) - terminMs(b);
  };
  return AUFTRAG_TABS.map((t) => ({
    ...t,
    auftraege: auftraege
      .filter((a) => auftragTab(a, now) === t.id)
      .sort(byDringlichkeitDannTermin),
  }));
}
