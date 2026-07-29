// Server functions for persisted facilities (Einrichtungen). RLS enforces
// admin/disposition/fahrer read, admin/disposition write.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Einrichtung } from "@/lib/stammdaten";
import {
  rowToEinrichtung,
  einrichtungToRow,
  type FacilityRow,
  type FacilityWrite,
} from "@/lib/facilities-shared";

/** Strikte Validierung aller Einrichtungsfelder (Domäntyp `Einrichtung`). */
const facilityFieldsSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    adresse: z.string().trim().max(300),
    ansprechpartner: z.string().trim().max(200),
    telefon: z.string().trim().max(50),
    typ: z.enum(["krankenhaus", "dialyse", "pflegeheim"]).optional(),
    email: z.string().trim().max(200).email("Ungültige E-Mail-Adresse.").optional(),
    fachbereiche: z.array(z.string().max(100)).optional(),
    kapazitaet: z.number().int().min(0).optional(),
    oeffnungszeiten: z.string().trim().max(200).optional(),
    // Freitext: es gibt (noch) keine kostentraegerId-FK bei Einrichtungen.
    kostentraeger: z.string().trim().max(200).optional(),
    notiz: z.string().max(2000).optional(),
    aktiv: z.boolean().optional(),
  })
  .strict();

const createFacilitySchema = facilityFieldsSchema;

const updateFacilitySchema = z
  .object({
    id: z.string().uuid(),
    values: facilityFieldsSchema.partial().strict(),
  })
  .strict()
  .refine((v) => Object.keys(v.values).length > 0, {
    message: "Keine Änderungen übergeben.",
    path: ["values"],
  });

const deleteFacilitySchema = z.object({ id: z.string().uuid() }).strict();

function parseOrThrow<T>(schema: { safeParse: (d: unknown) => { success: boolean; data?: T } }, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error("Ungültige Einrichtungsdaten.");
  return parsed.data as T;
}

export const listFacilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Einrichtung[]> => {
    const { data, error } = await context.supabase
      .from("facilities")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToEinrichtung(r as unknown as FacilityRow));
  });

export const createFacility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => parseOrThrow<FacilityWrite>(createFacilitySchema as never, data))
  .handler(async ({ data, context }): Promise<Einrichtung> => {
    const { data: created, error } = await context.supabase
      .from("facilities")
      .insert(einrichtungToRow(data) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToEinrichtung(created as unknown as FacilityRow);
  });

export const updateFacility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    parseOrThrow<{ id: string; values: Partial<FacilityWrite> }>(updateFacilitySchema as never, data),
  )
  .handler(async ({ data, context }): Promise<Einrichtung> => {
    const { data: updated, error } = await context.supabase
      .from("facilities")
      .update(einrichtungToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToEinrichtung(updated as unknown as FacilityRow);
  });

export const deleteFacility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => parseOrThrow<{ id: string }>(deleteFacilitySchema as never, data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("facilities").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });


export const seedFacilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("facilities")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };
    const { KRANKENHAEUSER, DIALYSEZENTREN, PFLEGEHEIME } = await import("@/lib/stammdaten");
    const alle = [...KRANKENHAEUSER, ...DIALYSEZENTREN, ...PFLEGEHEIME];
    const rows = alle.map((e) => {
      const { id: _id, ...rest } = e;
      void _id;
      return einrichtungToRow(rest);
    });
    const { error } = await context.supabase.from("facilities").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });
