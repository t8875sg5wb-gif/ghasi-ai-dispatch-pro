// Server functions for persisted leasing contracts (Leasingverträge). RLS
// enforces admin/disposition/finanz read, admin/finanz write.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Leasingvertrag } from "@/lib/leasing";
import { rowToLeasing, leasingToRow, type LeasingRow, type LeasingWrite } from "@/lib/leasing-shared";

export const listLeasing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Leasingvertrag[]> => {
    const { data, error } = await context.supabase
      .from("leasing_contracts")
      .select("*")
      .order("ende", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToLeasing(r as unknown as LeasingRow));
  });

export const createLeasing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: LeasingWrite) => {
    if (!data || typeof data.leasinggeber !== "string" || !data.leasinggeber.trim()) {
      throw new Error("leasinggeber ist erforderlich");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<Leasingvertrag> => {
    const { data: created, error } = await context.supabase
      .from("leasing_contracts")
      .insert(leasingToRow(data) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToLeasing(created as unknown as LeasingRow);
  });

export const updateLeasing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; values: Partial<LeasingWrite> }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<Leasingvertrag> => {
    const { data: updated, error } = await context.supabase
      .from("leasing_contracts")
      .update(leasingToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToLeasing(updated as unknown as LeasingRow);
  });

export const deleteLeasing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("leasing_contracts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

export const seedLeasing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("leasing_contracts")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };
    const { INITIAL_LEASING } = await import("@/lib/leasing");
    const rows = INITIAL_LEASING.map((l) => {
      const { id: _id, ...rest } = l;
      void _id;
      return leasingToRow(rest);
    });
    const { error } = await context.supabase.from("leasing_contracts").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });
