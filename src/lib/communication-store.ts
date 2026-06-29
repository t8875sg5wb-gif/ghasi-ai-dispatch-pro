// ============================================================
// GHASI AI — Communication Store
// ------------------------------------------------------------
// Lightweight, framework-agnostic reactive store for the unified
// communication layer. Holds inbox conversations and AI-generated
// drafts in memory for the session and exposes actions that EVERY
// module can reuse. Every communication event is mirrored into the
// Audit Log (activity_log) via logActivity (fire-and-forget).
//
// No automatic sending: drafts only change state on explicit
// Approve / Reject by the operator.
// ============================================================
import { useSyncExternalStore } from "react";

import {
  INITIAL_KONVERSATIONEN,
  generateEntwuerfe,
  letzteNachricht,
  type Konversation,
  type KommEntwurf,
  type KommNachricht,
  type KommKanal,
  KANAL_META,
} from "@/lib/communication";
import { logActivity } from "@/lib/protokoll";

interface CommState {
  konversationen: Konversation[];
  entwuerfe: KommEntwurf[];
  entwuerfeGeladen: boolean;
}

let state: CommState = {
  konversationen: INITIAL_KONVERSATIONEN,
  entwuerfe: [],
  entwuerfeGeladen: false,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(next: Partial<CommState>) {
  state = { ...state, ...next };
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */

/** Loads the time-relative AI drafts once (client-only). */
export function ladeEntwuerfe() {
  if (state.entwuerfeGeladen) return;
  setState({ entwuerfe: generateEntwuerfe(), entwuerfeGeladen: true });
}

export function markiereGelesen(id: string, gelesen = true) {
  setState({
    konversationen: state.konversationen.map((k) => (k.id === id ? { ...k, gelesen } : k)),
  });
}

export function alleGelesen() {
  setState({ konversationen: state.konversationen.map((k) => ({ ...k, gelesen: true })) });
  logActivity({
    bereich: "Kommunikation",
    aktion: "gelesen",
    beschreibung: "Alle Nachrichten als gelesen markiert.",
  });
}

/** Operator sends a manual reply inside a conversation (explicit user action). */
export function sendeAntwort(konvId: string, text: string) {
  const konv = state.konversationen.find((k) => k.id === konvId);
  if (!konv || !text.trim()) return;
  const nachricht: KommNachricht = {
    id: `n-${konvId}-${Date.now()}`,
    von: "Disposition",
    an: konv.partner,
    kanal: konv.kanal,
    zeit: new Date().toISOString(),
    text: text.trim(),
    eigen: true,
  };
  setState({
    konversationen: state.konversationen.map((k) =>
      k.id === konvId ? { ...k, gelesen: true, nachrichten: [...k.nachrichten, nachricht] } : k,
    ),
  });
  logActivity({
    bereich: "Kommunikation",
    entitaet: konv.betreff,
    aktion: "antwort_gesendet",
    beschreibung: `Antwort an ${konv.partner} über ${KANAL_META[konv.kanal].label} gesendet.`,
    metadaten: { konversation: konvId, kanal: konv.kanal, bezug: konv.bezug ?? null },
  });
}

export function bearbeiteEntwurf(id: string, nachricht: string) {
  setState({
    entwuerfe: state.entwuerfe.map((e) => (e.id === id ? { ...e, nachricht } : e)),
  });
}

/** Approves a draft → marks it sent (manual confirmation) and logs to the audit trail. */
export function genehmigeEntwurf(id: string) {
  const entwurf = state.entwuerfe.find((e) => e.id === id);
  if (!entwurf) return;
  setState({
    entwuerfe: state.entwuerfe.map((e) => (e.id === id ? { ...e, status: "genehmigt" } : e)),
  });
  logActivity({
    bereich: "Kommunikation",
    entitaet: entwurf.titel,
    aktion: "entwurf_genehmigt",
    beschreibung: `KI-Entwurf „${entwurf.titel}" freigegeben und an ${entwurf.empfaenger} über ${KANAL_META[entwurf.kanal].label} gesendet.`,
    akteur: "Unternehmer",
    metadaten: {
      kanal: entwurf.kanal,
      empfaenger: entwurf.empfaenger,
      bezug: entwurf.bezug ?? null,
      prioritaet: entwurf.prioritaet,
    },
  });
}

export function lehneEntwurfAb(id: string) {
  const entwurf = state.entwuerfe.find((e) => e.id === id);
  if (!entwurf) return;
  setState({
    entwuerfe: state.entwuerfe.map((e) => (e.id === id ? { ...e, status: "abgelehnt" } : e)),
  });
  logActivity({
    bereich: "Kommunikation",
    entitaet: entwurf.titel,
    aktion: "entwurf_abgelehnt",
    beschreibung: `KI-Entwurf „${entwurf.titel}" verworfen (nicht gesendet).`,
    akteur: "Unternehmer",
    metadaten: { kanal: entwurf.kanal, bezug: entwurf.bezug ?? null },
  });
}

/* ------------------------------------------------------------------ *
 * React hooks (useSyncExternalStore)
 * ------------------------------------------------------------------ */

export function useKonversationen() {
  return useSyncExternalStore(
    subscribe,
    () => state.konversationen,
    () => state.konversationen,
  );
}

export function useEntwuerfe() {
  return useSyncExternalStore(
    subscribe,
    () => state.entwuerfe,
    () => state.entwuerfe,
  );
}

export function useUngeleseneAnzahl() {
  return useSyncExternalStore(
    subscribe,
    () => state.konversationen.filter((k) => !k.gelesen).length,
    () => 0,
  );
}

export function useOffeneEntwuerfeAnzahl() {
  return useSyncExternalStore(
    subscribe,
    () => state.entwuerfe.filter((e) => e.status === "offen").length,
    () => 0,
  );
}

export { letzteNachricht };
export type { Konversation, KommEntwurf, KommKanal };
