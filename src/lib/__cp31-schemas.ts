import { z } from "zod";
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
    groesse: z.string().max(50),
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

export { objektBezugSchema, nachrichtSchema, conversationValuesSchema, updateConversationSchema, entwurfFieldsSchema, upsertDraftsSchema, updateDraftSchema, draftIdSchema };
