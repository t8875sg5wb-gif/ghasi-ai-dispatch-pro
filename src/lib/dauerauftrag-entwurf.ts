/**
 * Auto-Save-Entwürfe für das Dauerauftrags-Formular.
 *
 * Bewusste Entscheidungen:
 * - Speicherung ausschließlich clientseitig in `sessionStorage`. Entwürfe enthalten
 *   Patientendaten (Name, medizinische Notiz); sie sollen deshalb nicht dauerhaft
 *   auf dem Gerät liegen bleiben, sondern mit dem Schließen des Tabs verschwinden.
 * - Kein serverseitiges Speichern: unvollständige Entwürfe würden die strikte
 *   Server-Validierung verletzen und als Ablehnung protokolliert werden.
 * - Entwürfe sind reine Wiederherstellungshilfe. Die Live-Validierung arbeitet
 *   unverändert auf dem Formularzustand, nicht auf dem Entwurf.
 */

import type { Dauerauftrag } from "@/lib/dauerauftraege";

const PRAEFIX = "ghasi:dauerauftrag-entwurf:";

/** Entwürfe älter als 12 Stunden werden verworfen. */
export const ENTWURF_MAX_ALTER_MS = 12 * 60 * 60 * 1000;

/** Pause nach dem letzten Tastendruck, bevor gespeichert wird. */
export const ENTWURF_DEBOUNCE_MS = 900;

export interface GespeicherterEntwurf {
  gespeichertAm: string;
  werte: Dauerauftrag;
}

/** Stabiler Schlüssel: pro bearbeiteter Serie bzw. einer für Neuanlagen. */
export function entwurfSchluessel(id: string | null): string {
  return `${PRAEFIX}${id ?? "neu"}`;
}

type Speicher = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function speicher(): Speicher | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function speichereEntwurf(
  schluessel: string,
  werte: Dauerauftrag,
  jetzt: Date = new Date(),
  store: Speicher | null = speicher(),
): GespeicherterEntwurf | null {
  if (!store) return null;
  const eintrag: GespeicherterEntwurf = { gespeichertAm: jetzt.toISOString(), werte };
  try {
    store.setItem(schluessel, JSON.stringify(eintrag));
    return eintrag;
  } catch {
    return null;
  }
}

export function verwerfeEntwurf(schluessel: string, store: Speicher | null = speicher()): void {
  try {
    store?.removeItem(schluessel);
  } catch {
    /* ignorieren */
  }
}

/** Liest einen Entwurf; defensiv gegen kaputtes JSON und abgelaufene Einträge. */
export function ladeEntwurf(
  schluessel: string,
  jetzt: Date = new Date(),
  store: Speicher | null = speicher(),
): GespeicherterEntwurf | null {
  if (!store) return null;
  let roh: string | null = null;
  try {
    roh = store.getItem(schluessel);
  } catch {
    return null;
  }
  if (!roh) return null;
  let daten: unknown;
  try {
    daten = JSON.parse(roh);
  } catch {
    verwerfeEntwurf(schluessel, store);
    return null;
  }
  if (!daten || typeof daten !== "object") {
    verwerfeEntwurf(schluessel, store);
    return null;
  }
  const kandidat = daten as Partial<GespeicherterEntwurf>;
  const zeit =
    typeof kandidat.gespeichertAm === "string" ? Date.parse(kandidat.gespeichertAm) : NaN;
  const werte = kandidat.werte;
  if (!Number.isFinite(zeit) || !werte || typeof werte !== "object") {
    verwerfeEntwurf(schluessel, store);
    return null;
  }
  if (jetzt.getTime() - zeit > ENTWURF_MAX_ALTER_MS) {
    verwerfeEntwurf(schluessel, store);
    return null;
  }
  return { gespeichertAm: new Date(zeit).toISOString(), werte: werte as Dauerauftrag };
}

/** True, wenn sich der Entwurf inhaltlich vom Ausgangszustand unterscheidet. */
export function entwurfWeichtAb(entwurf: Dauerauftrag, basis: Dauerauftrag): boolean {
  return JSON.stringify(entwurf) !== JSON.stringify(basis);
}

/**
 * Felder, die im Entwurf vom Ausgangszustand abweichen. Werden nach dem
 * Wiederherstellen als "berührt" markiert, damit die Live-Validierung genau die
 * Felder anzeigt, die der Nutzer tatsächlich bearbeitet hat.
 */
export function geaenderteFelder(entwurf: Dauerauftrag, basis: Dauerauftrag): string[] {
  const keys = new Set<string>([...Object.keys(entwurf ?? {}), ...Object.keys(basis ?? {})]);
  const geaendert: string[] = [];
  for (const key of keys) {
    const a = (entwurf as unknown as Record<string, unknown>)[key];
    const b = (basis as unknown as Record<string, unknown>)[key];
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) geaendert.push(key);
  }
  return geaendert.sort();
}

/** "14:32" – kurze Anzeige für den Speicherzeitpunkt. */
export function formatUhrzeit(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
