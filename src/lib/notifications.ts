// In-App-Benachrichtigungssystem für GHASI AI.
//
// Ein leichtgewichtiger, framework-unabhängiger Store mit Pub/Sub und
// localStorage-Persistenz. Wird über `useNotifications()` in React konsumiert
// und über `syncOrderNotifications()` aus dem Auftrags-State gespeist.
//
// Push-Bereitschaft: `requestPushPermission()` / `isPushSupported()` sind als
// Andockpunkte für spätere Browser-Push-Benachrichtigungen vorbereitet – die
// interne Benachrichtigungsebene funktioniert bereits vollständig.

import { useSyncExternalStore } from "react";

import type { Auftrag } from "@/lib/auftraege";
import {
  type WarnStufe,
  warnStufe,
  minutenBis,
  formatCountdown,
  fehlendeFelder,
  istUnzugewiesen,
  hatWarnung,
} from "@/lib/order-urgency";

export type NotifStufe = "kritisch" | "warnung" | "info";

export interface NotificationItem {
  id: string;
  stufe: NotifStufe;
  titel: string;
  text: string;
  /** Navigationsziel (Route) */
  to: string;
  /** Quelle, z. B. "auftrag:a-12" */
  quelle: string;
  createdAt: number;
  gelesen: boolean;
}

const STORAGE_KEY = "ghasi.notifications.v1";
const MAX = 100;

let items: NotificationItem[] = [];
let geladen = false;
const listeners = new Set<() => void>();

function load() {
  if (geladen || typeof window === "undefined") return;
  geladen = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) items = JSON.parse(raw) as NotificationItem[];
  } catch {
    items = [];
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    /* ignore quota */
  }
}

function emit() {
  persist();
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  load();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNotifications(): NotificationItem[] {
  load();
  return items;
}

/**
 * Fügt eine Benachrichtigung hinzu oder aktualisiert eine bestehende mit
 * gleicher ID (idempotent – verhindert Duplikate). Gibt true zurück, wenn die
 * Benachrichtigung neu ist.
 */
export function pushNotification(
  n: Omit<NotificationItem, "createdAt" | "gelesen"> & { createdAt?: number },
): boolean {
  load();
  const vorhanden = items.find((i) => i.id === n.id);
  if (vorhanden) {
    const veraendert = vorhanden.titel !== n.titel || vorhanden.text !== n.text || vorhanden.stufe !== n.stufe;
    vorhanden.titel = n.titel;
    vorhanden.text = n.text;
    vorhanden.stufe = n.stufe;
    vorhanden.to = n.to;
    if (veraendert) emit();
    return false;
  }
  items = [
    { ...n, createdAt: n.createdAt ?? Date.now(), gelesen: false },
    ...items,
  ].slice(0, MAX);
  emit();
  return true;
}

export function markGelesen(id: string) {
  load();
  const i = items.find((x) => x.id === id);
  if (i && !i.gelesen) {
    i.gelesen = true;
    emit();
  }
}

export function markAlleGelesen() {
  load();
  let changed = false;
  for (const i of items) {
    if (!i.gelesen) {
      i.gelesen = true;
      changed = true;
    }
  }
  if (changed) emit();
}

export function entferne(id: string) {
  load();
  const before = items.length;
  items = items.filter((i) => i.id !== id);
  if (items.length !== before) emit();
}

export function leereAlle() {
  load();
  if (items.length) {
    items = [];
    emit();
  }
}

export function ungeleseneAnzahl(): number {
  return getNotifications().filter((i) => !i.gelesen).length;
}

/* ------------------------------------------------------------------ *
 * React-Hook
 * ------------------------------------------------------------------ */

export function useNotifications(): NotificationItem[] {
  return useSyncExternalStore(subscribe, getNotifications, getNotifications);
}

export function useUngeleseneAnzahl(): number {
  const list = useNotifications();
  return list.filter((i) => !i.gelesen).length;
}

/* ------------------------------------------------------------------ *
 * Ableitung aus Aufträgen
 * ------------------------------------------------------------------ */

const STUFE_MAP: Record<WarnStufe, NotifStufe | null> = {
  normal: null,
  gelb: "warnung",
  orange: "warnung",
  rot: "kritisch",
  ueberfaellig: "kritisch",
};

/**
 * Spiegelt dringende, unzugewiesene Aufträge in den Benachrichtigungs-Store.
 * Gibt die neu erzeugten Benachrichtigungen zurück (z. B. für Audit-Log).
 */
export function syncOrderNotifications(auftraege: Auftrag[], now = Date.now()): NotificationItem[] {
  const neue: NotificationItem[] = [];
  for (const a of auftraege) {
    if (!istUnzugewiesen(a)) continue;
    const stufe = warnStufe(a, now);
    if (!hatWarnung(stufe)) continue;
    const notifStufe = STUFE_MAP[stufe];
    if (!notifStufe) continue;

    const m = minutenBis(a, now);
    const fehlt = fehlendeFelder(a);
    const id = `auftrag-unassigned-${a.id}`;
    const titel = `Nicht zugewiesen: ${a.nummer} · ${a.patient}`;
    const text = `${formatCountdown(m)} · Fehlt: ${fehlt.join(" & ")}`;
    const istNeu = pushNotification({
      id,
      stufe: notifStufe,
      titel,
      text,
      to: "/auftraege",
      quelle: `auftrag:${a.id}`,
    });
    if (istNeu) {
      const created = getNotifications().find((n) => n.id === id);
      if (created) neue.push(created);
    }
  }
  return neue;
}

export const NOTIF_STUFE_META: Record<NotifStufe, { label: string; badge: string; dot: string }> = {
  kritisch: { label: "Kritisch", badge: "border-destructive/30 bg-destructive/10 text-destructive", dot: "bg-destructive" },
  warnung: { label: "Warnung", badge: "border-warning/30 bg-warning/10 text-warning", dot: "bg-warning" },
  info: { label: "Info", badge: "border-info/30 bg-info/10 text-info", dot: "bg-info" },
};

/* ------------------------------------------------------------------ *
 * Browser-Push-Bereitschaft (Andockpunkt, noch nicht aktiv)
 * ------------------------------------------------------------------ */

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestPushPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isPushSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}
