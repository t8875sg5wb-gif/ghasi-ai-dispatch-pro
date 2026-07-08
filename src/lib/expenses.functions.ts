// Server functions for the expenses (Ausgaben) domain. RLS restricts access to
// admin/finanz. Receipt photos live in the `documents` domain and are linked
// via beleg_dokument_id.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  rowToAusgabe,
  ausgabeToRow,
  type Ausgabe,
  type ExpenseRow,
  type AusgabeWrite,
} from "@/lib/expenses-shared";

export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Ausgabe[]> => {
    const { data, error } = await context.supabase
      .from("expenses")
      .select("*")
      .order("datum", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToAusgabe(r as unknown as ExpenseRow));
  });

export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: AusgabeWrite) => {
    if (!data?.datum) throw new Error("datum ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<Ausgabe> => {
    const { data: created, error } = await context.supabase
      .from("expenses")
      .insert(ausgabeToRow(data) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToAusgabe(created as unknown as ExpenseRow);
  });

export const updateExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; values: Partial<AusgabeWrite> }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<Ausgabe> => {
    const { data: updated, error } = await context.supabase
      .from("expenses")
      .update(ausgabeToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToAusgabe(updated as unknown as ExpenseRow);
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

/** Realistic Minden seed examples (only when the table is empty). */
export const seedExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("expenses")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };
    const jahr = new Date().getFullYear();
    const rows = [
      { datum: `${jahr}-01-12`, kategorie: "Kraftstoff", lieferant: "Aral Minden Ringstraße", betragBrutto: 118.4, ustSatz: 19 },
      { datum: `${jahr}-01-31`, kategorie: "Leasing", lieferant: "VW Leasing GmbH", betragBrutto: 389.0, ustSatz: 19 },
      { datum: `${jahr}-02-05`, kategorie: "Versicherung", lieferant: "HUK-Coburg", betragBrutto: 142.5, ustSatz: 0 },
      { datum: `${jahr}-02-18`, kategorie: "Reparatur", lieferant: "Kfz-Werkstatt Meier, Minden", betragBrutto: 512.75, ustSatz: 19 },
      { datum: `${jahr}-02-28`, kategorie: "Büro", lieferant: "Bürobedarf Weser", betragBrutto: 47.9, ustSatz: 19 },
    ].map((r) => ausgabeToRow(r as AusgabeWrite));
    const { error } = await context.supabase.from("expenses").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });
