// Auswertung und Alarmierung für abgelehnte Dauerauftragsversuche.
//
// Client-safe: reine Funktionen auf den bereits geladenen Ablehnungsdaten,
// damit Widget, Benachrichtigungen und Tests dieselbe Logik nutzen.

import type { DauerauftragAblehnung } from "@/lib/recurring-rejections.functions";

export const AKTION_LABEL: Record<string, string> = {
  create: "Neuanlage",
  update: "Änderung",
  delete: "Löschung",
  generate: "Transport-Erzeugung",
};

/** Nur Ablehnungen aus diesem Zeitfenster lösen eine Benachrichtigung aus. */
export const ABLEHNUNG_ALARM_FENSTER_MINUTEN = 24 * 60;

export interface AblehnungsBenachrichtigung {
  id: string;
  stufe: "warnung";
  titel: string;
  text: string;
  to: string;
  quelle: string;
  createdAt: number;
}

/**
 * Baut je frischer Ablehnung genau eine Benachrichtigung (stabile ID = Datensatz-ID,
 * dadurch idempotent im Benachrichtigungszentrum). Enthält Zeitpunkt und Grund.
 */
export function ablehnungsBenachrichtigungen(
  ablehnungen: DauerauftragAblehnung[],
  now: number = Date.now(),
  fensterMinuten: number = ABLEHNUNG_ALARM_FENSTER_MINUTEN,
): AblehnungsBenachrichtigung[] {
  const grenze = now - fensterMinuten * 60_000;
  const treffer: AblehnungsBenachrichtigung[] = [];
  for (const a of ablehnungen) {
    const t = new Date(a.zeitpunkt).getTime();
    if (!Number.isFinite(t) || t < grenze || t > now) continue;
    const zeit = new Date(t).toLocaleString("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const aktion = AKTION_LABEL[a.aktion] ?? a.aktion;
    const wer = a.patient ? ` – ${a.patient}` : "";
    treffer.push({
      id: `dauerauftrag-ablehnung:${a.id}`,
      stufe: "warnung",
      titel: `Dauerauftrag abgelehnt: ${aktion}${wer}`,
      text: `${zeit} – Grund: ${a.grund}`,
      to: "/dauerauftrag-ablehnungen",
      quelle: "dauerauftrag-ablehnungen",
      createdAt: t,
    });
  }
  return treffer;
}

export interface AblehnungsKennzahlen {
  abgelehnt: number;
  erfolgreich: number;
  versuche: number;
  /** Anteil erfolgreicher Versuche (0–1) oder null, wenn keine Versuche vorliegen. */
  erfolgsquote: number | null;
  topGruende: { grund: string; anzahl: number }[];
  topPfade: { path: string; label: string; anzahl: number }[];
  /**
   * Ø Minuten zwischen zwei aufeinanderfolgenden Ablehnungen desselben
   * Vorgangs (Patient bzw. Datensatz) – die typische Dauer eines
   * Korrekturzyklus. Null, wenn es keine Wiederholung gab.
   */
  avgKorrekturMinuten: number | null;
}

/**
 * Verdichtet Ablehnungen für das Admin-Widget. `erfolgreich` sind die im
 * gleichen Zeitraum erfolgreich gespeicherten Dauerauftragsvorgänge
 * (Aktivitätsprotokoll) – daraus ergibt sich die Erfolgsquote.
 */
export function bewerteAblehnungen(
  ablehnungen: DauerauftragAblehnung[],
  erfolgreich: number,
): AblehnungsKennzahlen {
  const gruende = new Map<string, number>();
  const pfade = new Map<string, { anzahl: number; label: string }>();
  for (const a of ablehnungen) {
    gruende.set(a.grund, (gruende.get(a.grund) ?? 0) + 1);
    for (const f of a.felder) {
      const vorher = pfade.get(f.path);
      pfade.set(f.path, { anzahl: (vorher?.anzahl ?? 0) + 1, label: f.label });
    }
  }

  // Abstände zwischen Wiederholungen desselben Vorgangs.
  const gruppen = new Map<string, number[]>();
  for (const a of ablehnungen) {
    const key = a.zielId ?? a.patient ?? a.id;
    const t = new Date(a.zeitpunkt).getTime();
    if (!Number.isFinite(t)) continue;
    const liste = gruppen.get(key) ?? [];
    liste.push(t);
    gruppen.set(key, liste);
  }
  const abstaende: number[] = [];
  for (const liste of gruppen.values()) {
    const sortiert = [...liste].sort((a, b) => a - b);
    for (let i = 1; i < sortiert.length; i++) abstaende.push(sortiert[i]! - sortiert[i - 1]!);
  }

  const abgelehnt = ablehnungen.length;
  const versuche = abgelehnt + Math.max(0, erfolgreich);

  return {
    abgelehnt,
    erfolgreich: Math.max(0, erfolgreich),
    versuche,
    erfolgsquote: versuche > 0 ? Math.max(0, erfolgreich) / versuche : null,
    topGruende: [...gruende.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de"))
      .slice(0, 3)
      .map(([grund, anzahl]) => ({ grund, anzahl })),
    topPfade: [...pfade.entries()]
      .sort((a, b) => b[1].anzahl - a[1].anzahl || a[0].localeCompare(b[0], "de"))
      .slice(0, 5)
      .map(([path, info]) => ({ path, label: info.label, anzahl: info.anzahl })),
    avgKorrekturMinuten:
      abstaende.length > 0
        ? Math.round(abstaende.reduce((s, x) => s + x, 0) / abstaende.length / 60_000)
        : null,
  };
}
