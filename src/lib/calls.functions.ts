// Server functions for persisted calls (Anrufprotokoll). RLS enforces
// admin/disposition/fahrer read, admin/disposition write.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Anruf } from "@/lib/telefon";
import { rowToAnruf, anrufToRow, type CallRow, type CallWrite } from "@/lib/calls-shared";

export const listCalls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Anruf[]> => {
    const { data, error } = await context.supabase
      .from("calls")
      .select("*")
      .order("zeitpunkt", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToAnruf(r as unknown as CallRow));
  });

export const createCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: CallWrite) => {
    if (!data || typeof data.nummer !== "string" || !data.nummer.trim()) {
      throw new Error("nummer ist erforderlich");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<Anruf> => {
    const { data: created, error } = await context.supabase
      .from("calls")
      .insert(anrufToRow(data) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToAnruf(created as unknown as CallRow);
  });

export const updateCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; values: Partial<CallWrite> }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<Anruf> => {
    const { data: updated, error } = await context.supabase
      .from("calls")
      .update(anrufToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToAnruf(updated as unknown as CallRow);
  });

export const deleteCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("calls").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

export const seedCalls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("calls")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };
    const { INITIAL_ANRUFE } = await import("@/lib/telefon");
    const rows = INITIAL_ANRUFE.map((a) => {
      const { id: _id, ...rest } = a;
      void _id;
      return anrufToRow(rest);
    });
    const { error } = await context.supabase.from("calls").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });
