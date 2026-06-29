// Server functions for persisted drivers (Fahrer).
// All run as the signed-in user (RLS enforces role-based access).
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Fahrer } from "@/lib/fahrer";
import { rowToFahrer, writeToRow, type DriverRow, type DriverWrite } from "@/lib/drivers-shared";

export const listDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Fahrer[]> => {
    const { data, error } = await context.supabase
      .from("drivers")
      .select("*")
      .order("nummer", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToFahrer(r as unknown as DriverRow));
  });

export const createDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: DriverWrite) => {
    if (!data || typeof data.name !== "string") {
      throw new Error("name ist erforderlich");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<Fahrer> => {
    let nummer = data.nummer;
    if (!nummer) {
      const { count } = await context.supabase
        .from("drivers")
        .select("*", { count: "exact", head: true });
      nummer = `F-${String((count ?? 0) + 1).padStart(3, "0")}`;
    }
    const row = writeToRow({ ...data, nummer });
    const { data: created, error } = await context.supabase
      .from("drivers")
      .insert(row as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToFahrer(created as unknown as DriverRow);
  });

export const updateDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; values: Partial<DriverWrite> }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<Fahrer> => {
    const row = writeToRow(data.values);
    const { data: updated, error } = await context.supabase
      .from("drivers")
      .update(row as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToFahrer(updated as unknown as DriverRow);
  });

export const deleteDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("drivers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * One-time seed: fills the drivers table with the original demo set if it is
 * empty. Admin/Disposition only (enforced by RLS on INSERT). Idempotent.
 */
export const seedDrivers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("drivers")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };

    const { SEED_FAHRER } = await import("@/lib/fahrer");
    const rows = SEED_FAHRER.map((f: Fahrer) =>
      writeToRow({
        nummer: f.nummer,
        name: f.name,
        foto: f.foto,
        telefon: f.telefon,
        email: f.email,
        adresse: f.adresse,
        fuehrerschein: f.fuehrerschein,
        pSchein: f.pSchein,
        ersteHilfe: f.ersteHilfe,
        vertragsart: f.vertragsart,
        arbeitszeiten: f.arbeitszeiten,
        urlaubstage: f.urlaubstage,
        krankheitstage: f.krankheitstage,
        status: f.status,
        standort: f.standort,
        gps: f.gps,
        fahrzeug: f.fahrzeug,
        schicht: f.schicht,
        bewertung: f.bewertung,
        puenktlichkeit: f.puenktlichkeit,
        beschwerden: f.beschwerden,
        lob: f.lob,
        ueberstunden: f.ueberstunden,
        kmHeute: f.kmHeute,
        umsatzHeute: f.umsatzHeute,
        gewinnHeute: f.gewinnHeute,
      }),
    );
    if (rows.length === 0) return { seeded: 0 };
    const { error } = await context.supabase.from("drivers").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });
