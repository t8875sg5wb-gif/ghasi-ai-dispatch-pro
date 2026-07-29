// Server functions for persisted patients. RLS enforces admin/disposition/fahrer.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertInsurerExists } from "@/lib/identity-checks.server";
import type { Patient } from "@/lib/stammdaten";
import { rowToPatient, patientToRow, type PatientRow, type PatientWrite } from "@/lib/patients-shared";

/** ISO-Datum `YYYY-MM-DD` (Muster wie CP19). */
const isoDatum = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-DD sein.");

/**
 * Strenge Laufzeitvalidierung für Patienten-Mutationen (Muster CP12/CP13/CP19).
 * `.strict()` weist unbekannte Felder ab. `mobilitaet` ist die Enum aus
 * `stammdaten.ts` – bewusst NICHT die gleichnamige Enum aus `auftraege.ts`.
 */
export const patientFieldsSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    telefon: z.string().trim().max(50).optional(),
    mobilitaet: z.enum(["Gehfähig", "Rollstuhl", "Liegend"]),
    kostentraeger: z.string().trim().max(200),
    hinweis: z.string().max(2000),
    begleitperson: z.boolean().optional(),
    medizinischeNotiz: z.string().max(2000).optional(),
    patientennotiz: z.string().max(2000).optional(),
    kostentraegerId: z.string().uuid().nullable().optional(),
    versichertennummer: z.string().trim().max(20).optional(),
    zuzahlungsbefreit: z.boolean().optional(),
    zuzahlungsbefreitBis: isoDatum.nullable().optional(),
    verordnungVorhanden: z.boolean().optional(),
    // Bewusst ohne `.uuid()` – gleiche Konvention wie `orderFieldsSchema`.
    verordnungDokumentId: z.string().nullable().optional(),
    genehmigungBis: isoDatum.nullable().optional(),
  })
  .strict();

const createPatientSchema = patientFieldsSchema;

export const updatePatientSchema = z
  .object({ id: z.string().uuid(), values: patientFieldsSchema.partial().strict() })
  .strict()
  .refine((v) => Object.keys(v.values).length > 0, {
    message: "Keine Änderungen übergeben.",
    path: ["values"],
  });

const deletePatientSchema = z.object({ id: z.string().uuid() }).strict();

export const listPatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Patient[]> => {
    const { data, error } = await context.supabase
      .from("patients")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToPatient(r as unknown as PatientRow));
  });

export const createPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): PatientWrite => {
    const parsed = createPatientSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Patientendaten.");
    return parsed.data as unknown as PatientWrite;
  })
  .handler(async ({ data, context }): Promise<Patient> => {
    if (data.kostentraegerId) await assertInsurerExists(context.supabase, data.kostentraegerId);
    const { data: created, error } = await context.supabase
      .from("patients")
      .insert(patientToRow(data) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToPatient(created as unknown as PatientRow);
  });

export const updatePatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string; values: Partial<PatientWrite> } => {
    const parsed = updatePatientSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Patientendaten.");
    return parsed.data as unknown as { id: string; values: Partial<PatientWrite> };
  })
  .handler(async ({ data, context }): Promise<Patient> => {
    if (data.values.kostentraegerId)
      await assertInsurerExists(context.supabase, data.values.kostentraegerId);
    const { data: updated, error } = await context.supabase
      .from("patients")
      .update(patientToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToPatient(updated as unknown as PatientRow);
  });

export const deletePatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } => {
    const parsed = deletePatientSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Patientendaten.");
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("patients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });


export const seedPatients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("patients")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };
    const { PATIENTEN } = await import("@/lib/stammdaten");
    const rows = PATIENTEN.map((p) => {
      const { id: _id, ...rest } = p;
      void _id;
      return patientToRow(rest);
    });
    const { error } = await context.supabase.from("patients").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });
