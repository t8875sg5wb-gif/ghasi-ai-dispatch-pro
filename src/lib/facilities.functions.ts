// Server functions for persisted facilities (Einrichtungen). RLS enforces
// admin/disposition/fahrer read, admin/disposition write.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Einrichtung } from "@/lib/stammdaten";
import {
  rowToEinrichtung,
  einrichtungToRow,
  type FacilityRow,
  type FacilityWrite,
} from "@/lib/facilities-shared";

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
  .validator((data: FacilityWrite) => {
    if (!data || typeof data.name !== "string" || !data.name.trim()) {
      throw new Error("name ist erforderlich");
    }
    return data;
  })
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
  .validator((data: { id: string; values: Partial<FacilityWrite> }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
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
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
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
