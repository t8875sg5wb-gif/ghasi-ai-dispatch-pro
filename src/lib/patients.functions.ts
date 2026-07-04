// Server functions for persisted patients. RLS enforces admin/disposition/fahrer.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Patient } from "@/lib/stammdaten";
import { rowToPatient, patientToRow, type PatientRow, type PatientWrite } from "@/lib/patients-shared";

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
  .validator((data: PatientWrite) => {
    if (!data || typeof data.name !== "string" || !data.name.trim()) {
      throw new Error("name ist erforderlich");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<Patient> => {
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
  .validator((data: { id: string; values: Partial<PatientWrite> }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<Patient> => {
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
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
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
