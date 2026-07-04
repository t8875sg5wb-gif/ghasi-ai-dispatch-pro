// Server functions for persisted insurance policies (Versicherungen). RLS
// enforces admin/disposition/finanz read, admin/finanz write.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Versicherung } from "@/lib/versicherungen";
import {
  rowToVersicherung,
  versicherungToRow,
  type InsuranceRow,
  type InsuranceWrite,
} from "@/lib/insurance-shared";

export const listInsurance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Versicherung[]> => {
    const { data, error } = await context.supabase
      .from("insurance_policies")
      .select("*")
      .order("ablauf", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToVersicherung(r as unknown as InsuranceRow));
  });

export const createInsurance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: InsuranceWrite) => {
    if (!data || typeof data.versicherer !== "string" || !data.versicherer.trim()) {
      throw new Error("versicherer ist erforderlich");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<Versicherung> => {
    const { data: created, error } = await context.supabase
      .from("insurance_policies")
      .insert(versicherungToRow(data) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToVersicherung(created as unknown as InsuranceRow);
  });

export const updateInsurance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; values: Partial<InsuranceWrite> }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<Versicherung> => {
    const { data: updated, error } = await context.supabase
      .from("insurance_policies")
      .update(versicherungToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToVersicherung(updated as unknown as InsuranceRow);
  });

export const deleteInsurance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("insurance_policies").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

export const seedInsurance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("insurance_policies")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };
    const { INITIAL_VERSICHERUNGEN } = await import("@/lib/versicherungen");
    const rows = INITIAL_VERSICHERUNGEN.map((v) => {
      const { id: _id, ...rest } = v;
      void _id;
      return versicherungToRow(rest);
    });
    const { error } = await context.supabase.from("insurance_policies").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });
