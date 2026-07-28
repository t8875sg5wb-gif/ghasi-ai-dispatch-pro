// Server functions für ärztliche Verordnungen (Muster 4).
// RLS: Admin/Disposition schreiben, Fahrer lesen — identisch zu `patients`.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  rowToVerordnung,
  verordnungToRow,
  type Verordnung,
  type VerordnungRow,
  type VerordnungWrite,
} from "@/lib/verordnungen-shared";

const datum = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-DD sein.");

const verordnungFieldsSchema = z
  .object({
    patientId: z.string().uuid().nullable().optional(),
    ausstellungsdatum: datum.optional(),
    arztName: z.string().max(200).optional(),
    arztBsnr: z.string().max(20).optional(),
    arztLanr: z.string().max(20).optional(),
    transportart: z.enum(["Liegendtransport", "Sitzendtransport", "Rollstuhl", "Dialysefahrt"]).optional(),
    hinRueckfahrt: z.boolean().optional(),
    istSerie: z.boolean().optional(),
    anzahlFaelligkeiten: z.number().int().min(1).max(500).nullable().optional(),
    seriengueltigVon: datum.nullable().optional(),
    seriengueltigBis: datum.nullable().optional(),
    genehmigtVonKasse: z.boolean().optional(),
    genehmigungsnummer: z.string().max(100).optional(),
    dokumentId: z.string().uuid().nullable().optional(),
    notiz: z.string().max(2000).optional(),
  })
  .strict();

const createVerordnungSchema = verordnungFieldsSchema
  .extend({
    ausstellungsdatum: datum,
    transportart: z.enum(["Liegendtransport", "Sitzendtransport", "Rollstuhl", "Dialysefahrt"]),
  })
  .strict();

const updateVerordnungSchema = z
  .object({ id: z.string().uuid(), values: verordnungFieldsSchema })
  .strict();

export const listVerordnungen = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Verordnung[]> => {
    const { data, error } = await context.supabase
      .from("verordnungen")
      .select("*")
      .order("ausstellungsdatum", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToVerordnung(r as unknown as VerordnungRow));
  });

export const createVerordnung = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): Partial<VerordnungWrite> => {
    const parsed = createVerordnungSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Verordnungsdaten.");
    return parsed.data as Partial<VerordnungWrite>;
  })
  .handler(async ({ data, context }): Promise<Verordnung> => {
    const { data: created, error } = await context.supabase
      .from("verordnungen")
      .insert(verordnungToRow(data) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToVerordnung(created as unknown as VerordnungRow);
  });

export const updateVerordnung = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string; values: Partial<VerordnungWrite> } => {
    const parsed = updateVerordnungSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Verordnungsdaten.");
    return parsed.data as { id: string; values: Partial<VerordnungWrite> };
  })
  .handler(async ({ data, context }): Promise<Verordnung> => {
    const { data: updated, error } = await context.supabase
      .from("verordnungen")
      .update(verordnungToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToVerordnung(updated as unknown as VerordnungRow);
  });

export const deleteVerordnung = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } => {
    const parsed = z.object({ id: z.string().uuid() }).strict().safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Verordnungsdaten.");
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("verordnungen").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });
