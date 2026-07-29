// Server functions for the persisted communication layer (Posteingang &
// Aktions-Center). RLS enforces admin/disposition read + write.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Konversation, KommEntwurf } from "@/lib/communication";
import {
  rowToKonversation,
  konversationToRow,
  rowToEntwurf,
  type ConversationRow,
  type DraftRow,
} from "@/lib/communication-shared";

/* ------------------------------------------------------------------ *
 * Validation (strict — no passthrough)
 * ------------------------------------------------------------------ */

const kategorieSchema = z.enum([
  "dispatch",
  "fahrer",
  "patienten",
  "kunden",
  "finanzen",
  "wartung",
  "ki",
  "kritisch",
  "system",
]);
const kanalSchema = z.enum(["whatsapp", "sms", "email", "intern", "fahrer", "kunde"]);
const prioritaetSchema = z.enum(["kritisch", "hoch", "normal", "niedrig"]);
const entityTypSchema = z.enum([
  "transport",
  "patient",
  "fahrer",
  "fahrzeug",
  "rechnung",
  "wartung",
  "kunde",
  "system",
]);
const statusSchema = z.enum(["offen", "genehmigt", "abgelehnt"]);

/**
 * Entwurfs-IDs sind in dieser Anwendung KEINE reinen UUIDs, sondern
 * präfixierte Kennungen wie `entwurf-sms-<uuid>` (siehe `entwurfIdFuer()` in
 * communication.ts und der Bestand in `communication_drafts`). Eine
 * `.uuid()`-Regel würde jeden bestehenden Entwurf unbearbeitbar machen.
 */
const draftIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9_-]+$/, "Ungültige Entwurfs-ID");

const objektBezugSchema = z
  .object({
    typ: entityTypSchema,
    id: z.string().max(200),
    label: z.string().max(200),
    to: z.string().max(300),
  })
  .strict();

const anhangSchema = z
  .object({
    id: z.string().max(200),
    name: z.string().max(200),
    art: z.enum(["pdf", "bild", "dokument"]),
    // Teil des Domäntyps `KommAnhang` und im Bestand vorhanden.
    groesse: z.string().max(50).optional(),
  })
  .strict();

const nachrichtSchema = z
  .object({
    id: z.string().max(200),
    von: z.string().max(200),
    an: z.string().max(200),
    kanal: kanalSchema,
    zeit: z.string().max(64),
    text: z.string().max(5000),
    eigen: z.boolean().optional(),
    anhaenge: z.array(anhangSchema).max(50).optional(),
  })
  .strict();

const conversationValuesSchema = z
  .object({
    kategorie: kategorieSchema.optional(),
    kanal: kanalSchema.optional(),
    prioritaet: prioritaetSchema.optional(),
    betreff: z.string().trim().max(300).optional(),
    partner: z.string().trim().max(300).optional(),
    gelesen: z.boolean().optional(),
    bezug: objektBezugSchema.nullable().optional(),
    nachrichten: z.array(nachrichtSchema).max(500).optional(),
  })
  .strict();

const updateConversationSchema = z
  .object({ id: z.string().uuid(), values: conversationValuesSchema })
  .strict()
  .refine((v) => Object.keys(v.values).length > 0, {
    message: "Keine Änderungen übergeben.",
    path: ["values"],
  });

const entwurfFieldsSchema = z
  .object({
    id: draftIdSchema,
    kategorie: kategorieSchema,
    kanal: kanalSchema,
    prioritaet: prioritaetSchema,
    titel: z.string().trim().min(1).max(300),
    empfaenger: z.string().trim().min(1).max(200),
    betreff: z.string().trim().max(300).nullable().optional(),
    nachricht: z.string().max(5000),
    erklaerung: z.string().max(2000),
    grund: z.string().max(2000),
    quelldaten: z.array(
      z.object({ label: z.string().max(200), wert: z.string().max(500) }).strict(),
    ),
    bezug: objektBezugSchema.nullable().optional(),
    status: statusSchema,
  })
  .strict();

const upsertDraftsSchema = z.object({ drafts: z.array(entwurfFieldsSchema).max(200) }).strict();

const updateDraftSchema = z
  .object({
    id: draftIdSchema,
    values: z
      .object({
        nachricht: z.string().max(5000).optional(),
        status: statusSchema.optional(),
      })
      .strict()
      .refine((v) => Object.keys(v).length > 0, { message: "Keine Änderungen übergeben." }),
  })
  .strict();

/** Parses with a generic client-facing message; details stay server-side. */
function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error("Ungültige Kommunikationsdaten.");
  return result.data;
}


/* ------------------------------------------------------------------ *
 * Conversations
 * ------------------------------------------------------------------ */

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Konversation[]> => {
    const { data, error } = await context.supabase
      .from("conversations")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToKonversation(r as unknown as ConversationRow));
  });

export const updateConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; values: Partial<Konversation> }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<Konversation> => {
    const { data: updated, error } = await context.supabase
      .from("conversations")
      .update(konversationToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToKonversation(updated as unknown as ConversationRow);
  });

export const markAllConversationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("conversations")
      .update({ gelesen: true } as never)
      .eq("gelesen", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const seedConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("conversations")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };
    const { INITIAL_KONVERSATIONEN } = await import("@/lib/communication");
    const rows = INITIAL_KONVERSATIONEN.map((k) => {
      const { id: _id, ...rest } = k;
      void _id;
      return konversationToRow(rest);
    });
    const { error } = await context.supabase.from("conversations").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });

/* ------------------------------------------------------------------ *
 * Drafts
 * ------------------------------------------------------------------ */

export const listDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KommEntwurf[]> => {
    const { data, error } = await context.supabase
      .from("communication_drafts")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToEntwurf(r as unknown as DraftRow));
  });

export const upsertDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { drafts: Record<string, unknown>[] }) => {
    if (!data || !Array.isArray(data.drafts)) throw new Error("drafts ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (data.drafts.length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("communication_drafts")
      .upsert(data.drafts as never, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; values: { nachricht?: string; status?: string } }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<KommEntwurf> => {
    const values: Record<string, unknown> = {};
    if (data.values.nachricht !== undefined) values.nachricht = data.values.nachricht;
    if (data.values.status !== undefined) values.status = data.values.status;
    const { data: updated, error } = await context.supabase
      .from("communication_drafts")
      .update(values as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToEntwurf(updated as unknown as DraftRow);
  });
