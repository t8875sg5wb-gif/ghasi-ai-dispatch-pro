// Server functions for insurer contracts (RLS: admin/finanz).
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  rowToKassenvertrag,
  kassenvertragToRow,
  type Kassenvertrag,
  type KassenvertragRow,
  type KassenvertragWrite,
} from "@/lib/insurer-contracts-shared";

export const listInsurerContracts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Kassenvertrag[]> => {
    const { data, error } = await context.supabase
      .from("insurer_contracts")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToKassenvertrag(r as unknown as KassenvertragRow));
  });

export const createInsurerContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: KassenvertragWrite) => {
    if (!data?.insurerId) throw new Error("insurerId ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<Kassenvertrag> => {
    const { data: created, error } = await context.supabase
      .from("insurer_contracts")
      .insert(kassenvertragToRow(data) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToKassenvertrag(created as unknown as KassenvertragRow);
  });

export const deleteInsurerContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("insurer_contracts")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });
