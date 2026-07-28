// Server functions für ärztliche Verordnungen (Muster 4).
// RLS: Admin/Disposition schreiben, Fahrer lesen — identisch zu `patients`.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  rowToVerordnung,
  safeRowToVerordnung,
  verordnungToRow,
  type Verordnung,
  type VerordnungRow,
  type VerordnungWrite,
} from "@/lib/verordnungen-shared";

const DB_FEHLER = "Die Verordnung konnte nicht gespeichert werden.";
const DB_LESE_FEHLER = "Die Verordnungen konnten nicht geladen werden.";

/** Echtes ISO-Kalenderdatum – nicht nur ein Regex-Treffer. */
const datum = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-DD sein.")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Kein gültiges Kalenderdatum.");

const text = (max: number) => z.string().trim().max(max);

const TRANSPORTART = z.enum([
  "Liegendtransport",
  "Sitzendtransport",
  "Rollstuhl",
  "Dialysefahrt",
]);

const verordnungFieldsSchema = z
  .object({
    patientId: z.string().uuid().nullable().optional(),
    ausstellungsdatum: datum.optional(),
    arztName: text(200).optional(),
    arztBsnr: text(20).optional(),
    arztLanr: text(20).optional(),
    transportart: TRANSPORTART.optional(),
    hinRueckfahrt: z.boolean().optional(),
    istSerie: z.boolean().optional(),
    anzahlFaelligkeiten: z.number().int().finite().min(1).max(500).nullable().optional(),
    seriengueltigVon: datum.nullable().optional(),
    seriengueltigBis: datum.nullable().optional(),
    genehmigtVonKasse: z.boolean().optional(),
    genehmigungsnummer: text(100).optional(),
    dokumentId: z.string().uuid().nullable().optional(),
    notiz: text(2000).optional(),
  })
  .strict()
  .refine(
    (v) => !(v.seriengueltigVon && v.seriengueltigBis) || v.seriengueltigVon <= v.seriengueltigBis,
    { message: "Serienzeitraum: „von“ darf nicht nach „bis“ liegen." },
  );

const createVerordnungSchema = z
  .object({
    patientId: z.string().uuid().nullable().optional(),
    ausstellungsdatum: datum,
    arztName: text(200).optional(),
    arztBsnr: text(20).optional(),
    arztLanr: text(20).optional(),
    transportart: TRANSPORTART,
    hinRueckfahrt: z.boolean().optional(),
    istSerie: z.boolean().optional(),
    anzahlFaelligkeiten: z.number().int().finite().min(1).max(500).nullable().optional(),
    seriengueltigVon: datum.nullable().optional(),
    seriengueltigBis: datum.nullable().optional(),
    genehmigtVonKasse: z.boolean().optional(),
    genehmigungsnummer: text(100).optional(),
    dokumentId: z.string().uuid().nullable().optional(),
    notiz: text(2000).optional(),
  })
  .strict()
  .refine(
    (v) => !(v.seriengueltigVon && v.seriengueltigBis) || v.seriengueltigVon <= v.seriengueltigBis,
    { message: "Serienzeitraum: „von“ darf nicht nach „bis“ liegen." },
  );

const updateVerordnungSchema = z
  .object({
    id: z.string().uuid(),
    // Leere Updates werden abgelehnt – ein „No-Op“ darf nicht als Erfolg gelten.
    values: verordnungFieldsSchema.refine(
      (v) => Object.keys(v).length > 0,
      "Keine Änderungen übergeben.",
    ),
  })
  .strict();

function fehler(parsed: { success: false; error: z.ZodError }): never {
  const erste = parsed.error.issues[0]?.message;
  throw new Error(erste ? `Ungültige Verordnungsdaten: ${erste}` : "Ungültige Verordnungsdaten.");
}

export const listVerordnungen = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Verordnung[]> => {
    const { data, error } = await context.supabase
      .from("verordnungen")
      .select("*")
      .order("ausstellungsdatum", { ascending: false });
    if (error) {
      console.error("listVerordnungen:", error.message);
      throw new Error(DB_LESE_FEHLER);
    }
    const rows = data ?? [];
    const gemappt = rows
      .map((r) => safeRowToVerordnung(r as unknown as VerordnungRow))
      .filter((v): v is Verordnung => v !== null);
    if (gemappt.length !== rows.length) {
      // Nur die Anzahl protokollieren – keine Patientendaten.
      console.error(
        `listVerordnungen: ${rows.length - gemappt.length} Zeile(n) mit ungültiger Transportart übersprungen.`,
      );
    }
    return gemappt;
  });

export const createVerordnung = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): Partial<VerordnungWrite> => {
    const parsed = createVerordnungSchema.safeParse(data);
    if (!parsed.success) fehler(parsed);
    return parsed.data as Partial<VerordnungWrite>;
  })
  .handler(async ({ data, context }): Promise<Verordnung> => {
    const { data: created, error } = await context.supabase
      .from("verordnungen")
      .insert(verordnungToRow(data) as never)
      .select()
      .single();
    if (error) {
      console.error("createVerordnung:", error.message);
      throw new Error(DB_FEHLER);
    }
    return rowToVerordnung(created as unknown as VerordnungRow);
  });

export const updateVerordnung = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string; values: Partial<VerordnungWrite> } => {
    const parsed = updateVerordnungSchema.safeParse(data);
    if (!parsed.success) fehler(parsed);
    return parsed.data as { id: string; values: Partial<VerordnungWrite> };
  })
  .handler(async ({ data, context }): Promise<Verordnung> => {
    const { data: updated, error } = await context.supabase
      .from("verordnungen")
      .update(verordnungToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .maybeSingle();
    if (error) {
      console.error("updateVerordnung:", error.message);
      throw new Error(DB_FEHLER);
    }
    if (!updated) throw new Error("Verordnung nicht gefunden.");
    return rowToVerordnung(updated as unknown as VerordnungRow);
  });

export const deleteVerordnung = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } => {
    const parsed = z.object({ id: z.string().uuid() }).strict().safeParse(data);
    if (!parsed.success) fehler(parsed);
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("verordnungen").delete().eq("id", data.id);
    if (error) {
      console.error("deleteVerordnung:", error.message);
      throw new Error(DB_FEHLER);
    }
    return { ok: true } as const;
  });
