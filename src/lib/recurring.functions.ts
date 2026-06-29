// Server functions for persisted recurring transport orders (Daueraufträge).
// All run as the signed-in user (RLS enforces role-based access).
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Dauerauftrag } from "@/lib/dauerauftraege";
import {
  rowToDauerauftrag,
  writeToRecurringRow,
  type RecurringRow,
  type RecurringWrite,
} from "@/lib/recurring-shared";

export const listRecurring = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Dauerauftrag[]> => {
    const { data, error } = await context.supabase
      .from("recurring_orders")
      .select("*")
      .order("kennung", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToDauerauftrag(r as unknown as RecurringRow));
  });

export const createRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: RecurringWrite) => {
    if (!data || typeof data.patient !== "string") {
      throw new Error("patient ist erforderlich");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<Dauerauftrag> => {
    const row = writeToRecurringRow(data);
    const { data: created, error } = await context.supabase
      .from("recurring_orders")
      .insert(row as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToDauerauftrag(created as unknown as RecurringRow);
  });

export const updateRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; values: Partial<RecurringWrite> }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<Dauerauftrag> => {
    const row = writeToRecurringRow(data.values);
    const { data: updated, error } = await context.supabase
      .from("recurring_orders")
      .update(row as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToDauerauftrag(updated as unknown as RecurringRow);
  });

export const deleteRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("recurring_orders")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * One-time seed: fills the recurring_orders table with the original demo set if
 * it is empty. Admin/Disposition only (enforced by RLS on INSERT). Idempotent.
 */
export const seedRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("recurring_orders")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };

    const { SEED_DAUERAUFTRAEGE } = await import("@/lib/dauerauftraege");
    const { dauerauftragToWrite } = await import("@/lib/recurring-shared");
    const rows = SEED_DAUERAUFTRAEGE.map((d: Dauerauftrag) =>
      writeToRecurringRow(dauerauftragToWrite(d)),
    );
    if (rows.length === 0) return { seeded: 0 };
    const { error } = await context.supabase
      .from("recurring_orders")
      .insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });

/**
 * Generates real persisted transports (orders) from a recurring series for the
 * given date range, then advances the series' generated dates so the same day
 * is never produced twice. Returns the number of created orders.
 */
export const generateRecurringTransports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; vonISO: string; bisISO: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    if (!data?.vonISO || !data?.bisISO) throw new Error("Zeitraum ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ created: number; neueTermine: string[] }> => {
    const { data: row, error: loadErr } = await context.supabase
      .from("recurring_orders")
      .select("*")
      .eq("id", data.id)
      .single();
    if (loadErr) throw new Error(loadErr.message);

    const d = rowToDauerauftrag(row as unknown as RecurringRow);
    const { transportWritesFuer } = await import("@/lib/dauerauftraege");
    const { writeToRow } = await import("@/lib/orders-shared");
    const { neueTermine, writes } = transportWritesFuer(d, data.vonISO, data.bisISO);
    if (writes.length === 0) return { created: 0, neueTermine: [] };

    // Database-level duplicate guard: never generate the same transport twice for
    // the same series (recurringOrderId + date + patient + pickup + destination),
    // even if `generierteTermine` is stale or generation runs concurrently.
    const { data: vorhanden } = await context.supabase
      .from("orders")
      .select("termin, patient, abholort, zielort, dauerauftrag_id")
      .eq("dauerauftrag_id", data.id);
    const dedupKey = (
      termin: string,
      patient: string,
      pickupKey: string,
      destinationKey: string,
    ) => `${termin.slice(0, 10)}|${patient}|${pickupKey}|${destinationKey}`;
    const bekannt = new Set(
      (vorhanden ?? []).map((o: { termin: string; patient: string; abholort: string; zielort: string }) =>
        dedupKey(o.termin, o.patient, o.abholort, o.zielort),
      ),
    );
    const neueWrites = writes.filter((w) => {
      const pickupKey = w.pickup
        ? `${w.pickup.street}|${w.pickup.houseNumber}|${w.pickup.postalCode}|${w.pickup.city}|${w.pickup.country}`
        : w.abholort ?? "";
      const destinationKey = w.destination
        ? `${w.destination.street}|${w.destination.houseNumber}|${w.destination.postalCode}|${w.destination.city}|${w.destination.country}`
        : w.zielort ?? "";
      const key = dedupKey(w.termin, w.patient, pickupKey, destinationKey);
      if (bekannt.has(key)) return false;
      bekannt.add(key); // guard against duplicates within this same batch too
      return true;
    });
    if (neueWrites.length === 0) {
      // Still record the dates as generated so the series advances.
      const merged = Array.from(new Set([...(d.generierteTermine ?? []), ...neueTermine]));
      await context.supabase
        .from("recurring_orders")
        .update({ generierte_termine: merged } as never)
        .eq("id", data.id);
      return { created: 0, neueTermine: [] };
    }

    // Continuous order numbers based on the current order count.
    const { count } = await context.supabase
      .from("orders")
      .select("*", { count: "exact", head: true });
    let next = 2045 + (count ?? 0);
    const orderRows = neueWrites.map((w) =>
      writeToRow({ ...w, nummer: `A-${next++}`, status: w.status ?? "neu" }),
    );

    const { error: insErr } = await context.supabase
      .from("orders")
      .insert(orderRows as never);
    if (insErr) throw new Error(insErr.message);

    const mergedTermine = Array.from(
      new Set([...(d.generierteTermine ?? []), ...neueTermine]),
    );
    const { error: updErr } = await context.supabase
      .from("recurring_orders")
      .update({ generierte_termine: mergedTermine } as never)
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);

    return { created: neueWrites.length, neueTermine };
  });
