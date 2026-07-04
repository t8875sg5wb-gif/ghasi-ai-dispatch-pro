// Server functions for persisted vehicles (Fahrzeuge).
// All run as the signed-in user (RLS enforces role-based access).
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Fahrzeug } from "@/lib/fahrzeuge";
import { rowToFahrzeug, fahrzeugToRow, type VehicleRow, type VehicleWrite } from "@/lib/vehicles-shared";

export const listVehicles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Fahrzeug[]> => {
    const { data, error } = await context.supabase
      .from("vehicles")
      .select("*")
      .order("nummer", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToFahrzeug(r as unknown as VehicleRow));
  });

export const createVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: VehicleWrite) => {
    if (!data || typeof data.kennzeichen !== "string") {
      throw new Error("kennzeichen ist erforderlich");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<Fahrzeug> => {
    let nummer = data.nummer;
    if (!nummer) {
      const { count } = await context.supabase
        .from("vehicles")
        .select("*", { count: "exact", head: true });
      nummer = `KFZ-${String((count ?? 0) + 1).padStart(3, "0")}`;
    }
    const { data: created, error } = await context.supabase
      .from("vehicles")
      .insert(fahrzeugToRow({ ...data, nummer }) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToFahrzeug(created as unknown as VehicleRow);
  });

export const updateVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; values: Partial<VehicleWrite> }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<Fahrzeug> => {
    const { data: updated, error } = await context.supabase
      .from("vehicles")
      .update(fahrzeugToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToFahrzeug(updated as unknown as VehicleRow);
  });

export const deleteVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("vehicles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

export const seedVehicles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("vehicles")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };
    const { INITIAL_FAHRZEUGE } = await import("@/lib/fahrzeuge");
    const rows = INITIAL_FAHRZEUGE.map((f) => {
      const { id: _id, ...rest } = f;
      void _id;
      return fahrzeugToRow(rest);
    });
    const { error } = await context.supabase.from("vehicles").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });
