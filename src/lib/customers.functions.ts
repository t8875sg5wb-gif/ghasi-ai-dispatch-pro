// Server functions for persisted customers (Kunden).
// All run as the signed-in user (RLS enforces finance/admin access).
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Kunde } from "@/lib/stammdaten";
import { rowToKunde, kundeToRow, type CustomerRow, type CustomerWrite } from "@/lib/customers-shared";

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Kunde[]> => {
    const { data, error } = await context.supabase
      .from("customers")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToKunde(r as unknown as CustomerRow));
  });

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: CustomerWrite) => {
    if (!data || typeof data.name !== "string" || !data.name.trim()) {
      throw new Error("name ist erforderlich");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<Kunde> => {
    const { data: created, error } = await context.supabase
      .from("customers")
      .insert(kundeToRow(data) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToKunde(created as unknown as CustomerRow);
  });

export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; values: Partial<CustomerWrite> }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<Kunde> => {
    const { data: updated, error } = await context.supabase
      .from("customers")
      .update(kundeToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToKunde(updated as unknown as CustomerRow);
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("customers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

export const seedCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("customers")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };
    const { KUNDEN } = await import("@/lib/stammdaten");
    const rows = KUNDEN.map((k) => {
      const { id: _id, ...rest } = k;
      void _id;
      return kundeToRow(rest);
    });
    const { error } = await context.supabase.from("customers").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });
