// Client-safe mapping between the persisted `conversations` /
// `communication_drafts` tables and the in-app domain types.
import type {
  Konversation,
  KommEntwurf,
  KommNachricht,
  ObjektBezug,
  KommKategorie,
  KommKanal,
  KommPrioritaet,
  EntwurfStatus,
} from "@/lib/communication";

/* ------------------------------------------------------------------ *
 * Conversations
 * ------------------------------------------------------------------ */

export interface ConversationRow {
  id: string;
  kategorie: string;
  betreff: string;
  partner: string;
  kanal: string;
  prioritaet: string;
  gelesen: boolean;
  bezug: unknown;
  nachrichten: unknown;
}

export function rowToKonversation(r: ConversationRow): Konversation {
  return {
    id: r.id,
    kategorie: (r.kategorie as KommKategorie) ?? "system",
    betreff: r.betreff ?? "",
    partner: r.partner ?? "",
    kanal: (r.kanal as KommKanal) ?? "intern",
    prioritaet: (r.prioritaet as KommPrioritaet) ?? "normal",
    gelesen: Boolean(r.gelesen),
    bezug: (r.bezug as ObjektBezug | null) ?? undefined,
    nachrichten: Array.isArray(r.nachrichten) ? (r.nachrichten as KommNachricht[]) : [],
  };
}

export function konversationToRow(k: Partial<Konversation>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (key: string, v: unknown) => {
    if (v !== undefined) row[key] = v;
  };
  set("kategorie", k.kategorie);
  set("betreff", k.betreff);
  set("partner", k.partner);
  set("kanal", k.kanal);
  set("prioritaet", k.prioritaet);
  set("gelesen", k.gelesen);
  set("bezug", k.bezug ?? null);
  set("nachrichten", k.nachrichten);
  return row;
}

/* ------------------------------------------------------------------ *
 * Drafts
 * ------------------------------------------------------------------ */

export interface DraftRow {
  id: string;
  kategorie: string;
  kanal: string;
  titel: string;
  empfaenger: string;
  betreff: string | null;
  nachricht: string;
  erklaerung: string;
  grund: string;
  quelldaten: unknown;
  bezug: unknown;
  prioritaet: string;
  status: string;
}

export function rowToEntwurf(r: DraftRow): KommEntwurf {
  return {
    id: r.id,
    kategorie: (r.kategorie as KommKategorie) ?? "system",
    kanal: (r.kanal as KommKanal) ?? "intern",
    titel: r.titel ?? "",
    empfaenger: r.empfaenger ?? "",
    betreff: r.betreff ?? undefined,
    nachricht: r.nachricht ?? "",
    erklaerung: r.erklaerung ?? "",
    grund: r.grund ?? "",
    quelldaten: Array.isArray(r.quelldaten)
      ? (r.quelldaten as { label: string; wert: string }[])
      : [],
    bezug: (r.bezug as ObjektBezug | null) ?? undefined,
    prioritaet: (r.prioritaet as KommPrioritaet) ?? "normal",
    status: (r.status as EntwurfStatus) ?? "offen",
  };
}

export function entwurfToRow(e: KommEntwurf): Record<string, unknown> {
  return {
    id: e.id,
    kategorie: e.kategorie,
    kanal: e.kanal,
    titel: e.titel,
    empfaenger: e.empfaenger,
    betreff: e.betreff ?? null,
    nachricht: e.nachricht,
    erklaerung: e.erklaerung,
    grund: e.grund,
    quelldaten: e.quelldaten,
    bezug: e.bezug ?? null,
    prioritaet: e.prioritaet,
    status: e.status,
  };
}
