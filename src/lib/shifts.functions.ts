// Server functions for driver shift calendar entries (RLS enforces access).
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  rowToShift,
  shiftToRow,
  type Shift,
  type ShiftRow,
  type ShiftWrite,
} from "@/lib/shifts-shared";

export const listShifts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Shift[]> => {
    const { data, error } = await context.supabase
      .from("driver_shifts")
      .select("*")
      .order("datum", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToShift(r as unknown as ShiftRow));
  });

export const createShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: ShiftWrite) => {
    if (!data?.driverId) throw new Error("driverId ist erforderlich");
    if (!data?.datum) throw new Error("datum ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<Shift> => {
    const { data: created, error } = await context.supabase
      .from("driver_shifts")
      .insert(shiftToRow(data) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToShift(created as unknown as ShiftRow);
  });

export const updateShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; values: Partial<ShiftWrite> }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<Shift> => {
    const { data: updated, error } = await context.supabase
      .from("driver_shifts")
      .update(shiftToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToShift(updated as unknown as ShiftRow);
  });

export const deleteShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("driver_shifts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });
