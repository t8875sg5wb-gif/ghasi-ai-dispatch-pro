// ============================================================
// GHASI AI — Communication Store (Lovable Cloud backed)
// ------------------------------------------------------------
// Persists the unified communication layer (inbox conversations
// and AI drafts) in Supabase via TanStack Query. The public API
// (hook + action names) is unchanged so posteingang.tsx,
// aktions-center.tsx, conversation-panel.tsx and draft-card.tsx
// keep working with real data underneath.
//
// No automatic sending: drafts only change state on explicit
// Approve / Reject by the operator. Every event is mirrored into
// the Audit Log (activity_log) via logActivity.
// ============================================================
import { useEffect } from "react";
import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  generateEntwuerfe,
  letzteNachricht,
  KANAL_META,
  type Konversation,
  type KommEntwurf,
  type KommNachricht,
  type KommKanal,
} from "@/lib/communication";
import { entwurfToRow } from "@/lib/communication-shared";
import {
  listConversations,
  updateConversation,
  markAllConversationsRead,
  seedConversations,
  listDrafts,
  upsertDrafts,
  updateDraft,
} from "@/lib/communication.functions";
import { logActivity } from "@/lib/protokoll";

export const CONVERSATIONS_QUERY_KEY = ["conversations"] as const;
export const DRAFTS_QUERY_KEY = ["communication_drafts"] as const;

/**
 * Module-level QueryClient reference, captured while any store hook renders.
 * Lets the imperative action functions (markiereGelesen, sendeAntwort, …)
 * read/patch the cache without being hooks themselves — keeping the same
 * call-sites the UI already uses.
 */
let qcRef: QueryClient | null = null;
let convSeedInFlight = false;
let draftSeedInFlight = false;

/* ------------------------------------------------------------------ *
 * Cache helpers
 * ------------------------------------------------------------------ */

function patchKonversationen(fn: (list: Konversation[]) => Konversation[]) {
  if (!qcRef) return;
  const current = qcRef.getQueryData<Konversation[]>(CONVERSATIONS_QUERY_KEY) ?? [];
  qcRef.setQueryData(CONVERSATIONS_QUERY_KEY, fn(current));
}

function patchEntwuerfe(fn: (list: KommEntwurf[]) => KommEntwurf[]) {
  if (!qcRef) return;
  const current = qcRef.getQueryData<KommEntwurf[]>(DRAFTS_QUERY_KEY) ?? [];
  qcRef.setQueryData(DRAFTS_QUERY_KEY, fn(current));
}

/* ------------------------------------------------------------------ *
 * Actions (imperative — used from event handlers)
 * ------------------------------------------------------------------ */

/** Seeds the AI drafts (client-relative) once when the table is empty. */
export function ladeEntwuerfe() {
  const qc = qcRef;
  if (!qc) return;
  const existing = qc.getQueryData<KommEntwurf[]>(DRAFTS_QUERY_KEY);
  if (existing === undefined) return; // query not loaded yet
  if (existing.length > 0 || draftSeedInFlight) return;
  const drafts = generateEntwuerfe();
  if (drafts.length === 0) return;
  draftSeedInFlight = true;
  upsertDrafts({ data: { drafts: drafts.map(entwurfToRow) } })
    .then(() => qc.invalidateQueries({ queryKey: DRAFTS_QUERY_KEY }))
    .finally(() => {
      draftSeedInFlight = false;
    });
}

export function markiereGelesen(id: string, gelesen = true) {
  patchKonversationen((list) => list.map((k) => (k.id === id ? { ...k, gelesen } : k)));
  updateConversation({ data: { id, values: { gelesen } } }).catch(() => {
    qcRef?.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
  });
}

export function alleGelesen() {
  patchKonversationen((list) => list.map((k) => ({ ...k, gelesen: true })));
  markAllConversationsRead()
    .then(() => qcRef?.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY }))
    .catch(() => qcRef?.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY }));
  logActivity({
    bereich: "Kommunikation",
    aktion: "gelesen",
    beschreibung: "Alle Nachrichten als gelesen markiert.",
  });
}

/** Operator sends a manual reply inside a conversation (explicit user action). */
export function sendeAntwort(konvId: string, text: string) {
  const list = qcRef?.getQueryData<Konversation[]>(CONVERSATIONS_QUERY_KEY) ?? [];
  const konv = list.find((k) => k.id === konvId);
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
  const nachrichten = [...konv.nachrichten, nachricht];
  patchKonversationen((l) =>
    l.map((k) => (k.id === konvId ? { ...k, gelesen: true, nachrichten } : k)),
  );
  updateConversation({ data: { id: konvId, values: { gelesen: true, nachrichten } } })
    .then(() => qcRef?.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY }))
    .catch(() => qcRef?.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY }));
  logActivity({
    bereich: "Kommunikation",
    entitaet: konv.betreff,
    aktion: "antwort_gesendet",
    beschreibung: `Antwort an ${konv.partner} über ${KANAL_META[konv.kanal].label} gesendet.`,
    metadaten: { konversation: konvId, kanal: konv.kanal, bezug: konv.bezug ?? null },
  });
}

export function bearbeiteEntwurf(id: string, nachricht: string) {
  patchEntwuerfe((list) => list.map((e) => (e.id === id ? { ...e, nachricht } : e)));
  updateDraft({ data: { id, values: { nachricht } } }).catch(() => {
    qcRef?.invalidateQueries({ queryKey: DRAFTS_QUERY_KEY });
  });
}

/** Approves a draft → marks it sent (manual confirmation) + audit log. */
export function genehmigeEntwurf(id: string) {
  const entwurf = (qcRef?.getQueryData<KommEntwurf[]>(DRAFTS_QUERY_KEY) ?? []).find(
    (e) => e.id === id,
  );
  patchEntwuerfe((list) => list.map((e) => (e.id === id ? { ...e, status: "genehmigt" } : e)));
  updateDraft({ data: { id, values: { status: "genehmigt" } } })
    .then(() => qcRef?.invalidateQueries({ queryKey: DRAFTS_QUERY_KEY }))
    .catch(() => qcRef?.invalidateQueries({ queryKey: DRAFTS_QUERY_KEY }));
  if (!entwurf) return;
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
  const entwurf = (qcRef?.getQueryData<KommEntwurf[]>(DRAFTS_QUERY_KEY) ?? []).find(
    (e) => e.id === id,
  );
  patchEntwuerfe((list) => list.map((e) => (e.id === id ? { ...e, status: "abgelehnt" } : e)));
  updateDraft({ data: { id, values: { status: "abgelehnt" } } })
    .then(() => qcRef?.invalidateQueries({ queryKey: DRAFTS_QUERY_KEY }))
    .catch(() => qcRef?.invalidateQueries({ queryKey: DRAFTS_QUERY_KEY }));
  if (!entwurf) return;
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
 * React hooks (TanStack Query)
 * ------------------------------------------------------------------ */

export function useKonversationen(): Konversation[] {
  const qc = useQueryClient();
  qcRef = qc;
  const fetchFn = useServerFn(listConversations);
  const seedFn = useServerFn(seedConversations);
  const { data } = useQuery({
    queryKey: CONVERSATIONS_QUERY_KEY,
    queryFn: () => fetchFn(),
    staleTime: 30_000,
  });

  // Seed once from the demo inbox when the table is still empty.
  useEffect(() => {
    if (data === undefined || data.length > 0 || convSeedInFlight) return;
    convSeedInFlight = true;
    seedFn()
      .then((res) => {
        if (res.seeded > 0) qc.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      })
      .finally(() => {
        convSeedInFlight = false;
      });
  }, [data, qc, seedFn]);

  return data ?? [];
}

export function useEntwuerfe(): KommEntwurf[] {
  const qc = useQueryClient();
  qcRef = qc;
  const fetchFn = useServerFn(listDrafts);
  const { data } = useQuery({
    queryKey: DRAFTS_QUERY_KEY,
    queryFn: () => fetchFn(),
    staleTime: 30_000,
  });
  return data ?? [];
}

export function useUngeleseneAnzahl(): number {
  const konversationen = useKonversationen();
  return konversationen.filter((k) => !k.gelesen).length;
}

export function useOffeneEntwuerfeAnzahl(): number {
  const entwuerfe = useEntwuerfe();
  return entwuerfe.filter((e) => e.status === "offen").length;
}

export { letzteNachricht };
export type { Konversation, KommEntwurf, KommKanal };
