// Server functions for the per-vehicle mileage log (RLS enforces access).
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  rowToFahrt,
  fahrtToRow,
  type Fahrt,
  type FahrtRow,
  type FahrtWrite,
} from "@/lib/trips-shared";

export const listTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Fahrt[]> => {
    const { data, error } = await context.supabase
      .from("vehicle_trips")
      .select("*")
      .order("datum", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToFahrt(r as unknown as FahrtRow));
  });

export const createTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: FahrtWrite) => {
    if (!data?.vehicleId) throw new Error("vehicleId ist erforderlich");
    if (!data?.datum) throw new Error("datum ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<Fahrt> => {
    const { data: created, error } = await context.supabase
      .from("vehicle_trips")
      .insert(fahrtToRow(data) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToFahrt(created as unknown as FahrtRow);
  });

export const deleteTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("vehicle_trips").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });
